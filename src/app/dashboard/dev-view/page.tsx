"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DevView } from "@/components/DevView/DevView";
import { useLayout } from "@/contexts/LayoutContext";
import { ViewType } from "@/types/ViewTypes";
import { FeatureFlags, FeatureFlag } from "@/services/FeatureFlags";

export default function DevViewPage() {
  const router = useRouter();
  const { setActiveView, isViewAvailable } = useLayout();

  useEffect(() => {
    // Set the active view in the layout context
    setActiveView(ViewType.DEV);

    // Redirect if the view is not available
    if (!isViewAvailable(ViewType.DEV)) {
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
    return <div className="p-8">This view is not currently available.</div>;
  }

  return <DevView />;
}
