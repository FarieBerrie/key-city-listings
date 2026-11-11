import { randomUUID } from "node:crypto";

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { confirmEmail, findUsableVerifyToken, sendVerificationEmail } from "@/lib/email-verification";

vi.mock("@/lib/email", () => ({ sendEmail: vi.fn().mockResolvedValue(true) }));

/**
 * Real database queries, like billing.integration.test.ts: skipped unless TEST_DATABASE_URL is
 * set, and only touches the account it creates.
 */
const databaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!databaseUrl)("email confirmation links", () => {
  let user: { id: string; email: string; name: string };

  /** Sends a link and reads the token out of the email, the way the person gets it. */
  async function emailedToken() {
    vi.mocked(sendEmail).mockClear();
    await sendVerificationEmail(user);
    const email = vi.mocked(sendEmail).mock.calls[0][0];
    const link = email.paragraphs.find((p) => p.includes("/verify-email?token="));
    return new URL(link!).searchParams.get("token")!;
  }

  const verifiedAt = async () =>
    (await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).emailVerifiedAt;

  beforeAll(() => {
    if (!/@(localhost|127\.0\.0\.1)[:/]/.test(databaseUrl ?? "")) {
      throw new Error("TEST_DATABASE_URL must point at a database on this machine.");
    }
  });

  beforeEach(async () => {
    user = await prisma.user.create({
      data: {
        email: `verify-test-${randomUUID()}@example.test`,
        passwordHash: "not-a-real-hash",
        name: "Verify Test",
        role: "CUSTOMER",
      },
      select: { id: true, email: true, name: true },
    });
  });

  afterEach(async () => {
    await prisma.user.delete({ where: { id: user.id } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("starts new accounts unconfirmed", async () => {
    expect(await verifiedAt()).toBeNull();
  });

  it("emails the link to the account's own address", async () => {
    await emailedToken();
    expect(vi.mocked(sendEmail).mock.calls[0][0]).toMatchObject({ to: user.email });
  });

  it("confirms the address with the emailed link", async () => {
    const token = await emailedToken();
    expect(await confirmEmail(token)).toBe(user.id);
    expect(await verifiedAt()).toBeInstanceOf(Date);
  });

  it("works only once", async () => {
    const token = await emailedToken();
    await confirmEmail(token);
    expect(await findUsableVerifyToken(token)).toBeNull();
    expect(await confirmEmail(token)).toBeNull();
  });

  it("rejects a link after it expires", async () => {
    const token = await emailedToken();
    await prisma.emailVerificationToken.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await confirmEmail(token)).toBeNull();
    expect(await verifiedAt()).toBeNull();
  });

  it("stops an older link working once a new one is sent", async () => {
    const older = await emailedToken();
    const newer = await emailedToken();
    expect(await confirmEmail(older)).toBeNull();
    expect(await verifiedAt()).toBeNull();
    expect(await confirmEmail(newer)).toBe(user.id);
  });

  it("rejects a made-up or empty link", async () => {
    await emailedToken();
    expect(await confirmEmail("not-a-real-token")).toBeNull();
    expect(await confirmEmail("")).toBeNull();
    expect(await verifiedAt()).toBeNull();
  });

  it("stores only a hash of the token", async () => {
    const token = await emailedToken();
    const rows = await prisma.emailVerificationToken.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).not.toBe(token);
    expect(rows[0].tokenHash).not.toContain(token);
  });

  it("can't confirm a different account", async () => {
    const other = await prisma.user.create({
      data: {
        email: `verify-test-${randomUUID()}@example.test`,
        passwordHash: "not-a-real-hash",
        name: "Other",
        role: "CUSTOMER",
      },
    });
    try {
      const token = await emailedToken();
      await confirmEmail(token);
      const otherNow = await prisma.user.findUniqueOrThrow({ where: { id: other.id } });
      expect(otherNow.emailVerifiedAt).toBeNull();
    } finally {
      await prisma.user.delete({ where: { id: other.id } });
    }
  });
});
