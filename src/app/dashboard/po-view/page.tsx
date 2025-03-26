"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { POView } from "@/components/POView/POView";
import { useLayout } from "@/contexts/LayoutContext";
import { ViewType } from "@/types/ViewTypes";
import { FeatureFlags, FeatureFlag } from "@/services/FeatureFlags";
import { logger } from "@/lib/logger";

export default function POViewPage() {
  const router = useRouter();
  const { setActiveView, isViewAvailable } = useLayout();

  useEffect(() => {
    // Set the active view in the layout context
    setActiveView(ViewType.PO);
    logger.info("Initialized PO view", {}, "POView");

    // Redirect if the view is not available
    if (!isViewAvailable(ViewType.PO)) {
      logger.warn(
        "PO view not available, redirecting to dashboard",
        {},
        "POView"
      );
      router.push("/dashboard");
    }
  }, [setActiveView, isViewAvailable, router]);

  // Check both feature flags
  const isPOViewEnabled = FeatureFlags.isEnabled(FeatureFlag.PO_VIEW);
  const areRoleBasedViewsEnabled = FeatureFlags.isEnabled(
    FeatureFlag.ROLE_BASED_VIEWS
  );

  // If feature is not enabled, show a message (should be redirected by useEffect)
  if (!isPOViewEnabled || !areRoleBasedViewsEnabled) {
    logger.warn(
      "PO view feature flags disabled",
      {
        isPOViewEnabled,
        areRoleBasedViewsEnabled,
      },
      "POView"
    );
    return (
      <div className="space-y-6">This view is not currently available.</div>
    );
  }

  return <POView />;
}
