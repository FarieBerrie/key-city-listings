import "server-only";

import { site } from "@/lib/config";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { appUrl } from "@/lib/listing";

const SNIPPET = 400;

/**
 * Emails the other side of a conversation about a new message, unless they've turned these emails
 * off. sendMessage only calls this for the first unread message, so a burst of messages sends one
 * email, and the next comes after the recipient has read the thread.
 */
export async function notifyNewMessage(input: {
  conversationId: string;
  senderId: string;
  recipientId: string;
  body: string;
}) {
  const [recipient, sender, conversation] = await Promise.all([
    prisma.user.findUnique({
      where: { id: input.recipientId },
      select: { email: true, name: true, emailMessages: true, emailVerifiedAt: true },
    }),
    prisma.user.findUnique({
      where: { id: input.senderId },
      select: {
        name: true,
        contractorProfile: { select: { businessName: true } },
        customerProfile: { select: { businessName: true } },
      },
    }),
    prisma.conversation.findUnique({
      where: { id: input.conversationId },
      select: { jobRequest: { select: { title: true } } },
    }),
  ]);
  // Never email an address its owner hasn't confirmed
  if (!recipient?.emailMessages || !recipient.emailVerifiedAt || !sender) return;

  const from = sender.contractorProfile?.businessName ?? sender.customerProfile?.businessName ?? sender.name;
  const about = conversation?.jobRequest ? ` about "${conversation.jobRequest.title}"` : "";
  const snippet = input.body.length > SNIPPET ? `${input.body.slice(0, SNIPPET).trimEnd()}…` : input.body;

  await sendEmail({
    to: recipient.email,
    subject: `New message from ${from}`,
    paragraphs: [
      `Hi ${recipient.name},`,
      `${from} sent you a message on ${site.name}${about}:`,
      snippet,
      `Read and reply: ${appUrl()}/messages/${input.conversationId}`,
      `You get one email per conversation until you read it. To stop these emails, switch them off on your profile: ${appUrl()}/profile`,
    ],
  });
}
