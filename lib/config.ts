/**
 * Key City Listings product copy, trades, and listing plans.
 * Rename the product or adjust plan labels here — the UI reads this module.
 */

export const site = {
  name: "Key City Listings",
  tagline: "Hire a local trade for your Abilene business.",
  description:
    "Key City Listings connects contractors with small businesses in Abilene, Texas and nearby Big Country towns. Businesses join free. Contractors subscribe to be listed.",
  city: "Abilene",
  region: "Big Country",
  state: "Texas",
} as const;

/**
 * Who runs the site, for the Terms, Privacy and Contact pages. Set BUSINESS_LEGAL_NAME and
 * CONTACT_EMAIL in the environment (render.yaml asks for them), and update policiesUpdated
 * whenever the Terms or Privacy text changes.
 */
export const business = {
  legalName: process.env.BUSINESS_LEGAL_NAME || "Key City Listings",
  contactEmail: process.env.CONTACT_EMAIL || "hello@example.com",
  location: "Abilene, Texas",
  county: "Taylor County, Texas",
  policiesUpdated: "November 4, 2026",
} as const;

export const demoAccounts = {
  password: "keycitylistings",
  customer: {
    email: "nora@elmpinecafe.example",
    label: "Elm & Pine Cafe (business)",
  },
  contractor: {
    email: "mara@redriverelectric.example",
    label: "Red River Electric (contractor)",
  },
} as const;

export const trades = [
  { slug: "electrical", label: "Electrical" },
  { slug: "plumbing", label: "Plumbing" },
  { slug: "hvac", label: "HVAC" },
  { slug: "roofing", label: "Roofing" },
  { slug: "general", label: "General contracting" },
  { slug: "painting", label: "Painting" },
  { slug: "landscaping", label: "Landscaping" },
] as const;

export type TradeSlug = (typeof trades)[number]["slug"];

export const serviceAreas = [
  { label: "Abilene", kind: "city" },
  { label: "Merkel", kind: "city" },
  { label: "Clyde", kind: "city" },
  { label: "Tye", kind: "city" },
  { label: "Buffalo Gap", kind: "city" },
  { label: "Tuscola", kind: "city" },
  { label: "Hawley", kind: "city" },
  { label: "Impact", kind: "city" },
  { label: "Potosi", kind: "city" },
  { label: "79601", kind: "zip" },
  { label: "79602", kind: "zip" },
  { label: "79603", kind: "zip" },
  { label: "79605", kind: "zip" },
  { label: "79606", kind: "zip" },
  { label: "79536", kind: "zip" },
  { label: "79510", kind: "zip" },
  { label: "79563", kind: "zip" },
  { label: "79508", kind: "zip" },
  { label: "79562", kind: "zip" },
  { label: "79525", kind: "zip" },
] as const;

export type AreaKind = (typeof serviceAreas)[number]["kind"];

export const cities = serviceAreas.filter((area) => area.kind === "city");

export const listingPlans = [
  {
    tier: "BASIC",
    name: "Basic",
    price: "$49",
    interval: "month",
    summary: "Show up when a business searches your trade and towns.",
    points: [
      "Public profile in the directory",
      "Included in trade and area filters",
      "Message businesses about open jobs",
    ],
  },
  {
    tier: "FEATURED",
    name: "Featured",
    price: "$99",
    interval: "month",
    summary: "Sort above basic listings and wear a featured mark.",
    points: [
      "Everything in Basic",
      "Featured badge on your profile and cards",
      "Priority placement in search results",
    ],
  },
] as const;

export type ListingTier = (typeof listingPlans)[number]["tier"];

export const listingStatuses = ["INACTIVE", "ACTIVE", "PAST_DUE", "CANCELED"] as const;
export type ListingStatus = (typeof listingStatuses)[number];

export function tradeLabel(slug: string) {
  return trades.find((trade) => trade.slug === slug)?.label ?? slug;
}

export function isTradeSlug(value: string): value is TradeSlug {
  return trades.some((trade) => trade.slug === value);
}

export function isListingTier(value: string): value is ListingTier {
  return listingPlans.some((plan) => plan.tier === value);
}

export function areaKind(label: string): AreaKind | null {
  return serviceAreas.find((area) => area.label === label)?.kind ?? null;
}

export function planByTier(tier: string) {
  return listingPlans.find((plan) => plan.tier === tier) ?? listingPlans[0];
}
