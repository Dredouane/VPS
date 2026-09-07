"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { Button } from "@alinea/ui/components/button";
import { cn } from "@alinea/ui/lib/utils";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

const NAV: { href: string; label: string; adminOnly?: boolean }[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/factures", label: "Factures" },
  { href: "/emails", label: "Emails" },
  { href: "/recherche", label: "Recherche" },
  { href: "/admin", label: "Admin", adminOnly: true },
];

export function Shell({
  email,
  role,
  clientNom,
  children,
}: {
  email: string;
  role: string;
  clientNom: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const links = NAV.filter((item) => !item.adminOnly || role === "admin");

  async function logout() {
    await getSupabaseBrowserClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const isActive = (href: string) => pathname.startsWith(href);

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Header mobile + barre commune */}
      <header className="bg-background sticky top-0 z-20 border-b lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="font-semibold">Alinea</span>
          <Button variant="ghost" size="sm" onClick={logout}>
            Quitter
          </Button>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2">
          {links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm whitespace-nowrap",
                isActive(item.href)
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <div className="flex flex-1">
        {/* Sidebar desktop */}
        <aside className="bg-background sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r lg:flex">
          <div className="px-5 py-5">
            <p className="font-semibold">Alinea</p>
            <p className="text-muted-foreground text-xs">
              {clientNom ?? "—"}
            </p>
          </div>
          <nav className="flex flex-1 flex-col gap-1 px-3">
            {links.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-md px-3 py-2 text-sm",
                  isActive(item.href)
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="border-t px-4 py-4 text-xs">
            <p className="truncate font-medium">{email}</p>
            <p className="text-muted-foreground mb-2">{role}</p>
            <Button variant="outline" size="sm" className="w-full" onClick={logout}>
              Déconnexion
            </Button>
          </div>
        </aside>

        <main className="flex-1 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
