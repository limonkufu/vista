// src/components/layouts/EnhancedNavbar.tsx
"use client";

import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ViewType, DASHBOARD_VIEWS } from "@/types/ViewTypes";
import { useLayout } from "@/contexts/LayoutContext";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import { getRouteForView } from "@/utils/viewNavigation";
import { getViewTypeFromPath } from "@/utils/viewNavigation";
import { LucideIcon } from "lucide-react";

const NavIcon = ({
  icon: Icon,
  className,
}: {
  icon: LucideIcon;
  className?: string;
}) => <Icon className={cn("h-4 w-4", className)} />;

export function EnhancedNavbar() {
  const {
    activeView,
    setActiveView,
    isViewAvailable,
    areRoleBasedViewsEnabled,
  } = useLayout();
  const router = useRouter();
  const pathname = usePathname();

  const isHygienePathActive =
    getViewTypeFromPath(pathname || "") === ViewType.HYGIENE;

  if (!areRoleBasedViewsEnabled) {
    return <Navbar />;
  }

  const availableViews = DASHBOARD_VIEWS.filter((view) =>
    isViewAvailable(view.type)
  );

  const handleViewChange = (viewType: ViewType) => {
    setActiveView(viewType);
    const route = getRouteForView(viewType);
    router.push(route);
  };

  const handleHygieneNavigation = (path: string) => {
    setActiveView(ViewType.HYGIENE);
    router.push(path);
  };

  const tabButtonStyle =
    "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";
  const activeTabStyle = "bg-accent text-accent-foreground shadow";
  const inactiveTabStyle =
    "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground";

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        {/* Logo */}
        <div className="mr-4 flex">
          <Link href="/dashboard" className="flex items-center space-x-2">
            <Logo size="sm" useImage />
            <span className="font-bold">VISTA</span>
          </Link>
        </div>

        {/* View Switcher using Buttons and Dropdown */}
        <div className="flex flex-1 justify-center items-center h-9 rounded-lg bg-muted/50 p-1">
          {availableViews.map((view) =>
            view.type === ViewType.HYGIENE && areRoleBasedViewsEnabled ? (
              <DropdownMenu key={view.type}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className={cn(
                      tabButtonStyle,
                      isHygienePathActive ? activeTabStyle : inactiveTabStyle
                    )}
                    title={view.description}
                  >
                    <NavIcon icon={view.icon} className="mr-2 stroke-current" />
                    {view.label}
                    <ChevronDown className="ml-1 h-4 w-4 opacity-70" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center">
                  <DropdownMenuItem
                    onClick={() =>
                      handleHygieneNavigation("/dashboard/too-old")
                    }
                    className={cn(
                      pathname === "/dashboard/too-old" &&
                        "bg-accent text-accent-foreground"
                    )}
                  >
                    Old MRs
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      handleHygieneNavigation("/dashboard/not-updated")
                    }
                    className={cn(
                      pathname === "/dashboard/not-updated" &&
                        "bg-accent text-accent-foreground"
                    )}
                  >
                    Inactive MRs
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      handleHygieneNavigation("/dashboard/pending-review")
                    }
                    className={cn(
                      pathname === "/dashboard/pending-review" &&
                        "bg-accent text-accent-foreground"
                    )}
                  >
                    Pending Review
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                key={view.type}
                variant="ghost"
                className={cn(
                  tabButtonStyle,
                  activeView === view.type ? activeTabStyle : inactiveTabStyle
                )}
                onClick={() => handleViewChange(view.type)}
                disabled={!isViewAvailable(view.type)}
                title={view.description}
              >
                <NavIcon icon={view.icon} className="mr-2 stroke-current" />
                {view.label}
              </Button>
            )
          )}
        </div>

        {/* User tools */}
        <div className="flex items-center justify-end ml-auto">
          <Navbar.UserTools />
        </div>
      </div>
    </header>
  );
}
