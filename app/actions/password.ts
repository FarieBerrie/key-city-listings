"use server";

import { randomBytes } from "node:crypto";

import bcrypt from "bcryptjs";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { z } from "zod";

import { destroySession } from "@/lib/auth";
import { site } from "@/lib/config";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { appUrl } from "@/lib/listing";
import { findUsableResetToken, hashResetToken } from "@/lib/password-reset";
import { clientIp, rateLimit, retryMessage } from "@/lib/rate-limit";

const LINK_MINUTES = 60;

export type ForgotState = { error: string; sent: boolean };
export type ResetState = { error: string };

export async function requestPasswordReset(_prev: ForgotState, formData: FormData): Promise<ForgotState> {
  const parsed = z.string().trim().email("Enter the email you signed up with.").max(120).safeParse(formData.get("email"));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Enter your email.", sent: false };
  const email = parsed.data.toLowerCase();

  const byIp = await rateLimit(`reset:ip:${await clientIp()}`, 10, 60 * 60);
  if (!byIp.ok) return { error: retryMessage(byIp.retryAfterSeconds), sent: false };
  // Quietly cap emails per address: the answer below is the same whether or not one goes out
  const byEmail = await rateLimit(`reset:email:${email}`, 3, 60 * 60);

  const user = byEmail.ok ? await prisma.user.findUnique({ where: { email } }) : null;
  if (user) {
    const token = randomBytes(32).toString("base64url");
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashResetToken(token),
        expiresAt: new Date(Date.now() + LINK_MINUTES * 60_000),
      },
    });
    const link = `${appUrl()}/reset-password?token=${token}`;
    // Sent after the response, so the reply takes as long whether or not the account exists
    after(() =>
      sendEmail({
        to: user.email,
        subject: `Reset your ${site.name} password`,
        paragraphs: [
          `Hi ${user.name},`,
          `Someone (hopefully you) asked to reset the password for your ${site.name} account. Choose a new one here:`,
          link,
          `The link works once and expires in ${LINK_MINUTES} minutes. If you didn't ask for this, you can ignore this email; your password hasn't changed.`,
        ],
      }),
    );
  }

  // Same answer either way, so this form can't be used to find out who has an account
  return { error: "", sent: true };
}

const passwordSchema = z
  .object({
    password: z.string().min(8, "Use at least 8 characters.").max(72, "Use 72 characters or fewer."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "The two passwords don't match." });

export async function resetPassword(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const limit = await rateLimit(`reset-submit:ip:${await clientIp()}`, 10, 60 * 60);
  if (!limit.ok) return { error: retryMessage(limit.retryAfterSeconds) };

  const parsed = passwordSchema.safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the new password." };

  const row = await findUsableResetToken(String(formData.get("token") ?? ""));
  if (!row) return { error: "This reset link has expired or was already used. Ask for a new one." };

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  await prisma.$transaction([
    // Bumping the session version signs out every device that was logged in
    prisma.user.update({
      where: { id: row.userId },
      data: { passwordHash, sessionVersion: { increment: 1 } },
    }),
    // The reset link reached their inbox, which proves the address is theirs
    prisma.user.updateMany({
      where: { id: row.userId, emailVerifiedAt: null },
      data: { emailVerifiedAt: new Date() },
    }),
    prisma.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    prisma.passwordResetToken.deleteMany({ where: { userId: row.userId, id: { not: row.id } } }),
  ]);
  await destroySession();
  redirect("/login?reset=1");
}
