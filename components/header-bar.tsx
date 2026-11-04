"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu } from "lucide-react";

import { logout } from "@/app/actions/auth";
import { Button, buttonVariants } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { site } from "@/lib/config";
import { cn } from "cn";

type HeaderUser = { name: string; role: "CONTRACTOR" | "CUSTOMER" } | null;

const linkClass = "rounded-lg px-3 py-2 text-sm hover:bg-muted";

export function HeaderBar({ user, unread }: { user: HeaderUser; unread: number }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-cream/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="font-heading text-xl tracking-tight">{site.name}</span>
          <span className="hidden text-xs text-muted-foreground sm:inline">{site.city}</span>
        </Link>
        <nav className="hidden items-center gap-1 lg:flex">
          <NavLinks user={user} unread={unread} />
        </nav>
        <div className="lg:hidden">
          <Sheet>
            <SheetTrigger
              aria-label="Open menu"
              className={cn(buttonVariants({ variant: "outline", size: "icon" }), "bg-card")}
            >
              <Menu />
            </SheetTrigger>
            <SheetContent side="right" className="w-72 bg-cream">
              <SheetHeader>
                <SheetTitle className="font-heading text-xl">{site.name}</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-1 px-4">
                <NavLinks user={user} unread={unread} mobile />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

function NavLinks({
  user,
  unread,
  mobile = false,
}: {
  user: HeaderUser;
  unread: number;
  mobile?: boolean;
}) {
  const Item = mobile ? MobileLink : DesktopLink;
  return (
    <>
      <Item href="/contractors">Find contractors</Item>
      <Item href="/jobs">Job board</Item>
      {user ? <Item href="/messages">Messages <UnreadCount initial={unread} /></Item> : null}
      {user ? <Item href="/dashboard">Dashboard</Item> : null}
      {user?.role === "CONTRACTOR" ? <Item href="/billing">Listing</Item> : null}
      {user ? <Item href="/profile">Profile</Item> : null}
      {user ? (
        <form action={logout}>
          <Button type="submit" variant="ghost" className="h-9 px-3">
            Log out
          </Button>
        </form>
      ) : (
        <>
          <Item href="/login">Log in</Item>
          <Link
            href="/signup"
            className={cn(buttonVariants({}), "h-9 px-3", mobile && "mt-2")}
          >
            Sign up
          </Link>
        </>
      )}
    </>
  );
}

function DesktopLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={cn(linkClass, "inline-flex items-center")}>
      {children}
    </Link>
  );
}

function MobileLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <SheetClose render={<Link href={href} className={cn(linkClass, "flex items-center")} />}>{children}</SheetClose>
  );
}

function UnreadCount({ initial }: { initial: number }) {
  const [seenInitial, setSeenInitial] = useState(initial);
  const [polled, setPolled] = useState<number | null>(null);
  if (seenInitial !== initial) {
    setSeenInitial(initial);
    setPolled(null);
  }
  const count = polled ?? initial;

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const response = await fetch("/api/unread", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { count?: number };
        if (!cancelled && typeof data.count === "number") setPolled(data.count);
      } catch {
        // Polling is a convenience. The next page load still shows the right count.
      }
    };
    const id = window.setInterval(tick, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  if (count <= 0) return null;
  return (
    <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-clay px-1.5 text-[11px] font-semibold text-white">
      {count}
    </span>
  );
}
