import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PLACEHOLDER_AUTH_SECRET,
  authSecretProblem,
  demoLoginsEnabled,
  productionConfigProblems,
  stripeConfigured,
} from "@/lib/env";

const goodSecret = "a".repeat(32);

function configureEverything() {
  vi.stubEnv("AUTH_SECRET", goodSecret);
  vi.stubEnv("DATABASE_URL", "postgres://localhost/app");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://example.com");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_x");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_x");
  vi.stubEnv("STRIPE_PRICE_BASIC", "price_basic");
  vi.stubEnv("STRIPE_PRICE_FEATURED", "price_featured");
  vi.stubEnv("CONTACT_EMAIL", "hello@example.com");
  vi.stubEnv("BUSINESS_LEGAL_NAME", "Example LLC");
  vi.stubEnv("RESEND_API_KEY", "re_x");
  vi.stubEnv("EMAIL_FROM", "Example <hello@example.com>");
}

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("RENDER_EXTERNAL_URL", "");
  vi.stubEnv("ENABLE_DEMO_LOGINS", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("authSecretProblem", () => {
  it("rejects a missing secret", () => {
    vi.stubEnv("AUTH_SECRET", "");
    expect(authSecretProblem()).toMatch(/not set/);
  });

  it("rejects the placeholder from .env.example in production", () => {
    vi.stubEnv("AUTH_SECRET", PLACEHOLDER_AUTH_SECRET);
    expect(authSecretProblem()).toMatch(/placeholder/);
  });

  it("rejects a short secret in production", () => {
    vi.stubEnv("AUTH_SECRET", "a".repeat(31));
    expect(authSecretProblem()).toMatch(/at least 32/);
  });

  it("accepts a long random secret", () => {
    vi.stubEnv("AUTH_SECRET", goodSecret);
    expect(authSecretProblem()).toBeNull();
  });

  it("accepts the placeholder outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AUTH_SECRET", PLACEHOLDER_AUTH_SECRET);
    expect(authSecretProblem()).toBeNull();
  });
});

describe("demoLoginsEnabled", () => {
  it("is off in production", () => {
    expect(demoLoginsEnabled()).toBe(false);
  });

  it("needs the explicit override to turn on in production", () => {
    vi.stubEnv("ENABLE_DEMO_LOGINS", "true");
    expect(demoLoginsEnabled()).toBe(true);
  });

  it("is on in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(demoLoginsEnabled()).toBe(true);
  });
});

describe("stripeConfigured", () => {
  it("needs all four values", () => {
    configureEverything();
    expect(stripeConfigured()).toBe(true);
    vi.stubEnv("STRIPE_PRICE_FEATURED", "");
    expect(stripeConfigured()).toBe(false);
  });
});

describe("productionConfigProblems", () => {
  it("reports nothing when everything is set", () => {
    configureEverything();
    expect(productionConfigProblems()).toEqual({ fatal: [], warnings: [] });
  });

  it("stops the server without a usable secret or database", () => {
    configureEverything();
    vi.stubEnv("AUTH_SECRET", PLACEHOLDER_AUTH_SECRET);
    vi.stubEnv("DATABASE_URL", "");
    expect(productionConfigProblems().fatal).toHaveLength(2);
  });

  it("only warns about features that can stay off", () => {
    configureEverything();
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("CONTACT_EMAIL", "");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://example.com");
    const { fatal, warnings } = productionConfigProblems();
    expect(fatal).toEqual([]);
    expect(warnings).toHaveLength(4);
  });

  it("accepts Render's address until a domain is connected", () => {
    configureEverything();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("RENDER_EXTERNAL_URL", "https://key-city-listings.onrender.com");
    expect(productionConfigProblems().warnings).toEqual([]);
  });
});
