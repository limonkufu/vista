// File: src/components/Navbar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { UserSelector } from "@/components/UserSelector/UserSelector";
// Remove direct import of ThresholdSettings, it will be in a Dialog
// import { ThresholdSettings } from "@/components/ThresholdSettings/ThresholdSettings";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuGroup, // Use Group for better organization
  DropdownMenuLabel, // Use Label for sections
} from "@/components/ui/dropdown-menu";
import {
  Dialog, // Import Dialog components
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Trash,
  BarChart2,
  GitMerge,
  Server,
  Smartphone,
  Settings, // Use Settings icon
} from "lucide-react";
import { Button } from "@/components/ui/button";
// Removed clientCache import as it's handled by cacheManager
// import { clientCache } from "@/lib/clientCache";
import { toast } from "sonner";
import { cacheManager } from "@/lib/cacheManager"; // Import cacheManager
import { ThresholdSettings } from "@/components/ThresholdSettings/ThresholdSettings"; // Keep import for Dialog content
import { Logo } from "@/components/Logo";

// Type definition remains the same
interface NavbarComponent extends React.FC {
  UserTools: React.FC;
}

export const Navbar: NavbarComponent = function Navbar() {
  const pathname = usePathname();
  const navItems = [{ name: "Dashboard", href: "/dashboard" }];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex">
          <Link href="/dashboard" className="flex items-center space-x-2">
            <Logo size="sm" useImage />
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
        <Navbar.UserTools />
      </div>
    </header>
  );
};

// --- Updated UserTools ---
Navbar.UserTools = function NavbarUserTools() {
  return (
    <div className="flex items-center gap-2">
      {/* Keep UserSelector and ThemeSwitcher as primary actions */}
      <UserSelector />
      <ThemeSwitcher />

      {/* Consolidated Settings/Cache Menu */}
      <Dialog>
        {" "}
        {/* Wrap DropdownMenu in Dialog for ThresholdSettings */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" title="Settings & Tools">
              <Settings className="h-4 w-4" />
              <span className="sr-only">Settings & Tools</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {/* Threshold Settings Trigger */}
            <DialogTrigger asChild>
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                <span>Threshold Settings</span>
              </DropdownMenuItem>
            </DialogTrigger>

            <DropdownMenuSeparator />

            {/* Cache Management Group */}
            <DropdownMenuGroup>
              <DropdownMenuLabel>Cache Management</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => {
                  try {
                    cacheManager.clearAll();
                    toast.success("All relevant caches cleared");
                  } catch (error) {
                    toast.error("Error clearing caches");
                    console.error(error);
                  }
                }}
              >
                <Trash className="mr-2 h-4 w-4" />
                <span>Clear All Caches</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  try {
                    cacheManager.clearGitLabCache();
                    toast.success("GitLab API cache cleared");
                  } catch (error) {
                    toast.error("Error clearing GitLab API cache");
                    console.error(error);
                  }
                }}
              >
                <GitMerge className="mr-2 h-4 w-4" />
                <span>Clear GitLab Cache</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  try {
                    cacheManager.clearJiraCache();
                    toast.success("Jira API cache cleared");
                  } catch (error) {
                    toast.error("Error clearing Jira API cache");
                    console.error(error);
                  }
                }}
              >
                <Server className="mr-2 h-4 w-4" />
                <span>Clear Jira Cache</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  try {
                    cacheManager.clearClientCache();
                    toast.success("Client cache cleared");
                  } catch (error) {
                    toast.error("Error clearing client cache");
                    console.error(error);
                  }
                }}
              >
                <Smartphone className="mr-2 h-4 w-4" />
                <span>Clear Client Cache</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={async () => {
                  try {
                    const response = await fetch("/api/cache?details=true"); // Add details flag
                    if (response.ok) {
                      const data = await response.json();
                      console.log("Cache Statistics:", data); // Log full response
                      toast.info(
                        "Cache statistics logged to console (see details property for keys)"
                      );
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
                <span>View Cache Stats</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        {/* Dialog Content for Threshold Settings */}
        <DialogContent className="sm:max-w-[425px]">
          <ThresholdSettings />
        </DialogContent>
      </Dialog>
    </div>
  );
};
