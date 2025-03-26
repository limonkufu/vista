"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DevView } from "@/components/DevView/DevView";
import { useLayout } from "@/contexts/LayoutContext";
import { ViewType } from "@/types/ViewTypes";
import { FeatureFlags, FeatureFlag } from "@/services/FeatureFlags";
import { logger } from "@/lib/logger";

export default function DevViewPage() {
  const router = useRouter();
  const { setActiveView, isViewAvailable } = useLayout();

  useEffect(() => {
    // Set the active view in the layout context
    setActiveView(ViewType.DEV);
    logger.info("Initialized Dev view", {}, "DevView");

    // Redirect if the view is not available
    if (!isViewAvailable(ViewType.DEV)) {
      logger.warn(
        "Dev view not available, redirecting to dashboard",
        {},
        "DevView"
      );
      router.push("/dashboard");
    }
  }, [setActiveView, isViewAvailable, router]);

  // Check both feature flags
  const isDevViewEnabled = FeatureFlags.isEnabled(FeatureFlag.DEV_VIEW);
  const areRoleBasedViewsEnabled = FeatureFlags.isEnabled(
    FeatureFlag.ROLE_BASED_VIEWS
  );

  // If feature is not enabled, show a message (should be redirected by useEffect)
  if (!isDevViewEnabled || !areRoleBasedViewsEnabled) {
    logger.warn(
      "Dev view feature flags disabled",
      {
        isDevViewEnabled,
        areRoleBasedViewsEnabled,
      },
      "DevView"
    );
    return (
      <div className="space-y-6">This view is not currently available.</div>
    );
  }

  return <DevView />;
}
