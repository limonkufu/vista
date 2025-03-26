"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ViewType, DASHBOARD_VIEWS, getViewByType } from "@/types/ViewTypes";
import { useLayout } from "@/contexts/LayoutContext";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";

export function EnhancedNavbar() {
  const {
    activeView,
    setActiveView,
    isViewAvailable,
    areRoleBasedViewsEnabled,
  } = useLayout();
  const pathname = usePathname();

  // Only show the view switcher when role-based views are enabled
  if (!areRoleBasedViewsEnabled) {
    return <Navbar />;
  }

  // Get available views based on feature flags
  const availableViews = DASHBOARD_VIEWS.filter((view) =>
    isViewAvailable(view.type)
  );

  // Handle view change
  const handleViewChange = (value: string) => {
    if (value in ViewType) {
      setActiveView(value as ViewType);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        {/* Logo (same as original) */}
        <div className="mr-4 flex">
          <Link href="/dashboard" className="flex items-center space-x-2">
            <span className="font-bold">GitLab MR Dashboard</span>
          </Link>
        </div>

        {/* View Switcher (new) */}
        <div className="flex-1 flex justify-center">
          <Tabs
            value={activeView}
            onValueChange={handleViewChange}
            className="w-fit"
          >
            <TabsList>
              {availableViews.map((view) => (
                <TabsTrigger
                  key={view.type}
                  value={view.type}
                  disabled={!isViewAvailable(view.type)}
                  title={view.description}
                >
                  {view.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {/* Secondary navigation for current view */}
        {activeView === ViewType.HYGIENE && (
          <nav className="hidden md:flex flex-1 items-center justify-end">
            <ul className="flex gap-4">
              <li>
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className={cn(
                    pathname === "/dashboard/too-old" ? "bg-accent" : ""
                  )}
                >
                  <Link href="/dashboard/too-old">
                    Old MRs
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </li>
              <li>
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className={cn(
                    pathname === "/dashboard/not-updated" ? "bg-accent" : ""
                  )}
                >
                  <Link href="/dashboard/not-updated">
                    Inactive MRs
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </li>
              <li>
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className={cn(
                    pathname === "/dashboard/pending-review" ? "bg-accent" : ""
                  )}
                >
                  <Link href="/dashboard/pending-review">
                    Pending Review
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </li>
            </ul>
          </nav>
        )}

        {/* User tools (from original) */}
        <Navbar.UserTools />
      </div>
    </header>
  );
}
