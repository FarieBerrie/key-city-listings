import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";

import { JobForm } from "@/components/job-form";
import { Container, Notice, PageHeading, PageSkeleton } from "@/components/shell";
import { Card, CardContent } from "@/components/ui/card";
import { getSession } from "@/lib/auth";

export const metadata = { title: "Post a job" };
export const instant = false;

export default function NewJobPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NewJob />
    </Suspense>
  );
}

async function NewJob() {
  await connection();
  const session = await getSession();
  if (!session) redirect("/login?next=/jobs/new");
  if (session.role !== "CUSTOMER") {
    return (
      <Container className="max-w-xl">
        <PageHeading title="Post a job" />
        <Notice>
          Job posts are for business accounts.{" "}
          <Link href="/jobs" className="font-medium underline">
            Browse the board
          </Link>{" "}
          if you are a contractor.
        </Notice>
      </Container>
    );
  }

  if (!session.emailVerified) {
    return (
      <Container className="max-w-xl">
        <PageHeading title="Post a job" />
        <Notice tone="warn">
          Confirm your email address before posting a job.{" "}
          <Link href="/verify-email" className="font-medium underline">
            Get a new confirmation link
          </Link>{" "}
          if you can&apos;t find the first one.
        </Notice>
      </Container>
    );
  }

  return (
    <Container className="max-w-2xl">
      <PageHeading
        eyebrow="Free for businesses"
        title="Post a job"
        description="Contractors who work that trade can read this and message you."
      />
      <Card>
        <CardContent>
          <JobForm />
        </CardContent>
      </Card>
    </Container>
  );
}
