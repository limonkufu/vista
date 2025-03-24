"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { UserSelector } from "@/components/UserSelector/UserSelector";
import { ThresholdSettings } from "@/components/ThresholdSettings/ThresholdSettings";

export function Navbar() {
  const pathname = usePathname();

  const navItems = [
    { name: "Dashboard", href: "/dashboard" },
    { name: "Old MRs", href: "/dashboard/too-old" },
    { name: "Inactive MRs", href: "/dashboard/not-updated" },
    { name: "Pending Review", href: "/dashboard/pending-review" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex">
          <Link href="/dashboard" className="flex items-center space-x-2">
            <span className="font-bold">GitLab MR Dashboard</span>
          </Link>
        </div>
        <nav className="flex-1">
          <ul className="flex gap-4">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "text-sm transition-colors hover:text-foreground/80",
                    pathname === item.href
                      ? "text-foreground font-medium"
                      : "text-foreground/60"
                  )}
                >
                  {item.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-2">
          <UserSelector />
          <ThresholdSettings />
          <ThemeSwitcher />
        </div>
      </div>
    </header>
  );
}
