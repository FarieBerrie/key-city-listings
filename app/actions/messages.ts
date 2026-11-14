"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CONFIRM_EMAIL_FIRST } from "@/lib/email-verification";
import { isListingPublic } from "@/lib/listing";
import { notifyNewMessage } from "@/lib/notifications";
import { rateLimit, retryMessage } from "@/lib/rate-limit";

export type MessageState = { error: string; sent: number };

const bodySchema = z.string().trim().min(1, "Write a message first.").max(2000, "Keep it under 2,000 characters.");

async function findOrCreateThread(input: {
  contractorId: string;
  customerId: string;
  jobRequestId?: string | null;
}) {
  const jobRequestId = input.jobRequestId ?? null;
  const existing = await prisma.conversation.findFirst({
    where: {
      contractorId: input.contractorId,
      customerId: input.customerId,
      jobRequestId,
    },
  });
  if (existing) return existing;
  return prisma.conversation.create({
    data: {
      contractorId: input.contractorId,
      customerId: input.customerId,
      jobRequestId,
    },
  });
}

export async function startConversation(formData: FormData) {
  const session = await getSession();
  const jobId = String(formData.get("jobId") ?? "") || null;
  const contractorUserId = String(formData.get("contractorUserId") ?? "");
  const next = jobId ? `/jobs/${jobId}` : "/contractors";
  if (!session) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (!session.emailVerified) redirect("/verify-email");
  const limit = await rateLimit(`thread:user:${session.id}`, 20, 60 * 60);
  if (!limit.ok) redirect(next);

  if (jobId) {
    if (session.role !== "CONTRACTOR") redirect(next);
    const job = await prisma.jobRequest.findUnique({ where: { id: jobId } });
    if (!job || job.customerId === session.id) redirect("/jobs");
    const thread = await findOrCreateThread({
      contractorId: session.id,
      customerId: job.customerId,
      jobRequestId: job.id,
    });
    redirect(`/messages/${thread.id}`);
  }

  if (session.role !== "CUSTOMER") redirect("/contractors");
  const contractor = await prisma.user.findUnique({
    where: { id: contractorUserId },
    include: { contractorProfile: { include: { listing: true } } },
  });
  const profile = contractor?.contractorProfile;
  if (!contractor || contractor.role !== "CONTRACTOR" || !profile) redirect("/contractors");
  if (!isListingPublic(profile.listing, new Date())) redirect("/contractors");

  const thread = await findOrCreateThread({
    contractorId: contractor.id,
    customerId: session.id,
  });
  redirect(`/messages/${thread.id}`);
}

export async function sendMessage(prev: MessageState, formData: FormData): Promise<MessageState> {
  const session = await getSession();
  if (!session) return { error: "Log in again to send this.", sent: prev.sent };
  if (!session.emailVerified) return { error: CONFIRM_EMAIL_FIRST, sent: prev.sent };

  const limit = await rateLimit(`message:user:${session.id}`, 30, 10 * 60);
  if (!limit.ok) return { error: retryMessage(limit.retryAfterSeconds), sent: prev.sent };

  const conversationId = String(formData.get("conversationId") ?? "");
  const parsed = bodySchema.safeParse(formData.get("body"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Write a message.", sent: prev.sent };
  }

  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) return { error: "That conversation is gone.", sent: prev.sent };
  if (conversation.contractorId !== session.id && conversation.customerId !== session.id) {
    return { error: "You are not part of this conversation.", sent: prev.sent };
  }

  // Email the other side only if this is the first message they haven't read yet
  const unreadBefore = await prisma.message.count({
    where: { conversationId, senderId: session.id, readAt: null },
  });
  await prisma.message.create({
    data: {
      conversationId,
      senderId: session.id,
      body: parsed.data,
    },
  });
  if (unreadBefore === 0) {
    const recipientId = conversation.contractorId === session.id ? conversation.customerId : conversation.contractorId;
    after(() => notifyNewMessage({ conversationId, senderId: session.id, recipientId, body: parsed.data }));
  }
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  revalidatePath(`/messages/${conversationId}`);
  revalidatePath("/messages");
  return { error: "", sent: prev.sent + 1 };
}
