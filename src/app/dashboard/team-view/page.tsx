"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { TeamView } from "@/components/TeamView/TeamView";
import { useLayout } from "@/contexts/LayoutContext";
import { ViewType } from "@/types/ViewTypes";
import { FeatureFlags, FeatureFlag } from "@/services/FeatureFlags";

export default function TeamViewPage() {
  const router = useRouter();
  const { setActiveView, isViewAvailable } = useLayout();

  useEffect(() => {
    // Set the active view in the layout context
    setActiveView(ViewType.TEAM);

    // Redirect if the view is not available
    if (!isViewAvailable(ViewType.TEAM)) {
      router.push("/dashboard");
    }
  }, [setActiveView, isViewAvailable, router]);

  // Check both feature flags
  const isTeamViewEnabled = FeatureFlags.isEnabled(FeatureFlag.TEAM_VIEW);
  const areRoleBasedViewsEnabled = FeatureFlags.isEnabled(
    FeatureFlag.ROLE_BASED_VIEWS
  );

  // If feature is not enabled, show a message (should be redirected by useEffect)
  if (!isTeamViewEnabled || !areRoleBasedViewsEnabled) {
    return (
      <div className="space-y-6">This view is not currently available.</div>
    );
  }

  return <TeamView />;
}
