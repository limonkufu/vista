"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getThresholds, updateThreshold, resetThresholds } from "@/lib/config";
import { toast } from "sonner";
import { Settings } from "lucide-react";

export function ThresholdSettings() {
  const [isOpen, setIsOpen] = useState(false);
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
        return;
      }

      // Update threshold values
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
        return;
      }

      // Update local state
      setThresholds(getThresholds());
      setIsOpen(false);

      toast.success("Threshold settings updated");

      // Reload the page to apply new thresholds
      window.location.reload();
    } catch (error) {
      toast.error("Failed to update settings");
      console.error(error);
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
  };

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className="ml-auto"
        title="Threshold Settings"
      >
        <Settings className="h-4 w-4" />
      </Button>

      {isOpen && (
        <Card className="absolute right-0 top-10 z-50 w-80 shadow-lg">
          <CardHeader>
            <CardTitle>Threshold Settings</CardTitle>
            <CardDescription>
              Configure the thresholds for merge request filtering
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={handleReset}>
              Reset
            </Button>
            <Button onClick={handleSave}>Save</Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
