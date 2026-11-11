"use server";

import bcrypt from "bcryptjs";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createSession, destroySession } from "@/lib/auth";
import { cities } from "@/lib/config";
import { prisma } from "@/lib/db";
import { sendVerificationEmail } from "@/lib/email-verification";
import { demoLoginsEnabled } from "@/lib/env";
import { safeNextPath } from "@/lib/format";
import { clientIp, rateLimit, retryMessage } from "@/lib/rate-limit";

export type AuthState = { error: string };

const signupSchema = z.object({
  role: z.enum(["CONTRACTOR", "CUSTOMER"]),
  name: z.string().trim().min(2, "Enter your name.").max(80),
  businessName: z.string().trim().min(2, "Enter the business name.").max(80),
  email: z.string().trim().email("Enter a valid email.").max(120),
  password: z.string().min(8, "Use at least 8 characters.").max(72),
  phone: z.string().trim().max(30).optional(),
  city: z.string().trim().min(2).max(40),
});

// Compared against when the email has no account, so a wrong email takes as long as a wrong
// password and the timing doesn't reveal which emails are registered
const NO_USER_HASH = bcrypt.hashSync("no-such-user", 10);

async function authenticate(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(formData.get("next"), "/dashboard");
  if (!email || !password) return { error: "Enter your email and password.", to: next };

  // Per account (stops password guessing on one email) and per address (stops trying many)
  const ip = await clientIp();
  const byEmail = await rateLimit(`login:email:${email}`, 10, 15 * 60);
  const byIp = await rateLimit(`login:ip:${ip}`, 30, 15 * 60);
  if (!byEmail.ok || !byIp.ok) {
    return { error: retryMessage(Math.max(byEmail.retryAfterSeconds, byIp.retryAfterSeconds)), to: next };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? NO_USER_HASH);
  if (!user || !ok || (user.role !== "CONTRACTOR" && user.role !== "CUSTOMER")) {
    return { error: "Email or password does not match.", to: next };
  }
  await createSession(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    user.sessionVersion,
  );
  return { error: "", to: next === "/dashboard" ? "/dashboard" : next };
}

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const result = await authenticate(formData);
  if (result.error) return { error: result.error };
  redirect(result.to);
}

/** The "Enter as…" sample-account buttons. Off in production unless ENABLE_DEMO_LOGINS=true. */
export async function loginDirect(formData: FormData) {
  if (!demoLoginsEnabled()) redirect("/login");
  const result = await authenticate(formData);
  if (result.error) redirect(`/login?error=${encodeURIComponent(result.error)}`);
  redirect(result.to);
}

export async function signup(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signupSchema.safeParse({
    role: formData.get("role"),
    name: formData.get("name"),
    businessName: formData.get("businessName"),
    email: formData.get("email"),
    password: formData.get("password"),
    phone: formData.get("phone") ?? "",
    city: formData.get("city"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const data = parsed.data;
  if (!cities.some((city) => city.label === data.city)) {
    return { error: "Pick a town in the Abilene area." };
  }

  const limit = await rateLimit(`signup:ip:${await clientIp()}`, 5, 60 * 60);
  if (!limit.ok) return { error: retryMessage(limit.retryAfterSeconds) };

  const email = data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "An account with that email already exists." };

  const passwordHash = await bcrypt.hash(data.password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: data.name,
      role: data.role,
      customerProfile:
        data.role === "CUSTOMER"
          ? {
              create: {
                businessName: data.businessName,
                phone: data.phone ?? "",
                city: data.city,
              },
            }
          : undefined,
      contractorProfile:
        data.role === "CONTRACTOR"
          ? {
              create: {
                businessName: data.businessName,
                phone: data.phone ?? "",
                contactEmail: email,
                city: data.city,
                listing: { create: { status: "INACTIVE", tier: "BASIC" } },
              },
            }
          : undefined,
    },
  });

  await createSession(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: data.role,
    },
    user.sessionVersion,
  );
  // Sent after the response, so signing up doesn't wait on the email service
  after(() => sendVerificationEmail(user));

  redirect(data.role === "CONTRACTOR" ? "/billing" : "/dashboard");
}

export async function logout() {
  await destroySession();
  redirect("/");
}
