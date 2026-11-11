import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";

import { confirmEmailAddress, resendVerificationEmail } from "@/app/actions/verify-email";
import { Container, Notice, PageHeading, PageSkeleton } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getSession } from "@/lib/auth";
import { VERIFY_LINK_HOURS, findUsableVerifyToken } from "@/lib/email-verification";
import { firstParam } from "@/lib/format";

export const metadata = { title: "Confirm your email" };
export const instant = false;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function VerifyEmailPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <VerifyContent searchParams={searchParams} />
    </Suspense>
  );
}

async function VerifyContent({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const params = await searchParams;
  const token = firstParam(params.token) ?? "";
  const status = firstParam(params.status);

  // Opened from the email: anyone holding the link can confirm, logged in or not
  if (token) {
    const usable = await findUsableVerifyToken(token);
    return (
      <Container className="max-w-lg">
        <PageHeading eyebrow="Account" title="Confirm your email" />
        <Card>
          <CardContent className="grid gap-4">
            {usable ? (
              <form action={confirmEmailAddress} className="grid gap-4">
                <input type="hidden" name="token" value={token} />
                <p className="text-sm">One click and you&apos;re done.</p>
                <Button type="submit" className="h-10">
                  Confirm my email
                </Button>
              </form>
            ) : (
              <p className="text-sm">
                This link has expired or was already used.{" "}
                <Link href="/verify-email" className="font-medium text-primary hover:underline">
                  Get a new one
                </Link>
                .
              </p>
            )}
          </CardContent>
        </Card>
      </Container>
    );
  }

  const session = await getSession();
  if (!session) {
    if (status !== "confirmed") redirect("/login?next=/verify-email");
    return (
      <Container className="max-w-lg">
        <PageHeading eyebrow="Account" title="Email confirmed" />
        <Notice tone="ok">
          Thanks, your email address is confirmed.{" "}
          <Link href="/login" className="font-medium underline">
            Log in
          </Link>{" "}
          to carry on.
        </Notice>
      </Container>
    );
  }

  if (session.emailVerified) {
    return (
      <Container className="max-w-lg">
        <PageHeading eyebrow="Account" title="Email confirmed" />
        <Notice tone="ok">
          {status === "confirmed" ? "Thanks, your" : "Your"} email address is confirmed. You can post jobs, send
          messages and list your business.{" "}
          <Link href="/dashboard" className="font-medium underline">
            Go to your dashboard
          </Link>
          .
        </Notice>
      </Container>
    );
  }

  return (
    <Container className="max-w-lg">
      <PageHeading eyebrow="Account" title="Confirm your email" />
      <div className="mb-4 grid gap-3">
        {status === "sent" ? <Notice tone="ok">We sent a new link. Only the newest one works.</Notice> : null}
        {status === "limited" ? (
          <Notice tone="warn">You&apos;ve asked for several links in the last hour. Please try again later.</Notice>
        ) : null}
        {status === "invalid" ? (
          <Notice tone="warn">That link has expired or was already used. Send yourself a new one below.</Notice>
        ) : null}
      </div>
      <Card>
        <CardContent className="grid gap-4 text-sm">
          <p>
            We emailed a confirmation link to <span className="font-medium wrap-break-word">{session.email}</span>. It
            expires {VERIFY_LINK_HOURS} hours after it was sent.
          </p>
          <p className="text-muted-foreground">
            Until you confirm, you can look around and fill in your profile, but you can&apos;t post jobs, send
            messages or subscribe to a listing. If the email isn&apos;t in your inbox, check your spam folder.
          </p>
          <form action={resendVerificationEmail}>
            <Button type="submit" variant="outline" className="h-10 bg-card">
              Send a new link
            </Button>
          </form>
        </CardContent>
      </Card>
    </Container>
  );
}
