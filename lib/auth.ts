import "server-only";

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

import { prisma } from "@/lib/db";
import { authSecretProblem } from "@/lib/env";

const COOKIE = "tw_session";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: "CONTRACTOR" | "CUSTOMER";
  /** False until they confirm their email address */
  emailVerified: boolean;
};

function secretKey() {
  const problem = authSecretProblem();
  if (problem) throw new Error(problem);
  return new TextEncoder().encode(process.env.AUTH_SECRET);
}

/**
 * Signs the user in. `sessionVersion` is the user's current value: changing the password bumps
 * it, which makes every cookie signed with the old value stop working.
 */
export async function createSession(user: Omit<SessionUser, "emailVerified">, sessionVersion: number) {
  const token = await new SignJWT({
    email: user.email,
    name: user.name,
    role: user.role,
    ver: sessionVersion,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("14d")
    .sign(secretKey());

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secretKey());
    const role = payload.role;
    if (payload.sub == null || (role !== "CONTRACTOR" && role !== "CUSTOMER")) return null;
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, role: true, sessionVersion: true, emailVerifiedAt: true },
    });
    if (!user || (user.role !== "CONTRACTOR" && user.role !== "CUSTOMER")) return null;
    // Signed before the last password change (cookies from before this check count as version 0)
    if ((payload.ver ?? 0) !== user.sessionVersion) return null;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      emailVerified: user.emailVerifiedAt !== null,
    };
  } catch {
    return null;
  }
}
