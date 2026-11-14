"use server";

import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth";
import { confirmEmail, sendVerificationEmail } from "@/lib/email-verification";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/**
 * The button on the page an emailed link opens. Confirming takes a click rather than happening as
 * the page loads, because mail scanners and link previews open links without the person.
 */
export async function confirmEmailAddress(formData: FormData) {
  const limit = await rateLimit(`verify-submit:ip:${await clientIp()}`, 20, 60 * 60);
  if (!limit.ok) redirect("/verify-email?status=limited");

  const userId = await confirmEmail(String(formData.get("token") ?? ""));
  if (!userId) redirect("/verify-email?status=invalid");
  redirect("/verify-email?status=confirmed");
}

export async function resendVerificationEmail() {
  const session = await getSession();
  if (!session) redirect("/login?next=/verify-email");
  if (session.emailVerified) redirect("/verify-email");

  const limit = await rateLimit(`verify-send:user:${session.id}`, 3, 60 * 60);
  if (!limit.ok) redirect("/verify-email?status=limited");

  await sendVerificationEmail(session);
  redirect("/verify-email?status=sent");
}
