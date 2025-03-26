// src/components/ThresholdSettings/ThresholdSettings.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose, // Import DialogClose
} from "@/components/ui/dialog"; // Use Dialog components
import { getThresholds, updateThreshold, resetThresholds } from "@/lib/config";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

// Removed props like isOpen, setIsOpen as it's controlled by Dialog

export function ThresholdSettings() {
  // State remains the same
  const [thresholds, setThresholds] = useState(getThresholds());
  const [tooOldThreshold, setTooOldThreshold] = useState(
    thresholds.TOO_OLD_THRESHOLD.toString()
  );
  const [notUpdatedThreshold, setNotUpdatedThreshold] = useState(
    thresholds.NOT_UPDATED_THRESHOLD.toString()
  );
  const [pendingReviewThreshold, setPendingReviewThreshold] = useState(
    thresholds.PENDING_REVIEW_THRESHOLD.toString()
  );

  const handleSave = () => {
    try {
      const tooOldValue = parseInt(tooOldThreshold);
      const notUpdatedValue = parseInt(notUpdatedThreshold);
      const pendingReviewValue = parseInt(pendingReviewThreshold);

      if (
        isNaN(tooOldValue) ||
        isNaN(notUpdatedValue) ||
        isNaN(pendingReviewValue)
      ) {
        toast.error("All values must be valid numbers");
        return false; // Indicate failure
      }

      const tooOldSuccess = updateThreshold("TOO_OLD_THRESHOLD", tooOldValue);
      const notUpdatedSuccess = updateThreshold(
        "NOT_UPDATED_THRESHOLD",
        notUpdatedValue
      );
      const pendingReviewSuccess = updateThreshold(
        "PENDING_REVIEW_THRESHOLD",
        pendingReviewValue
      );

      if (!tooOldSuccess || !notUpdatedSuccess || !pendingReviewSuccess) {
        toast.error("All values must be positive integers");
        return false; // Indicate failure
      }

      setThresholds(getThresholds()); // Update local state if needed
      toast.success("Threshold settings updated. Reloading page...");
      logger.info("Threshold settings updated", {
        tooOld: tooOldValue,
        notUpdated: notUpdatedValue,
        pendingReview: pendingReviewValue,
      });

      // Reload the page to apply new thresholds globally
      // Consider alternative (e.g., refetching data) if reload is too disruptive,
      // but reload is safer if thresholds affect backend logic.
      setTimeout(() => window.location.reload(), 1000);
      return true; // Indicate success
    } catch (error) {
      toast.error("Failed to update settings");
      logger.error("Error saving threshold settings", { error });
      return false; // Indicate failure
    }
  };

  const handleReset = () => {
    resetThresholds();
    const defaultThresholds = getThresholds();

    setTooOldThreshold(defaultThresholds.TOO_OLD_THRESHOLD.toString());
    setNotUpdatedThreshold(defaultThresholds.NOT_UPDATED_THRESHOLD.toString());
    setPendingReviewThreshold(
      defaultThresholds.PENDING_REVIEW_THRESHOLD.toString()
    );

    setThresholds(defaultThresholds);
    toast.success("Threshold settings reset to defaults");
    logger.info("Threshold settings reset to defaults");
  };

  return (
    <>
      {/* Use DialogHeader, Title, Description */}
      <DialogHeader>
        <DialogTitle>Threshold Settings</DialogTitle>
        <DialogDescription>
          Configure the thresholds (in days) for merge request filtering.
          Changes will require a page reload.
        </DialogDescription>
      </DialogHeader>
      {/* Content remains largely the same */}
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="too-old">Too Old MRs (days)</Label>
          <Input
            id="too-old"
            type="number"
            min="1"
            value={tooOldThreshold}
            onChange={(e) => setTooOldThreshold(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            MRs created more than this many days ago
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="not-updated">Inactive MRs (days)</Label>
          <Input
            id="not-updated"
            type="number"
            min="1"
            value={notUpdatedThreshold}
            onChange={(e) => setNotUpdatedThreshold(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            MRs not updated in this many days
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="pending-review">Pending Review (days)</Label>
          <Input
            id="pending-review"
            type="number"
            min="1"
            value={pendingReviewThreshold}
            onChange={(e) => setPendingReviewThreshold(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Team MRs waiting for review for this many days
          </p>
        </div>
      </div>
      {/* Use DialogFooter */}
      <DialogFooter>
        <Button variant="outline" onClick={handleReset}>
          Reset to Defaults
        </Button>
        {/* Close dialog only on successful save */}
        <DialogClose asChild>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogClose>
      </DialogFooter>
    </>
  );
}
