import React from "react";
import { AppProgressBar as ProgressBar } from "next-nprogress-bar";

export function ProgressBarWrapper() {
  // In test environments, don't render the actual progress bar
  if (process.env.NODE_ENV === "development") {
    return null;
  }

  // Otherwise render the actual progress bar
  try {
    return (
      <ProgressBar
        height="2px"
        color="#0284c7"
        options={{ showSpinner: true }}
        shallowRouting
      />
    );
  } catch (error) {
    console.error("Error rendering ProgressBar:", error);
    return null; // Return null if there's an error
  }
}
