import { randomUUID } from "node:crypto";

import type Stripe from "stripe";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/db";
import { activeListingWhere } from "@/lib/listing";
import { applySubscription } from "@/lib/stripe";

/**
 * Runs the real Prisma queries: a Stripe subscription goes in, and these check whether the
 * contractor shows up in public search. Skipped unless TEST_DATABASE_URL is set. It only touches
 * rows it creates, and removes them afterwards.
 */
const databaseUrl = process.env.TEST_DATABASE_URL;

const DAY = 86_400_000;

type SubscriptionOptions = {
  id?: string;
  status?: Stripe.Subscription.Status;
  priceId?: string;
  profileId?: string | null;
  periodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
};

describe.skipIf(!databaseUrl)("Stripe subscriptions and public listings", () => {
  let userId: string;
  let profileId: string;

  function subscription(options: SubscriptionOptions = {}) {
    const {
      id = `sub_${randomUUID()}`,
      status = "active",
      priceId = "price_basic",
      periodEnd = new Date(Date.now() + 30 * DAY),
      cancelAtPeriodEnd = false,
    } = options;
    const profile = options.profileId === undefined ? profileId : options.profileId;
    return {
      id,
      status,
      customer: "cus_test",
      cancel_at_period_end: cancelAtPeriodEnd,
      metadata: profile ? { contractorProfileId: profile } : {},
      items: {
        data: [{ price: { id: priceId }, current_period_end: Math.floor(periodEnd.getTime() / 1000) }],
      },
    } as unknown as Stripe.Subscription;
  }

  const listing = () => prisma.listing.findUnique({ where: { contractorProfileId: profileId } });

  async function isInPublicSearch() {
    const found = await prisma.contractorProfile.count({
      where: { id: profileId, ...activeListingWhere(new Date()) },
    });
    return found === 1;
  }

  beforeAll(() => {
    if (!/@(localhost|127\.0\.0\.1)[:/]/.test(databaseUrl ?? "")) {
      throw new Error("TEST_DATABASE_URL must point at a database on this machine.");
    }
  });

  beforeEach(async () => {
    vi.stubEnv("STRIPE_PRICE_BASIC", "price_basic");
    vi.stubEnv("STRIPE_PRICE_FEATURED", "price_featured");
    const user = await prisma.user.create({
      data: {
        email: `billing-test-${randomUUID()}@example.test`,
        passwordHash: "not-a-real-hash",
        name: "Billing Test",
        role: "CONTRACTOR",
        contractorProfile: { create: { businessName: "Billing Test Co" } },
      },
      include: { contractorProfile: true },
    });
    userId = user.id;
    profileId = user.contractorProfile!.id;
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await prisma.user.delete({ where: { id: userId } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("lists a contractor who subscribes", async () => {
    expect(await isInPublicSearch()).toBe(false);
    await applySubscription(subscription());
    expect(await isInPublicSearch()).toBe(true);
    expect(await listing()).toMatchObject({ status: "ACTIVE", tier: "BASIC", stripeCustomerId: "cus_test" });
  });

  it("lists a contractor during a trial", async () => {
    await applySubscription(subscription({ status: "trialing" }));
    expect(await isInPublicSearch()).toBe(true);
  });

  it("gives Featured to the Featured price", async () => {
    await applySubscription(subscription({ priceId: "price_featured" }));
    expect((await listing())?.tier).toBe("FEATURED");
  });

  it("applies a plan change on the same subscription", async () => {
    const id = `sub_${randomUUID()}`;
    await applySubscription(subscription({ id }));
    await applySubscription(subscription({ id, priceId: "price_featured" }));
    expect((await listing())?.tier).toBe("FEATURED");
    expect(await isInPublicSearch()).toBe(true);
  });

  it.each(["past_due", "unpaid"] as const)("drops a contractor from search when %s", async (status) => {
    const id = `sub_${randomUUID()}`;
    await applySubscription(subscription({ id }));
    await applySubscription(subscription({ id, status }));
    expect(await isInPublicSearch()).toBe(false);
    expect((await listing())?.status).toBe("PAST_DUE");
  });

  it("puts a contractor back once a late payment clears", async () => {
    const id = `sub_${randomUUID()}`;
    await applySubscription(subscription({ id, status: "past_due" }));
    await applySubscription(subscription({ id }));
    expect(await isInPublicSearch()).toBe(true);
  });

  it("drops a contractor from search when the subscription ends", async () => {
    const id = `sub_${randomUUID()}`;
    await applySubscription(subscription({ id }));
    await applySubscription(subscription({ id, status: "canceled" }));
    expect(await isInPublicSearch()).toBe(false);
    expect((await listing())?.status).toBe("CANCELED");
  });

  it("keeps a contractor listed until the paid period ends after they cancel", async () => {
    await applySubscription(subscription({ cancelAtPeriodEnd: true }));
    expect(await isInPublicSearch()).toBe(true);
    expect((await listing())?.cancelAtPeriodEnd).toBe(true);
  });

  it("hides a listing whose paid period ran out even if no webhook arrived", async () => {
    await applySubscription(subscription({ periodEnd: new Date(Date.now() - DAY) }));
    expect((await listing())?.status).toBe("ACTIVE");
    expect(await isInPublicSearch()).toBe(false);
  });

  it("doesn't list a subscription whose first payment hasn't gone through", async () => {
    await applySubscription(subscription({ status: "incomplete" }));
    expect(await isInPublicSearch()).toBe(false);
    expect((await listing())?.status).toBe("INACTIVE");
  });

  it("doesn't let an older subscription ending switch off a newer paid one", async () => {
    const older = `sub_${randomUUID()}`;
    const newer = `sub_${randomUUID()}`;
    await applySubscription(subscription({ id: older }));
    await applySubscription(subscription({ id: newer }));
    await applySubscription(subscription({ id: older, status: "canceled" }));
    expect(await isInPublicSearch()).toBe(true);
    expect((await listing())?.stripeSubscriptionId).toBe(newer);
  });

  it("finds the listing by subscription when the metadata is missing", async () => {
    const id = `sub_${randomUUID()}`;
    await applySubscription(subscription({ id }));
    await applySubscription(subscription({ id, profileId: null, status: "canceled" }));
    expect((await listing())?.status).toBe("CANCELED");
  });

  it("uses the hint from Checkout when the subscription has no metadata", async () => {
    await applySubscription(subscription({ profileId: null }), profileId);
    expect(await isInPublicSearch()).toBe(true);
  });

  it("ignores a subscription it can't match to anyone", async () => {
    await applySubscription(subscription({ profileId: null }));
    expect(await listing()).toBeNull();
  });
});
