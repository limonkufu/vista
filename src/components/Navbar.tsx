"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { UserSelector } from "@/components/UserSelector/UserSelector";
import { ThresholdSettings } from "@/components/ThresholdSettings/ThresholdSettings";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Trash,
  Database,
  BarChart2,
  GitMerge,
  Server,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { clientCache } from "@/lib/clientCache";
import { toast } from "sonner";


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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" title="Cache options">
                <Database className="h-4 w-4" />
                <span className="sr-only">Cache options</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={async () => {
                  try {
                    const response = await fetch("/api/cache", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({ action: "clear_all" }),
                    });

                    if (response.ok) {
                      toast.success("All caches cleared successfully");
                    } else {
                      toast.error("Failed to clear caches");
                    }
                  } catch (error) {
                    toast.error("Error clearing caches");
                    console.error(error);
                  }
                }}
              >
                <Trash className="mr-2 h-4 w-4" />
                <span>Clear all caches</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={async () => {
                  try {
                    const response = await fetch("/api/cache", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({ action: "clear_gitlab_api" }),
                    });

                    if (response.ok) {
                      toast.success("GitLab API cache cleared successfully");
                    } else {
                      toast.error("Failed to clear GitLab API cache");
                    }
                  } catch (error) {
                    toast.error("Error clearing GitLab API cache");
                    console.error(error);
                  }
                }}
              >
                <GitMerge className="mr-2 h-4 w-4" />
                <span>Clear GitLab API cache</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={async () => {
                  try {
                    const response = await fetch("/api/cache", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({ action: "clear_api_responses" }),
                    });

                    if (response.ok) {
                      toast.success("API response caches cleared successfully");
                    } else {
                      toast.error("Failed to clear API response caches");
                    }
                  } catch (error) {
                    toast.error("Error clearing API response caches");
                    console.error(error);
                  }
                }}
              >
                <Server className="mr-2 h-4 w-4" />
                <span>Clear API response caches</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => {
                  clientCache.clear();
                  toast.success("Client cache cleared successfully");
                }}
              >
                <Smartphone className="mr-2 h-4 w-4" />
                <span>Clear client cache</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={async () => {
                  try {
                    const response = await fetch("/api/cache");

                    if (response.ok) {
                      const data = await response.json();
                      console.log("Cache Statistics:", data.stats);
                      toast.info("Cache statistics logged to console");
                    } else {
                      toast.error("Failed to fetch cache statistics");
                    }
                  } catch (error) {
                    toast.error("Error fetching cache statistics");
                    console.error(error);
                  }
                }}
              >
                <BarChart2 className="mr-2 h-4 w-4" />
                <span>View cache statistics</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
