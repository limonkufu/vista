"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { ViewType } from "@/types/ViewTypes";
import { useLayout } from "@/contexts/LayoutContext";
import { getViewTypeFromPath } from "@/utils/viewNavigation";
import { NewFeatureBanner } from "@/components/TransitionElements";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";

interface UnifiedDashboardProps {
  children: React.ReactNode;
}

/**
 * A unified container for all dashboard views
 * This wraps the children with appropriate context and layout based on the current view
 */
export function UnifiedDashboard({ children }: UnifiedDashboardProps) {
  const pathname = usePathname();
  const { setActiveView, isViewAvailable, areRoleBasedViewsEnabled } =
    useLayout();
  const [showBanner, setShowBanner] = useState(false);

  // Set the active view based on the current path
  useEffect(() => {
    if (!pathname) return;

    const viewType = getViewTypeFromPath(pathname);

    // Only set the view if it's available
    if (isViewAvailable(viewType)) {
      setActiveView(viewType);
    }
  }, [pathname, setActiveView, isViewAvailable]);

  // Show the new feature banner if role-based views are enabled
  // and we're on the main dashboard page
  useEffect(() => {
    if (!pathname) return;

    const isMainDashboard = pathname === "/dashboard";
    setShowBanner(isMainDashboard && areRoleBasedViewsEnabled);
  }, [pathname, areRoleBasedViewsEnabled]);

  return (
    <DashboardLayout>
      {showBanner && <NewFeatureBanner />}
      {children}
    </DashboardLayout>
  );
}

/**
 * A wrapper specifically for the original dashboard content
 * This adds view suggestions and previews on the main dashboard page
 */
export function OriginalDashboardWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const { areRoleBasedViewsEnabled } = useLayout();

  if (!areRoleBasedViewsEnabled) {
    // If role-based views are not enabled, just render the children
    return <>{children}</>;
  }

  // Otherwise, wrap the children with the original dashboard
  return <div className="original-dashboard-wrapper">{children}</div>;
}
