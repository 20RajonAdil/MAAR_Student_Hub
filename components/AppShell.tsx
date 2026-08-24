"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  MessagesSquare,
  NotebookPen,
  FolderOpen,
  Target,
  FileStack,
  TrendingUp,
  Timer,
  Settings,
} from "lucide-react";
import clsx from "clsx";
import { useStore } from "@/lib/store";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/subjects", label: "Subjects", icon: BookOpen },
  { href: "/tutor", label: "AI Tutor", icon: MessagesSquare },
  { href: "/notes", label: "Notes", icon: NotebookPen },
  { href: "/resources", label: "Resources", icon: FolderOpen },
  { href: "/practice", label: "Practice", icon: Target },
  { href: "/past-papers", label: "Past Papers", icon: FileStack },
  { href: "/progress", label: "Progress", icon: TrendingUp },
  { href: "/coach", label: "Study Coach", icon: Timer },
  { href: "/settings", label: "Settings", icon: Settings },
];

// Mobile shows a compact bottom nav with the highest-value destinations.
const MOBILE_NAV = NAV.filter((n) => ["/dashboard", "/subjects", "/tutor", "/practice", "/settings"].includes(n.href));

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const profile = useStore((s) => s.profile);

  return (
    <div className="min-h-screen bg-[var(--color-paper)] md:flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-60 md:flex-col md:border-r md:border-[var(--color-line)] md:px-4 md:py-6">
        <Link href="/dashboard" className="mb-8 flex items-center gap-2 px-2">
          <span className="font-display text-xl font-semibold">MAAR</span>
          <span className="rounded-full bg-[var(--color-primary-dim)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-primary)]">
            Study Hub
          </span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((item) => {
            const active = pathname?.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14.5px] font-medium transition-colors",
                  active
                    ? "bg-[var(--color-primary-dim)] text-[var(--color-primary)]"
                    : "text-[var(--color-ink-soft)] hover:bg-black/5 hover:text-[var(--color-ink)]"
                )}
              >
                <Icon size={18} strokeWidth={2} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        {profile && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-[var(--color-line)] px-3 py-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary)] text-sm font-semibold text-white">
              {profile.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{profile.name}</p>
              <p className="truncate text-xs text-[var(--color-ink-faint)]">{profile.yearOrGroup}</p>
            </div>
          </div>
        )}
      </aside>

      {/* Mobile top bar */}
      <header className="flex items-center justify-between border-b border-[var(--color-line)] px-4 py-3 md:hidden">
        <Link href="/dashboard" className="font-display text-lg font-semibold">
          MAAR Study Hub
        </Link>
        {profile && (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary)] text-sm font-semibold text-white">
            {profile.name.slice(0, 1).toUpperCase()}
          </div>
        )}
      </header>

      <main className="flex-1 pb-20 md:pb-0">{children}</main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-[var(--color-line)] bg-[var(--color-paper-raised)]/95 backdrop-blur md:hidden">
        {MOBILE_NAV.map((item) => {
          const active = pathname?.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium",
                active ? "text-[var(--color-primary)]" : "text-[var(--color-ink-faint)]"
              )}
            >
              <Icon size={20} strokeWidth={active ? 2.4 : 2} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
