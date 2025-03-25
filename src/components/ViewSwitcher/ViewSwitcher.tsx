import { useContext } from "react";
import { LayoutContext } from "@/contexts/LayoutContext";
import { ViewType, getAvailableViews } from "@/types/ViewTypes";
import { useFeatureFlags } from "@/services/FeatureFlags";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";

/**
 * ViewSwitcher component for toggling between different dashboard views
 */
export function ViewSwitcher() {
  const { currentViewType, setCurrentViewType } = useContext(LayoutContext);
  const { isFeatureEnabled } = useFeatureFlags();

  // Get available views based on feature flags
  const availableViews = getAvailableViews(isFeatureEnabled);

  // If there's only one view available (hygiene view), don't render the switcher
  if (availableViews.length <= 1) {
    return null;
  }

  return (
    <div className="mb-6">
      <Tabs
        value={currentViewType}
        onValueChange={(value) => setCurrentViewType(value as ViewType)}
        className="w-full"
      >
        <TabsList
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${availableViews.length}, 1fr)`,
          }}
        >
          {availableViews.map((view) => (
            <TabsTrigger
              key={view.type}
              value={view.type}
              data-testid={`view-tab-${view.type}`}
            >
              <span className="flex items-center gap-2">
                {view.type === currentViewType && (
                  <motion.div
                    layoutId="active-view-indicator"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                  />
                )}
                {view.label}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}

/**
 * Interface for role item
 */
export interface Role {
  id: string;
  label: string;
  description?: string;
}

/**
 * Props for RoleSelector component
 */
export interface RoleSelectorProps {
  roles: Role[];
  activeRole: string;
  onRoleChange: (roleId: string) => void;
}

/**
 * RoleSelector component for selecting specific roles within a view
 */
export function RoleSelector({
  roles,
  activeRole,
  onRoleChange,
}: RoleSelectorProps) {
  if (!roles || roles.length === 0) {
    return null;
  }

  return (
    <div className="flex gap-2 mb-4">
      {roles.map((role) => (
        <Button
          key={role.id}
          variant={activeRole === role.id ? "secondary" : "outline"}
          size="sm"
          onClick={() => onRoleChange(role.id)}
        >
          {role.label}
        </Button>
      ))}
    </div>
  );
}

/**
 * Export transitions for view switching animations
 */
export const viewTransitions = {
  // Fade in/out animation
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.2 },
  },

  // Slide animation
  slide: {
    initial: { x: 20, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: -20, opacity: 0 },
    transition: { duration: 0.3 },
  },
};
