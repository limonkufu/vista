// Feature flags service to control access to new features

// List of available feature flags
export enum FeatureFlag {
  ROLE_BASED_VIEWS = "roleBased",
  PO_VIEW = "poView",
  DEV_VIEW = "devView",
  TEAM_VIEW = "teamView",
  JIRA_INTEGRATION = "jiraIntegration",
}

// Default configuration for production and development
const DEFAULT_FLAGS = {
  [FeatureFlag.ROLE_BASED_VIEWS]: false,
  [FeatureFlag.PO_VIEW]: false,
  [FeatureFlag.DEV_VIEW]: false,
  [FeatureFlag.TEAM_VIEW]: false,
  [FeatureFlag.JIRA_INTEGRATION]: false,
};

// Development defaults override production defaults
const DEV_MODE_DEFAULTS = {
  ...DEFAULT_FLAGS,
  // Enable specific flags for development by default
  // [FeatureFlag.ROLE_BASED_VIEWS]: true,
};

const STORAGE_KEY = "gitlab-mrs-dashboard-feature-flags";
const COOKIE_KEY = "gitlab-mrs-dashboard-feature-flags";

// Helper function to set a cookie for server-side feature flags
const setCookie = (value: string) => {
  if (typeof document === "undefined") return;

  // Set cookie to expire in 30 days
  const expireDate = new Date();
  expireDate.setDate(expireDate.getDate() + 30);

  document.cookie = `${COOKIE_KEY}=${value}; expires=${expireDate.toUTCString()}; path=/; SameSite=Lax`;
};

// Feature flags service
export const FeatureFlags = {
  // Check if a feature is enabled
  isEnabled(flag: FeatureFlag): boolean {
    const flags = this.getAllFlags();
    return flags[flag] === true;
  },

  // Get all feature flags
  getAllFlags(): Record<string, boolean> {
    // Start with appropriate defaults based on environment
    const defaults =
      process.env.NODE_ENV === "development"
        ? DEV_MODE_DEFAULTS
        : DEFAULT_FLAGS;

    // Try to load flags from localStorage
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          return { ...defaults, ...JSON.parse(stored) };
        }
      } catch (error) {
        console.error("Failed to read feature flags from localStorage:", error);
      }
    }

    return defaults;
  },

  // Enable a feature
  enable(flag: FeatureFlag): void {
    this.setFlag(flag, true);
  },

  // Disable a feature
  disable(flag: FeatureFlag): void {
    this.setFlag(flag, false);
  },

  // Toggle a feature
  toggle(flag: FeatureFlag): boolean {
    const isEnabled = this.isEnabled(flag);
    this.setFlag(flag, !isEnabled);
    return !isEnabled;
  },

  // Set a feature flag value
  setFlag(flag: FeatureFlag, value: boolean): void {
    if (typeof window === "undefined") return;

    try {
      const flags = this.getAllFlags();
      flags[flag] = value;

      // Save to localStorage
      const flagsJson = JSON.stringify(flags);
      localStorage.setItem(STORAGE_KEY, flagsJson);

      // Also set cookie for server-side (middleware) access
      setCookie(flagsJson);

      // Dispatch an event to notify subscribers
      window.dispatchEvent(
        new CustomEvent("feature-flag-change", {
          detail: { flag, value, flags },
        })
      );
    } catch (error) {
      console.error("Failed to set feature flag:", error);
    }
  },

  // Reset all flags to defaults
  resetToDefaults(): void {
    if (typeof window === "undefined") return;

    try {
      // Clear localStorage
      localStorage.removeItem(STORAGE_KEY);

      // Get default flags
      const defaultFlags = this.getAllFlags();

      // Update cookie with default values
      setCookie(JSON.stringify(defaultFlags));

      // Dispatch an event to notify subscribers
      window.dispatchEvent(
        new CustomEvent("feature-flag-change", {
          detail: { reset: true, flags: defaultFlags },
        })
      );
    } catch (error) {
      console.error("Failed to reset feature flags:", error);
    }
  },
};
