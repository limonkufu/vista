"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getThresholds } from "@/lib/config";
import { ViewType } from "@/types/ViewTypes";
import { FeatureFlags, FeatureFlag } from "@/services/FeatureFlags";
import { useLayout } from "@/contexts/LayoutContext";
import {
  UnifiedDashboard,
  OriginalDashboardWrapper,
} from "@/components/UnifiedDashboard";
import { ViewPreviewCard } from "@/components/TransitionElements";
import { Logo } from "@/components/Logo";

export default function DashboardPage() {
  const thresholds = getThresholds();
  const { areRoleBasedViewsEnabled, isViewAvailable } = useLayout();
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Ensure client-side initialization is complete
    setIsLoaded(true);
  }, []);

  // Content for view preview cards
  const renderPOViewPreview = () => (
    <div className="text-center text-muted-foreground">
      <p>
        View merge requests organized by Jira tickets for better PO visibility.
      </p>
    </div>
  );

  const renderDevViewPreview = () => (
    <div className="text-center text-muted-foreground">
      <p>Focus on MRs that need your attention as a developer.</p>
    </div>
  );

  const renderTeamViewPreview = () => (
    <div className="text-center text-muted-foreground">
      <p>Get a team-wide perspective with aggregated metrics.</p>
    </div>
  );

  // If not loaded yet, show minimal content to avoid hydration errors
  if (!isLoaded) {
    return (
      <div className="container py-8 space-y-8">
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <Logo size="lg" useImage />
          <p className="text-xl text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <UnifiedDashboard>
      <OriginalDashboardWrapper>
        <div className="relative">
          {/* Hero Section */}
          <div className="relative overflow-hidden bg-background">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-accent/5" />
            <div className="absolute inset-0 bg-grid-pattern opacity-5" />
            <div className="container relative py-20">
              <div className="max-w-3xl mx-auto text-center space-y-6">
                <h2 className="text-2xl font-semibold text-muted-foreground">
                  Vibe Into Software Tasks & Activities
                </h2>
                <p className="text-lg text-muted-foreground">
                  Transform your workflow with context-aware project management
                </p>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="container py-8 space-y-8">
            <div className="max-w-3xl mx-auto">
              <div className="bg-card rounded-lg p-6 mb-8 shadow-sm border">
                <h2 className="text-2xl font-semibold mb-4">
                  Transform Your Workflow
                </h2>
                <p className="text-lg leading-relaxed mb-4">
                  VISTA is a context-aware work management dashboard that
                  transforms traditional project tracking into an intuitive,
                  vibe-based experience.
                </p>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-semibold mb-2">Core Functionality</h3>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li>Seamless Jira and GitLab integration</li>
                      <li>Customized views for all roles</li>
                      <li>Team momentum visualization</li>
                      <li>Smart work item connections</li>
                      <li>Organic technical debt tracking</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Key Features</h3>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li>Vibe Pulse™ real-time metrics</li>
                      <li>AI-powered context mapping</li>
                      <li>Adaptive Flow Zones</li>
                      <li>Tech Debt Radar</li>
                      <li>Team Resonance analytics</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Old Merge Requests</CardTitle>
                    <CardDescription>
                      MRs created over {thresholds.TOO_OLD_THRESHOLD} days ago
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p>
                      Identify merge requests that have been open for too long
                      and may need to be closed or prioritized for completion.
                    </p>
                  </CardContent>
                  <CardFooter>
                    <Button asChild className="w-full">
                      <Link href="/dashboard/too-old">View Old MRs</Link>
                    </Button>
                  </CardFooter>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Inactive Merge Requests</CardTitle>
                    <CardDescription>
                      MRs not updated in {thresholds.NOT_UPDATED_THRESHOLD} days
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p>
                      Find merge requests that haven&apos;t seen recent activity
                      and might need a nudge to keep moving forward.
                    </p>
                  </CardContent>
                  <CardFooter>
                    <Button asChild className="w-full">
                      <Link href="/dashboard/not-updated">
                        View Inactive MRs
                      </Link>
                    </Button>
                  </CardFooter>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Pending Review</CardTitle>
                    <CardDescription>
                      MRs awaiting review for{" "}
                      {thresholds.PENDING_REVIEW_THRESHOLD} days
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p>
                      Track merge requests that are waiting for team members to
                      review and are becoming stale.
                    </p>
                  </CardContent>
                  <CardFooter>
                    <Button asChild className="w-full">
                      <Link href="/dashboard/pending-review">
                        View Pending Reviews
                      </Link>
                    </Button>
                  </CardFooter>
                </Card>
              </div>

              {/* Only show role-based view previews if enabled */}
              {areRoleBasedViewsEnabled && (
                <div className="mt-12">
                  <h2 className="text-2xl font-bold mb-6 text-center">
                    Role-Based Views
                  </h2>
                  <div className="grid md:grid-cols-3 gap-6">
                    {isViewAvailable(ViewType.PO) && (
                      <ViewPreviewCard
                        viewType={ViewType.PO}
                        title="PO View"
                        description="Organize MRs by Jira tickets"
                      >
                        {renderPOViewPreview()}
                      </ViewPreviewCard>
                    )}

                    {isViewAvailable(ViewType.DEV) && (
                      <ViewPreviewCard
                        viewType={ViewType.DEV}
                        title="Dev View"
                        description="Focus on MRs needing your attention"
                      >
                        {renderDevViewPreview()}
                      </ViewPreviewCard>
                    )}

                    {isViewAvailable(ViewType.TEAM) && (
                      <ViewPreviewCard
                        viewType={ViewType.TEAM}
                        title="Team View"
                        description="Aggregated team metrics"
                      >
                        {renderTeamViewPreview()}
                      </ViewPreviewCard>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </OriginalDashboardWrapper>
    </UnifiedDashboard>
  );
}
