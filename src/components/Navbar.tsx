// File: src/components/Navbar.tsx
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
  Server, // Keep Server icon? Maybe rename item
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { clientCache } from "@/lib/clientCache";
import { toast } from "sonner";
import { cacheManager } from "@/lib/cacheManager"; // Import cacheManager

// Type definition to add static method to the Navbar component
interface NavbarComponent extends React.FC {
  UserTools: React.FC;
}

export const Navbar: NavbarComponent = function Navbar() {
  const pathname = usePathname();

  // Simplified nav items, assuming EnhancedNavbar handles view switching
  const navItems = [{ name: "Dashboard", href: "/dashboard" }];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex">
          <Link href="/dashboard" className="flex items-center space-x-2">
            <span className="font-bold">GitLab MR Dashboard</span>
          </Link>
        </div>
        {/* Basic nav for fallback, EnhancedNavbar will override */}
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
        <Navbar.UserTools />
      </div>
    </header>
  );
};

// Static method to render just the user tools portion
Navbar.UserTools = function NavbarUserTools() {
  return (
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
            onClick={() => {
              try {
                cacheManager.clearAll(); // Use the updated cacheManager method
                toast.success("All relevant caches cleared successfully");
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
            onClick={() => {
              try {
                cacheManager.clearGitLabCache(); // Use the updated cacheManager method
                toast.success("GitLab API cache cleared successfully");
              } catch (error) {
                toast.error("Error clearing GitLab API cache");
                console.error(error);
              }
            }}
          >
            <GitMerge className="mr-2 h-4 w-4" />
            <span>Clear GitLab API cache</span>
          </DropdownMenuItem>

          {/* Removed: Clear API response caches item */}
          {/* Keep Clear Jira API cache */}
          <DropdownMenuItem
            onClick={() => {
              try {
                cacheManager.clearJiraCache(); // Use the updated cacheManager method
                toast.success("Jira API cache cleared successfully");
              } catch (error) {
                toast.error("Error clearing Jira API cache");
                console.error(error);
              }
            }}
          >
            {/* Use a Jira-related icon if available, or keep Server */}
            <Server className="mr-2 h-4 w-4" />
            <span>Clear Jira API cache</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => {
              try {
                cacheManager.clearClientCache(); // Use the updated cacheManager method
                toast.success("Client cache cleared successfully");
              } catch (error) {
                toast.error("Error clearing client cache");
                console.error(error);
              }
            }}
          >
            <Smartphone className="mr-2 h-4 w-4" />
            <span>Clear client cache</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={async () => {
              try {
                // Fetching stats might need adjustment if API route changes
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
  );
};
