import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { site } from "@/lib/config";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { appUrl } from "@/lib/listing";

export const VERIFY_LINK_HOURS = 24;

/** What someone sees when they try something that needs a confirmed email address. */
export const CONFIRM_EMAIL_FIRST =
  "Confirm your email address first: use the link we emailed you. The banner at the top of the page sends a new one.";

/** Links carry a random token; the database only keeps its hash. */
function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Emails a fresh confirmation link. Older links stop working, so only the newest email counts.
 * Returns false if the email couldn't be sent (see sendEmail).
 */
export async function sendVerificationEmail(user: { id: string; email: string; name: string }) {
  const token = randomBytes(32).toString("base64url");
  await prisma.$transaction([
    prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } }),
    prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + VERIFY_LINK_HOURS * 3_600_000),
      },
    }),
  ]);

  return sendEmail({
    to: user.email,
    subject: `Confirm your email for ${site.name}`,
    paragraphs: [
      `Hi ${user.name},`,
      `Thanks for joining ${site.name}. Confirm this is your email address to post jobs, send messages and list your business:`,
      `${appUrl()}/verify-email?token=${token}`,
      `The link expires in ${VERIFY_LINK_HOURS} hours. If you didn't create an account, you can ignore this email.`,
    ],
  });
}

/** The link's token, if it's real, unused and unexpired. */
export async function findUsableVerifyToken(token: string) {
  if (!token) return null;
  const row = await prisma.emailVerificationToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!row || row.expiresAt <= new Date()) return null;
  return row;
}

/**
 * Confirms the email address behind a link and retires every link for that account. Returns the
 * user's id, or null when the link is wrong, expired or already used.
 */
export async function confirmEmail(token: string) {
  const row = await findUsableVerifyToken(token);
  if (!row) return null;
  await prisma.$transaction([
    // Keeps the first confirmation time if they were already confirmed
    prisma.user.updateMany({
      where: { id: row.userId, emailVerifiedAt: null },
      data: { emailVerifiedAt: new Date() },
    }),
    prisma.emailVerificationToken.deleteMany({ where: { userId: row.userId } }),
  ]);
  return row.userId;
}
