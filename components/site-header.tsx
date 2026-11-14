import Link from "next/link";
import { connection } from "next/server";

import { HeaderBar } from "@/components/header-bar";
import { getSession } from "@/lib/auth";
import { unreadCount } from "@/lib/queries";

export async function SiteHeader() {
  await connection();
  const session = await getSession();
  const unread = session ? await unreadCount(session.id) : 0;
  return (
    <>
      <HeaderBar user={session ? { name: session.name, role: session.role } : null} unread={unread} />
      {session && !session.emailVerified ? (
        <div className="border-b border-clay/30 bg-clay/10">
          <p className="mx-auto w-full max-w-6xl px-4 py-2 text-sm sm:px-6">
            Confirm your email to post jobs, send messages and list your business. We sent a link to{" "}
            <span className="font-medium wrap-break-word">{session.email}</span>.{" "}
            <Link href="/verify-email" className="font-medium underline">
              Get a new link
            </Link>
          </p>
        </div>
      ) : null}
    </>
  );
}

export function HeaderFallback() {
  return <div className="h-16 border-b border-border/80 bg-cream/90" />;
}
