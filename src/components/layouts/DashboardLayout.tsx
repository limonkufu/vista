"use client";

import React, { PropsWithChildren } from "react";
import { FeatureFlags, FeatureFlag } from "@/services/FeatureFlags";
import { useLayout } from "@/contexts/LayoutContext";
import { ViewType } from "@/types/ViewTypes";
import { Navbar } from "@/components/Navbar";
import { EnhancedNavbar } from "@/components/layouts/EnhancedNavbar";
import { Footer } from "@/components/Footer";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { activeView, areRoleBasedViewsEnabled } = useLayout();

  // Choose the appropriate navbar based on feature flags
  const NavbarComponent = areRoleBasedViewsEnabled ? EnhancedNavbar : Navbar;

  // For role-based views, we'll wrap the content in view-specific containers
  const renderContent = () => {
    if (!areRoleBasedViewsEnabled || activeView === ViewType.HYGIENE) {
      // For the standard hygiene view or when features are disabled,
      // just render the children directly
      return children;
    }

    // For role-based views, we'll eventually have specific wrappers
    // but for now we'll use placeholders that will be implemented later
    switch (activeView) {
      case ViewType.PO:
        return (
          <div className="po-view-container">
            {/* This will be replaced with the actual PO view component */}
            {children}
          </div>
        );
      case ViewType.DEV:
        return (
          <div className="dev-view-container">
            {/* This will be replaced with the actual Dev view component */}
            {children}
          </div>
        );
      case ViewType.TEAM:
        return (
          <div className="team-view-container">
            {/* This will be replaced with the actual Team view component */}
            {children}
          </div>
        );
      default:
        return children;
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <NavbarComponent />
      <main className="flex-1">{renderContent()}</main>
      <Footer />
    </div>
  );
}
