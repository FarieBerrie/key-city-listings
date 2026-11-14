"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { getSession } from "@/lib/auth";
import { isListingTier, type ListingTier } from "@/lib/config";
import { prisma } from "@/lib/db";
import { appUrl, getBillingMode, priceIdForTier } from "@/lib/listing";
import { getStripe, hasLiveSubscription } from "@/lib/stripe";

async function requireContractor() {
  const session = await getSession();
  if (!session) redirect("/login?next=/billing");
  if (session.role !== "CONTRACTOR") redirect("/dashboard");
  const profile = await prisma.contractorProfile.findUnique({
    where: { userId: session.id },
    include: { listing: true },
  });
  if (!profile) redirect("/profile");
  return { session, profile };
}

export async function startCheckout(formData: FormData) {
  const tierValue = String(formData.get("tier") ?? "");
  if (!isListingTier(tierValue)) redirect("/billing");
  const tier: ListingTier = tierValue;
  if (getBillingMode() !== "stripe") redirect("/billing");

  const { session, profile } = await requireContractor();
  if (!session.emailVerified) redirect("/verify-email");
  // A second Checkout would start a second subscription and bill twice. Changing plans on a live
  // subscription happens in Stripe's customer portal instead.
  if (hasLiveSubscription(profile.listing)) await redirectToPortal(profile.listing?.stripeCustomerId);
  const price = priceIdForTier(tier);
  if (!price || !process.env.STRIPE_SECRET_KEY) {
    redirect("/billing?checkout=missing-keys");
  }

  const stripe = getStripe();
  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: profile.listing?.stripeCustomerId || undefined,
    customer_email: profile.listing?.stripeCustomerId ? undefined : session.email,
    line_items: [{ price, quantity: 1 }],
    success_url: `${appUrl()}/billing?checkout=success`,
    cancel_url: `${appUrl()}/billing?checkout=cancel`,
    client_reference_id: profile.id,
    metadata: { contractorProfileId: profile.id, tier },
    subscription_data: {
      metadata: { contractorProfileId: profile.id, tier },
    },
    allow_promotion_codes: true,
  });

  if (!checkout.url) redirect("/billing?checkout=missing-keys");
  redirect(checkout.url);
}

/**
 * Stripe's customer portal: change plan, update the card, see invoices, or cancel. The portal
 * has to be set up once in the Stripe dashboard (Settings > Billing > Customer portal).
 */
async function redirectToPortal(customerId: string | null | undefined): Promise<never> {
  if (!customerId || !process.env.STRIPE_SECRET_KEY) redirect("/billing");
  let url: string;
  try {
    const portal = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl()}/billing`,
    });
    url = portal.url;
  } catch (error) {
    console.error("[billing] Could not open the customer portal:", error);
    redirect("/billing?portal=unavailable");
  }
  redirect(url);
}

export async function openBillingPortal() {
  if (getBillingMode() !== "stripe") redirect("/billing");
  const { profile } = await requireContractor();
  await redirectToPortal(profile.listing?.stripeCustomerId);
}

export async function setMockListing(formData: FormData) {
  if (getBillingMode() !== "mock") redirect("/billing");
  const { session, profile } = await requireContractor();
  if (!session.emailVerified) redirect("/verify-email");
  const active = formData.get("active") === "1";
  const tierValue = String(formData.get("tier") ?? "BASIC");
  const tier: ListingTier = isListingTier(tierValue) ? tierValue : "BASIC";
  const periodEnd = new Date();
  periodEnd.setDate(periodEnd.getDate() + 30);

  await prisma.listing.upsert({
    where: { contractorProfileId: profile.id },
    create: {
      contractorProfileId: profile.id,
      tier,
      status: active ? "ACTIVE" : "INACTIVE",
      currentPeriodEnd: active ? periodEnd : null,
      activatedAt: active ? new Date() : null,
    },
    update: {
      tier: active ? tier : profile.listing?.tier ?? "BASIC",
      status: active ? "ACTIVE" : "CANCELED",
      currentPeriodEnd: active ? periodEnd : new Date(),
      activatedAt: active ? new Date() : profile.listing?.activatedAt,
      stripeSubscriptionId: null,
    },
  });

  revalidatePath("/billing");
  revalidatePath("/dashboard");
  revalidatePath("/contractors");
  revalidatePath(`/contractors/${profile.id}`);
  redirect(active ? "/billing?listing=active" : "/billing?listing=inactive");
}
