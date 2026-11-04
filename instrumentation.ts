import type { Instrumentation } from "next";

/** Runs once when the server starts: checks the production settings (see lib/startup-check.ts). */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const { checkProductionConfig } = await import("@/lib/startup-check");
  checkProductionConfig();
}

// At most one alert per error per 10 minutes, so a broken page doesn't flood the channel
const lastAlert = new Map<string, number>();
const ALERT_GAP_MS = 10 * 60 * 1000;

/**
 * Every server error (pages, server actions, route handlers) is written to the log as one JSON
 * line, which Render keeps in the service's Logs tab. With ERROR_ALERT_WEBHOOK_URL set (a Slack or
 * Discord incoming webhook) a short alert is posted too. Request headers are never included: they
 * carry session cookies.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const message = error instanceof Error ? error.message : String(error);
  const digest =
    typeof error === "object" && error !== null && "digest" in error ? String(error.digest) : undefined;
  const path = request.path.split("?")[0];

  console.error(
    JSON.stringify({
      level: "error",
      at: new Date().toISOString(),
      message,
      digest,
      method: request.method,
      path,
      route: context.routePath,
      type: context.routeType,
      stack: error instanceof Error ? error.stack?.split("\n").slice(0, 6).join("\n") : undefined,
    }),
  );

  const webhook = process.env.ERROR_ALERT_WEBHOOK_URL;
  if (!webhook) return;
  const key = `${context.routePath}:${message}`;
  const now = Date.now();
  if (now - (lastAlert.get(key) ?? 0) < ALERT_GAP_MS) return;
  lastAlert.set(key, now);

  const text = `Key City Listings error on ${request.method} ${path} (${context.routeType}): ${message.slice(0, 300)}${digest ? ` [digest ${digest}]` : ""}`;
  try {
    // Slack reads "text" and Discord reads "content"
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, content: text }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // The log line above already has the details
  }
};
