"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSession } from "@/lib/auth";
import { cities, isTradeSlug } from "@/lib/config";
import { prisma } from "@/lib/db";
import { CONFIRM_EMAIL_FIRST } from "@/lib/email-verification";
import { parseDollars } from "@/lib/format";
import { rateLimit, retryMessage } from "@/lib/rate-limit";

export type FormState = { error: string };

const jobSchema = z.object({
  title: z.string().trim().min(4, "Give the job a short title.").max(100),
  description: z.string().trim().min(20, "Describe the work in a sentence or two.").max(2000),
  trade: z.string().refine(isTradeSlug, "Pick a trade."),
  city: z.string().refine((city) => cities.some((item) => item.label === city), "Pick a town."),
  zip: z.string().trim().max(10).optional(),
  timeline: z.string().trim().min(2, "Add a timeline.").max(120),
});

export async function createJob(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) redirect("/login?next=/jobs/new");
  if (session.role !== "CUSTOMER") return { error: "Only business accounts can post jobs." };
  if (!session.emailVerified) return { error: CONFIRM_EMAIL_FIRST };
  const limit = await rateLimit(`job:user:${session.id}`, 10, 60 * 60);
  if (!limit.ok) return { error: retryMessage(limit.retryAfterSeconds) };

  const parsed = jobSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    trade: formData.get("trade") ?? "",
    city: formData.get("city"),
    zip: formData.get("zip") ?? "",
    timeline: formData.get("timeline"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };

  const budgetMin = parseDollars(formData.get("budgetMin"));
  const budgetMax = parseDollars(formData.get("budgetMax"));
  if (Number.isNaN(budgetMin) || Number.isNaN(budgetMax)) {
    return { error: "Budget amounts should be plain dollar values." };
  }
  if (budgetMin != null && budgetMax != null && budgetMin > budgetMax) {
    return { error: "The low end of the budget cannot be higher than the high end." };
  }

  const job = await prisma.jobRequest.create({
    data: {
      customerId: session.id,
      title: parsed.data.title,
      description: parsed.data.description,
      trade: parsed.data.trade,
      city: parsed.data.city,
      zip: parsed.data.zip ?? "",
      budgetMin,
      budgetMax,
      timeline: parsed.data.timeline,
      status: "OPEN",
    },
  });

  revalidatePath("/jobs");
  revalidatePath("/dashboard");
  redirect(`/jobs/${job.id}`);
}

export async function closeJob(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  const id = String(formData.get("jobId") ?? "");
  const job = await prisma.jobRequest.findUnique({ where: { id } });
  if (!job || job.customerId !== session.id) return;
  await prisma.jobRequest.update({ where: { id }, data: { status: "CLOSED" } });
  revalidatePath("/jobs");
  revalidatePath(`/jobs/${id}`);
  revalidatePath("/dashboard");
}
