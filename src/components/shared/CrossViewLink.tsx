"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ViewType, getViewByType } from "@/types/ViewTypes";
import { useLayout } from "@/contexts/LayoutContext";
import { useViewNavigation, ViewContext } from "@/services/NavigationService";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CrossViewLinkProps {
  // Target view to navigate to
  targetView: ViewType;
  // Context to pass to the target view
  context: ViewContext;
  // Tooltip text to explain what this link does
  tooltipText?: string;
  // Custom class name
  className?: string;
  // Whether to render as a button instead of a link
  asButton?: boolean;
  // Children (usually an icon or text)
  children: React.ReactNode;
}

/**
 * A component that links to the same content in a different view
 */
export function CrossViewLink({
  targetView,
  context,
  tooltipText,
  className = "",
  asButton = false,
  children,
}: CrossViewLinkProps) {
  const router = useRouter();
  const { activeView, isViewAvailable } = useLayout();
  const { createDeepLink, navigateToView } = useViewNavigation();

  // Don't render if target view is not available
  if (!isViewAvailable(targetView)) {
    return null;
  }

  // Don't render if we're already in the target view
  if (activeView === targetView) {
    return null;
  }

  // Generate the deep link
  const href = createDeepLink(targetView, context);

  // Build tooltip text if not provided
  const defaultTooltipText = `View in ${
    getViewByType(targetView)?.label || targetView
  } view`;
  const actualTooltipText = tooltipText || defaultTooltipText;

  // Handle click
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    navigateToView(targetView, activeView, context);
  };

  // Render with tooltip
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {asButton ? (
            <button
              className={`cross-view-link ${className}`}
              onClick={handleClick}
              aria-label={actualTooltipText}
            >
              {children}
            </button>
          ) : (
            <Link
              href={href}
              className={`cross-view-link ${className}`}
              onClick={handleClick}
              aria-label={actualTooltipText}
            >
              {children}
            </Link>
          )}
        </TooltipTrigger>
        <TooltipContent>
          <p>{actualTooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
