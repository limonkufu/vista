"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ViewType, getViewByType } from "@/types/ViewTypes";
import { FeatureFlags, FeatureFlag } from "@/services/FeatureFlags";
import { useViewNavigation, ViewContext } from "@/services/NavigationService";
import { useLayout } from "@/contexts/LayoutContext";

// Types of promotional banners
type BannerType = "newFeature" | "contextSuggestion" | "viewAvailable";

// Storage keys for dismissing banners
const DISMISSED_BANNERS_KEY = "gitlab-mrs-dashboard-dismissed-banners";

/**
 * Banner that promotes new features
 */
export function NewFeatureBanner() {
  const [dismissed, setDismissed] = useState(false);
  const { areRoleBasedViewsEnabled } = useLayout();

  // Don't show if role-based views are not enabled
  if (!areRoleBasedViewsEnabled) {
    return null;
  }

  // Check if this banner was previously dismissed
  useEffect(() => {
    try {
      const dismissedBanners = JSON.parse(
        localStorage.getItem(DISMISSED_BANNERS_KEY) || "{}"
      );
      setDismissed(!!dismissedBanners.newFeature);
    } catch (error) {
      console.error("Failed to read dismissed banners:", error);
    }
  }, []);

  if (dismissed) {
    return null;
  }

  // Handle dismissing the banner
  const handleDismiss = () => {
    setDismissed(true);
    try {
      const dismissedBanners = JSON.parse(
        localStorage.getItem(DISMISSED_BANNERS_KEY) || "{}"
      );
      dismissedBanners.newFeature = true;
      localStorage.setItem(
        DISMISSED_BANNERS_KEY,
        JSON.stringify(dismissedBanners)
      );
    } catch (error) {
      console.error("Failed to save dismissed state:", error);
    }
  };

  return (
    <Card className="mb-4 border-blue-300 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-lg">New Views Available</CardTitle>
          <CardDescription>
            Try our new role-based dashboard views
          </CardDescription>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDismiss}
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="pb-2">
        <p>
          We've added new views tailored for different roles. Try them out to
          see your MRs organized in different ways.
        </p>
      </CardContent>
      <CardFooter className="flex gap-2">
        {[ViewType.PO, ViewType.DEV, ViewType.TEAM].map((viewType) => {
          const view = getViewByType(viewType);
          if (!view) return null;

          const isAvailable = FeatureFlags.isEnabled(
            view.featureFlag as FeatureFlag
          );

          if (!isAvailable) return null;

          return (
            <Link
              key={viewType}
              href={`/dashboard/${viewType.toLowerCase()}-view`}
              passHref
            >
              <Button variant="outline" size="sm">
                Try {view.label}
              </Button>
            </Link>
          );
        })}
      </CardFooter>
    </Card>
  );
}

interface ViewSuggestionCardProps {
  title: string;
  description: string;
  targetView: ViewType;
  context: ViewContext;
  badgeText?: string;
}

/**
 * Card that suggests a specific view for the current context
 */
export function ViewSuggestionCard({
  title,
  description,
  targetView,
  context,
  badgeText,
}: ViewSuggestionCardProps) {
  const { activeView, isViewAvailable } = useLayout();
  const { navigateToView } = useViewNavigation();

  // Don't show if already in target view or if view is not available
  if (activeView === targetView || !isViewAvailable(targetView)) {
    return null;
  }

  const view = getViewByType(targetView);
  if (!view) return null;

  const handleClick = () => {
    navigateToView(targetView, activeView, context);
  };

  return (
    <Card className="mb-4 hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-md">{title}</CardTitle>
          {badgeText && (
            <Badge variant="outline" className="ml-2">
              {badgeText}
            </Badge>
          )}
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardFooter className="pt-2">
        <Button size="sm" onClick={handleClick}>
          View in {view.label}
        </Button>
      </CardFooter>
    </Card>
  );
}

/**
 * Mini view preview that can be embedded in the existing dashboard
 */
export function ViewPreviewCard({
  viewType,
  title,
  description,
  children,
}: {
  viewType: ViewType;
  title?: string;
  description?: string;
  children: React.ReactNode;
}) {
  const { activeView, isViewAvailable } = useLayout();
  const { navigateToView } = useViewNavigation();

  // Don't show if already in this view or if view is not available
  if (activeView === viewType || !isViewAvailable(viewType)) {
    return null;
  }

  const view = getViewByType(viewType);
  if (!view) return null;

  const handleClick = () => {
    navigateToView(viewType, activeView, {});
  };

  return (
    <Card className="mb-4 hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <CardTitle className="text-md">{title || view.label}</CardTitle>
        <CardDescription>{description || view.description}</CardDescription>
      </CardHeader>
      <CardContent className="max-h-48 overflow-auto">{children}</CardContent>
      <CardFooter className="pt-2">
        <Button size="sm" onClick={handleClick}>
          Open {view.label}
        </Button>
      </CardFooter>
    </Card>
  );
}
