"use client";

import { useState, useEffect } from "react";
import { Beaker } from "lucide-react";
import { FeatureFlag, FeatureFlags } from "@/services/FeatureFlags";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export function LabsMenu() {
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [show, setShow] = useState(false);

  // Only show Labs menu in development or if explicitly enabled
  useEffect(() => {
    const isDev = process.env.NODE_ENV === "development";
    const hasLabsParam =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).has("labs");

    setShow(isDev || hasLabsParam);
    setFlags(FeatureFlags.getAllFlags());

    // Listen for flag changes
    const handleFlagChange = () => {
      setFlags(FeatureFlags.getAllFlags());
    };

    window.addEventListener("feature-flag-change", handleFlagChange);
    return () => {
      window.removeEventListener("feature-flag-change", handleFlagChange);
    };
  }, []);

  if (!show) return null;

  const toggleFlag = (flag: FeatureFlag) => {
    const newValue = FeatureFlags.toggle(flag);
    toast.success(`${flag} ${newValue ? "enabled" : "disabled"}`);
  };

  const resetFlags = () => {
    FeatureFlags.resetToDefaults();
    toast.success("All feature flags reset to defaults");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          title="GitLab MRs Dashboard Labs"
          className="text-amber-500 border-amber-500/30 hover:bg-amber-500/10 dark:text-amber-400 dark:border-amber-400/30 dark:hover:bg-amber-400/10"
        >
          <Beaker className="h-4 w-4" />
          <span className="sr-only">Labs Menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>GitLab MRs Dashboard Labs</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {Object.entries(flags).map(([flag, enabled]) => (
          <DropdownMenuItem
            key={flag}
            onSelect={(e) => {
              e.preventDefault();
              toggleFlag(flag as FeatureFlag);
            }}
            className="flex items-center justify-between cursor-pointer"
          >
            <span>{flag}</span>
            <Switch checked={enabled} />
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            resetFlags();
          }}
        >
          Reset all flags to defaults
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
