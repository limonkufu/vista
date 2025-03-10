/**
 * Application configuration settings
 */

// Default threshold values in days
const DEFAULT_THRESHOLDS = {
  // MRs created more than this many days ago are considered "too old"
  TOO_OLD_THRESHOLD: 1,

  // MRs not updated in this many days are considered "inactive"
  NOT_UPDATED_THRESHOLD: 1,

  // MRs pending review from team members for more than this many days
  PENDING_REVIEW_THRESHOLD: 1,
};

// Current threshold values (can be modified at runtime)
export const thresholds = { ...DEFAULT_THRESHOLDS };

/**
 * Updates a threshold setting
 * @param key - The threshold key to update
 * @param value - The new value in days (must be a positive number)
 * @returns boolean indicating success
 */
export function updateThreshold(
  key: keyof typeof DEFAULT_THRESHOLDS,
  value: number
): boolean {
  // Validate the value
  if (typeof value !== "number" || value <= 0 || !Number.isInteger(value)) {
    return false;
  }

  // Update the threshold
  thresholds[key] = value;
  return true;
}

/**
 * Resets all thresholds to their default values
 */
export function resetThresholds(): void {
  Object.assign(thresholds, DEFAULT_THRESHOLDS);
}

/**
 * Gets all current threshold settings
 * @returns Object with all threshold values
 */
export function getThresholds() {
  return { ...thresholds };
}
