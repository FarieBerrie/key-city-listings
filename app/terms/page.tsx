import Link from "next/link";

import { ContactLink, LegalPage, Section } from "@/components/legal";
import { business, listingPlans, site } from "@/lib/config";

export const metadata = { title: "Terms of Service" };

export default function TermsPage() {
  const plans = listingPlans.map((plan) => `${plan.name} (${plan.price} a ${plan.interval})`).join(" and ");
  return (
    <LegalPage title="Terms of Service">
      <p>
        These terms are an agreement between you and {business.legalName} (&ldquo;we&rdquo;, &ldquo;us&rdquo;),
        which runs {site.name}. By creating an account or using the site, you agree to them. If you don&apos;t
        agree, please don&apos;t use {site.name}.
      </p>

      <Section title="What Key City Listings is">
        <p>
          {site.name} is a local directory and job board that helps businesses in and around {business.location}{" "}
          find independent contractors. We are not a contractor, we don&apos;t employ the contractors listed here,
          and we are not part of any agreement a business makes with a contractor. We don&apos;t check licenses,
          insurance, references or the quality of anyone&apos;s work, and a listing is not a recommendation.
        </p>
      </Section>

      <Section title="Your account">
        <ul>
          <li>You must be at least 18 and able to enter a contract on behalf of yourself or your business.</li>
          <li>Give accurate information and keep it up to date.</li>
          <li>Keep your password private. You&apos;re responsible for what happens under your account.</li>
          <li>Tell us right away at <ContactLink /> if you think someone else has used your account.</li>
        </ul>
      </Section>

      <Section title="Businesses">
        <p>
          Business accounts are free. Describe jobs honestly. Before hiring anyone, check their license, insurance and
          references yourself. Prices, schedules, payment and the work itself are between you and the contractor.
        </p>
      </Section>

      <Section title="Contractors">
        <p>
          Keep your profile accurate, including what you say about licensing and insurance. You&apos;re responsible
          for holding any license, permit or insurance your work requires, and for following the law.
        </p>
      </Section>

      <Section title="Listing subscriptions">
        <ul>
          <li>
            A contractor profile appears in the public directory while it has an active listing subscription. The
            plans are {plans}, plus any sales tax that applies.
          </li>
          <li>
            Subscriptions are paid in advance each month through our payment processor, Stripe, and renew
            automatically until you cancel.
          </li>
          <li>
            You can cancel at any time from the <Link href="/billing">Listing</Link> page (Manage subscription).
            Cancelling stops future charges; your listing stays up until the end of the month you&apos;ve already
            paid for.
          </li>
          <li>
            We don&apos;t refund partial months, except where the law requires it or we charged you by mistake. If you
            think a charge is wrong, contact us at <ContactLink />.
          </li>
          <li>
            If a payment fails, your listing leaves the directory until the payment goes through.
          </li>
          <li>
            We may change prices. We&apos;ll email you at least 30 days before a new price applies to your
            subscription, so you can cancel first if you prefer.
          </li>
        </ul>
      </Section>

      <Section title="Messages and content">
        <p>
          You own what you post (profiles, job requests and messages). You give us permission to store and show it
          as needed to run {site.name}. Don&apos;t post anything unlawful, false, harassing, hateful or spam, or
          anything you don&apos;t have the right to share. We may remove content or suspend accounts that break
          these terms.
        </p>
      </Section>

      <Section title="Things you may not do">
        <ul>
          <li>Pretend to be someone else, or post jobs or listings that aren&apos;t real.</li>
          <li>Send unsolicited advertising or bulk messages.</li>
          <li>Copy the directory in bulk, scrape the site, or use automated tools to access it.</li>
          <li>Try to get around the site&apos;s security or rate limits, or interfere with how it runs.</li>
        </ul>
      </Section>

      <Section title="Disagreements between users">
        <p>
          Any dispute about a job is between the business and the contractor. We may try to help, but we
          aren&apos;t obliged to, and we aren&apos;t responsible for the outcome.
        </p>
      </Section>

      <Section title="No warranties">
        <p>
          {site.name} is provided &ldquo;as is&rdquo;. To the fullest extent the law allows, we make no promises
          that it will be available without interruption or free of errors, or about any contractor, business, job
          or piece of work found through it.
        </p>
      </Section>

      <Section title="Limits on our liability">
        <p>
          To the fullest extent the law allows, we aren&apos;t liable for indirect, incidental or consequential
          losses, lost profits, or anything arising from work arranged through the site. Our total liability to you
          for any claim is limited to the amount you paid us in the 12 months before the claim, or $100 if you
          haven&apos;t paid us anything.
        </p>
      </Section>

      <Section title="Ending your account">
        <p>
          You can close your account at any time by emailing <ContactLink />; cancel any listing subscription first.
          We may suspend or close accounts that break these terms.
        </p>
      </Section>

      <Section title="Changes and governing law">
        <p>
          We may update these terms. We&apos;ll post the new version here and change the date at the top, and
          we&apos;ll email account holders about significant changes. These terms are governed by the laws of
          Texas, and any dispute will be handled by the state or federal courts in {business.county}.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions about these terms: <ContactLink />.
        </p>
      </Section>
    </LegalPage>
  );
}
