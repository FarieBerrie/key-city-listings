import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { appUrl, getBillingMode, isListingPublic, listingStatusLabel, tierForPriceId } from "@/lib/listing";

const now = new Date("2026-06-15T12:00:00Z");
const tomorrow = new Date("2026-06-16T12:00:00Z");
const yesterday = new Date("2026-06-14T12:00:00Z");

function configureStripe() {
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_x");
  vi.stubEnv("STRIPE_PRICE_BASIC", "price_basic");
  vi.stubEnv("STRIPE_PRICE_FEATURED", "price_featured");
}

beforeEach(() => {
  for (const key of [
    "BILLING_MODE",
    "ALLOW_MOCK_BILLING",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_PRICE_BASIC",
    "STRIPE_PRICE_FEATURED",
    "NEXT_PUBLIC_APP_URL",
    "RENDER_EXTERNAL_URL",
  ]) {
    vi.stubEnv(key, "");
  }
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getBillingMode", () => {
  describe("in production", () => {
    beforeEach(() => {
      vi.stubEnv("NODE_ENV", "production");
    });

    it("never hands out free listings because BILLING_MODE says mock", () => {
      vi.stubEnv("BILLING_MODE", "mock");
      expect(getBillingMode()).toBe("stripe");
    });

    it("stays on Stripe when Stripe isn't configured yet", () => {
      expect(getBillingMode()).toBe("stripe");
    });

    it("allows mock billing only with the staging override", () => {
      vi.stubEnv("BILLING_MODE", "mock");
      vi.stubEnv("ALLOW_MOCK_BILLING", "true");
      expect(getBillingMode()).toBe("mock");
    });
  });

  describe("in development", () => {
    it("uses mock billing when Stripe isn't configured", () => {
      expect(getBillingMode()).toBe("mock");
    });

    it("uses Stripe once every key is set", () => {
      configureStripe();
      expect(getBillingMode()).toBe("stripe");
    });

    it("lets BILLING_MODE choose mock even with Stripe keys present", () => {
      configureStripe();
      vi.stubEnv("BILLING_MODE", "mock");
      expect(getBillingMode()).toBe("mock");
    });

    it("ignores spacing and case in BILLING_MODE", () => {
      vi.stubEnv("BILLING_MODE", " STRIPE ");
      expect(getBillingMode()).toBe("stripe");
    });
  });
});

describe("isListingPublic", () => {
  it("shows an active listing inside its paid period", () => {
    expect(isListingPublic({ status: "ACTIVE", tier: "BASIC", currentPeriodEnd: tomorrow }, now)).toBe(true);
  });

  it("shows an active listing with no end date", () => {
    expect(isListingPublic({ status: "ACTIVE", tier: "BASIC", currentPeriodEnd: null }, now)).toBe(true);
  });

  it("hides an active listing once its paid period has ended", () => {
    expect(isListingPublic({ status: "ACTIVE", tier: "BASIC", currentPeriodEnd: yesterday }, now)).toBe(false);
  });

  it("hides a listing the moment its period ends", () => {
    expect(isListingPublic({ status: "ACTIVE", tier: "BASIC", currentPeriodEnd: now }, now)).toBe(false);
  });

  it.each(["INACTIVE", "PAST_DUE", "CANCELED"])("hides a %s listing even inside its period", (status) => {
    expect(isListingPublic({ status, tier: "BASIC", currentPeriodEnd: tomorrow }, now)).toBe(false);
  });

  it("hides a contractor with no listing", () => {
    expect(isListingPublic(null, now)).toBe(false);
    expect(isListingPublic(undefined, now)).toBe(false);
  });
});

describe("listingStatusLabel", () => {
  it.each([
    [null, "Not listed"],
    [{ status: "INACTIVE", tier: "BASIC", currentPeriodEnd: null }, "Not listed"],
    [{ status: "PAST_DUE", tier: "BASIC", currentPeriodEnd: tomorrow }, "Past due"],
    [{ status: "CANCELED", tier: "FEATURED", currentPeriodEnd: tomorrow }, "Canceled"],
    [{ status: "ACTIVE", tier: "BASIC", currentPeriodEnd: yesterday }, "Expired"],
    [{ status: "ACTIVE", tier: "BASIC", currentPeriodEnd: tomorrow }, "Basic"],
    [{ status: "ACTIVE", tier: "FEATURED", currentPeriodEnd: tomorrow }, "Featured"],
  ])("labels %j as %s", (listing, label) => {
    expect(listingStatusLabel(listing, now)).toBe(label);
  });
});

describe("tierForPriceId", () => {
  beforeEach(configureStripe);

  it("matches the configured Stripe prices", () => {
    expect(tierForPriceId("price_featured", undefined)).toBe("FEATURED");
    expect(tierForPriceId("price_basic", undefined)).toBe("BASIC");
  });

  it("trusts the price over the metadata when they disagree", () => {
    expect(tierForPriceId("price_basic", "FEATURED")).toBe("BASIC");
  });

  it("falls back to the metadata for an unknown price", () => {
    expect(tierForPriceId("price_old", "FEATURED")).toBe("FEATURED");
  });

  it("defaults to Basic rather than giving away Featured", () => {
    expect(tierForPriceId("price_old", "NOT_A_TIER")).toBe("BASIC");
    expect(tierForPriceId(undefined, undefined)).toBe("BASIC");
  });
});

describe("appUrl", () => {
  it("prefers your own domain and drops a trailing slash", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://example.com/");
    vi.stubEnv("RENDER_EXTERNAL_URL", "https://key-city-listings.onrender.com");
    expect(appUrl()).toBe("https://example.com");
  });

  it("falls back to the Render address", () => {
    vi.stubEnv("RENDER_EXTERNAL_URL", "https://key-city-listings.onrender.com");
    expect(appUrl()).toBe("https://key-city-listings.onrender.com");
  });
});
