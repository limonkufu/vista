// File: src/test/test-utils.ts
import { jest } from "@jest/globals";
import { FeatureFlags } from "@/services/FeatureFlags"; // Add this import

export const mockFeatureFlag = (value: boolean) => {
  // Now FeatureFlags is guaranteed to be defined in this scope
  return (FeatureFlags.isEnabled as jest.Mock).mockReturnValue(value);
};
