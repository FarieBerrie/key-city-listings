/**
 * Environment checks shared by the server code and instrumentation.ts (which runs them once at
 * startup, so a production server with a missing secret refuses to start instead of failing on
 * the first request).
 */

export const PLACEHOLDER_AUTH_SECRET = "replace-with-a-long-random-string";
const MIN_SECRET_LENGTH = 32;

export function isProduction() {
  return process.env.NODE_ENV === "production";
}

/** Why AUTH_SECRET can't be used, or null when it's fine. Development accepts any non-empty value. */
export function authSecretProblem(): string | null {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return "AUTH_SECRET is not set. Copy .env.example to .env.";
  if (!isProduction()) return null;
  if (secret === PLACEHOLDER_AUTH_SECRET) return "AUTH_SECRET is still the placeholder from .env.example.";
  if (secret.length < MIN_SECRET_LENGTH) return `AUTH_SECRET must be at least ${MIN_SECRET_LENGTH} characters in production.`;
  return null;
}

/** The "Enter as…" sample-account buttons: development only, unless a demo site opts in. */
export function demoLoginsEnabled() {
  return !isProduction() || process.env.ENABLE_DEMO_LOGINS === "true";
}

export function stripeConfigured() {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_WEBHOOK_SECRET &&
      process.env.STRIPE_PRICE_BASIC &&
      process.env.STRIPE_PRICE_FEATURED,
  );
}

/**
 * What a production server needs. `fatal` stops the server from starting; `warnings` are logged
 * and the affected feature stays off (billing, email) so the rest of the site can still run.
 */
export function productionConfigProblems() {
  const fatal: string[] = [];
  const warnings: string[] = [];
  const secret = authSecretProblem();
  if (secret) fatal.push(secret);
  if (!process.env.DATABASE_URL) fatal.push("DATABASE_URL is not set.");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.RENDER_EXTERNAL_URL || "";
  if (!appUrl.startsWith("https://")) {
    warnings.push("NEXT_PUBLIC_APP_URL should be the site's https:// address (emails and Stripe redirects use it).");
  }
  if (!stripeConfigured()) {
    warnings.push("Stripe is not fully configured, so contractors can't subscribe yet.");
  }
  if (!process.env.CONTACT_EMAIL || !process.env.BUSINESS_LEGAL_NAME) {
    warnings.push("CONTACT_EMAIL or BUSINESS_LEGAL_NAME is not set, so the Terms, Privacy and Contact pages show placeholders.");
  }
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    warnings.push(
      "RESEND_API_KEY or EMAIL_FROM is not set, so no email goes out: new accounts can't confirm their email address, and password resets and message emails aren't sent.",
    );
  }
  return { fatal, warnings };
}
