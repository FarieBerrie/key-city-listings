import Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/stripe/webhook/route";
import { syncSubscriptionById } from "@/lib/stripe";

vi.mock("@/lib/db", () => ({ prisma: {} }));

// Signature checks run for real. Only the step that talks to Stripe and the database is replaced.
vi.mock("@/lib/stripe", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/stripe")>()),
  syncSubscriptionById: vi.fn(),
}));

const SECRET = "whsec_test_secret";
const sync = vi.mocked(syncSubscriptionById);

function request(payload: string, signature?: string) {
  return new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    body: payload,
    headers: signature ? { "stripe-signature": signature } : {},
  });
}

function signed(event: object, options: { secret?: string; timestamp?: number } = {}) {
  const payload = JSON.stringify(event);
  const { secret = SECRET, timestamp } = options;
  return request(payload, Stripe.webhooks.generateTestHeaderString({ payload, secret, timestamp }));
}

function event(type: string, object: object) {
  return { id: "evt_test", object: "event", type, data: { object } };
}

beforeEach(() => {
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", SECRET);
  sync.mockReset();
  sync.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("who can call the webhook", () => {
  const paid = event("customer.subscription.updated", { id: "sub_1" });

  it("rejects a request with no signature", async () => {
    const response = await POST(request(JSON.stringify(paid)));
    expect(response.status).toBe(400);
    expect(sync).not.toHaveBeenCalled();
  });

  it("rejects a signature made with the wrong secret", async () => {
    const response = await POST(signed(paid, { secret: "whsec_someone_else" }));
    expect(response.status).toBe(400);
    expect(sync).not.toHaveBeenCalled();
  });

  it("rejects a body changed after it was signed", async () => {
    const payload = JSON.stringify(paid);
    const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
    const response = await POST(request(payload.replace("sub_1", "sub_2"), signature));
    expect(response.status).toBe(400);
    expect(sync).not.toHaveBeenCalled();
  });

  it("rejects an old signature replayed later", async () => {
    const timestamp = Math.floor(Date.now() / 1000) - 3600;
    const response = await POST(signed(paid, { timestamp }));
    expect(response.status).toBe(400);
    expect(sync).not.toHaveBeenCalled();
  });

  it("refuses everything when the webhook secret isn't configured", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    const response = await POST(signed(paid));
    expect(response.status).toBe(400);
    expect(sync).not.toHaveBeenCalled();
  });
});

describe("events", () => {
  it("activates a listing when Checkout completes", async () => {
    const response = await POST(
      signed(
        event("checkout.session.completed", {
          mode: "subscription",
          subscription: "sub_1",
          metadata: { contractorProfileId: "profile_1" },
        }),
      ),
    );
    expect(response.status).toBe(200);
    expect(sync).toHaveBeenCalledExactlyOnceWith("sub_1", "profile_1");
  });

  it("handles Checkout sending the subscription as an object", async () => {
    await POST(
      signed(
        event("checkout.session.completed", {
          mode: "subscription",
          subscription: { id: "sub_1" },
          metadata: null,
        }),
      ),
    );
    expect(sync).toHaveBeenCalledExactlyOnceWith("sub_1", undefined);
  });

  it("ignores Checkout sessions that aren't subscriptions", async () => {
    const response = await POST(signed(event("checkout.session.completed", { mode: "payment" })));
    expect(response.status).toBe(200);
    expect(sync).not.toHaveBeenCalled();
  });

  it.each(["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"])(
    "reads the current subscription on %s",
    async (type) => {
      const response = await POST(signed(event(type, { id: "sub_1" })));
      expect(response.status).toBe(200);
      expect(sync).toHaveBeenCalledExactlyOnceWith("sub_1");
    },
  );

  it("updates the listing when a payment fails", async () => {
    const response = await POST(
      signed(
        event("invoice.payment_failed", {
          parent: { subscription_details: { subscription: "sub_1" } },
        }),
      ),
    );
    expect(response.status).toBe(200);
    expect(sync).toHaveBeenCalledExactlyOnceWith("sub_1");
  });

  it("ignores a failed invoice with no subscription", async () => {
    const response = await POST(signed(event("invoice.payment_failed", { parent: null })));
    expect(response.status).toBe(200);
    expect(sync).not.toHaveBeenCalled();
  });

  it("acknowledges events it doesn't use, so Stripe stops resending them", async () => {
    const response = await POST(signed(event("customer.created", { id: "cus_1" })));
    expect(response.status).toBe(200);
    expect(sync).not.toHaveBeenCalled();
  });

  it("fails loudly when the update can't be saved, so Stripe retries it", async () => {
    sync.mockRejectedValue(new Error("database down"));
    await expect(POST(signed(event("customer.subscription.updated", { id: "sub_1" })))).rejects.toThrow(
      "database down",
    );
  });
});
