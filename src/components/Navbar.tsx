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
  LayoutDashboard,
  Users,
  UserCog,
  ClipboardList,
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

const NavIcon = ({
  icon: Icon,
  className,
}: {
  icon: typeof Settings;
  className?: string;
}) => <Icon className={cn("h-4 w-4", className)} />;

export const Navbar: NavbarComponent = function Navbar() {
  const pathname = usePathname();

  const navItems = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      name: "Hygiene",
      href: "/dashboard/hygiene",
      icon: ClipboardList,
    },
    {
      name: "PO View",
      href: "/dashboard/po-view",
      icon: UserCog,
    },
    {
      name: "Dev View",
      href: "/dashboard/dev-view",
      icon: GitMerge,
    },
    {
      name: "Team View",
      href: "/dashboard/team-view",
      icon: Users,
    },
  ];

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
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "text-sm transition-colors flex items-center gap-2 px-2 py-1 rounded-md",
                      isActive
                        ? "text-foreground font-medium bg-primary/10"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    )}
                  >
                    <NavIcon
                      icon={item.icon}
                      className="shrink-0 stroke-current"
                    />
                    <span>{item.name}</span>
                  </Link>
                </li>
              );
            })}
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
      <UserSelector />
      <ThemeSwitcher />
      <Dialog>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" title="Settings & Tools">
              <NavIcon icon={Settings} className="stroke-current" />
              <span className="sr-only">Settings & Tools</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DialogTrigger asChild>
              <DropdownMenuItem>
                <NavIcon icon={Settings} className="mr-2 stroke-current" />
                <span>Threshold Settings</span>
              </DropdownMenuItem>
            </DialogTrigger>

            <DropdownMenuSeparator />

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
                <NavIcon icon={Trash} className="mr-2 stroke-current" />
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
                <NavIcon icon={GitMerge} className="mr-2 stroke-current" />
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
                <NavIcon icon={Server} className="mr-2 stroke-current" />
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
                <NavIcon icon={Smartphone} className="mr-2 stroke-current" />
                <span>Clear Client Cache</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={async () => {
                  try {
                    const response = await fetch("/api/cache?details=true");
                    if (response.ok) {
                      const data = await response.json();
                      console.log("Cache Statistics:", data);
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
                <NavIcon icon={BarChart2} className="mr-2 stroke-current" />
                <span>View Cache Stats</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <DialogContent className="sm:max-w-[425px]">
          <ThresholdSettings />
        </DialogContent>
      </Dialog>
    </div>
  );
};
