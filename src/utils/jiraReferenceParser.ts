/**
 * Jira Reference Parser Utilities
 *
 * Extract Jira ticket IDs from MR titles, descriptions, and branch names
 * with configurable patterns and confidence scoring.
 */

import { logger } from "@/lib/logger";

// Common patterns for Jira ticket keys
const DEFAULT_PATTERNS = [
  // Project key followed by hyphen and numbers
  /([A-Z][A-Z0-9_]+-[0-9]+)/g, // PROJ-123

  // With hash/pound prefix
  /#([A-Z][A-Z0-9_]+-[0-9]+)/g, // #PROJ-123

  // In brackets
  /\[([A-Z][A-Z0-9_]+-[0-9]+)\]/g, // [PROJ-123]

  // In parentheses
  /\(([A-Z][A-Z0-9_]+-[0-9]+)\)/g, // (PROJ-123)
];

// Common branch name patterns for Jira tickets
const BRANCH_PATTERNS = [
  // Project key in branch name
  /([A-Z][A-Z0-9_]+-[0-9]+)/g, // feature/PROJ-123-description

  // With slash separator
  /\/([A-Z][A-Z0-9_]+-[0-9]+)/g, // feature/PROJ-123/description

  // With underscore separator
  /_([A-Z][A-Z0-9_]+-[0-9]+)/g, // feature_PROJ-123_description
];

// Pattern to validate a Jira ticket key after extraction
const JIRA_KEY_PATTERN = /^[A-Z][A-Z0-9_]+-[0-9]+$/;

/**
 * Result of a Jira reference extraction
 */
export interface JiraReferenceResult {
  key: string;
  source: "title" | "description" | "branch" | "manual";
  confidence: number; // 0-1 score of confidence
  pattern: string; // The pattern that matched
}

/**
 * Configuration for the Jira reference parser
 */
export interface JiraParserConfig {
  titlePatterns?: RegExp[];
  descriptionPatterns?: RegExp[];
  branchPatterns?: RegExp[];
  preferredProjects?: string[]; // Project keys to prioritize
}

/**
 * Extract Jira ticket keys from MR title
 */
export function extractFromTitle(
  title: string,
  config?: JiraParserConfig
): JiraReferenceResult[] {
  const patterns = config?.titlePatterns || DEFAULT_PATTERNS;
  return extractWithPatterns(title, patterns, "title", config);
}

/**
 * Extract Jira ticket keys from MR description
 */
export function extractFromDescription(
  description: string,
  config?: JiraParserConfig
): JiraReferenceResult[] {
  const patterns = config?.descriptionPatterns || DEFAULT_PATTERNS;
  return extractWithPatterns(description, patterns, "description", config);
}

/**
 * Extract Jira ticket keys from branch name
 */
export function extractFromBranch(
  branchName: string,
  config?: JiraParserConfig
): JiraReferenceResult[] {
  const patterns = config?.branchPatterns || BRANCH_PATTERNS;
  return extractWithPatterns(branchName, patterns, "branch", config);
}

/**
 * Extract Jira references using the given patterns
 */
function extractWithPatterns(
  text: string,
  patterns: RegExp[],
  source: "title" | "description" | "branch" | "manual",
  config?: JiraParserConfig
): JiraReferenceResult[] {
  if (!text) return [];

  const results: JiraReferenceResult[] = [];
  const seenKeys = new Set<string>();

  // Try each pattern
  patterns.forEach((pattern) => {
    // Clone the regex to reset lastIndex
    const regex = new RegExp(pattern.source, pattern.flags);

    let match;
    while ((match = regex.exec(text)) !== null) {
      // Extract the key (either the whole match or a capture group)
      let key = match[1] || match[0];

      // Validate the key format
      if (!JIRA_KEY_PATTERN.test(key)) continue;

      // Skip duplicates
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);

      // Calculate confidence score
      let confidence = calculateConfidence(key, source, config);

      results.push({
        key,
        source,
        confidence,
        pattern: pattern.source,
      });
    }
  });

  // Sort by confidence (highest first)
  return results.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Calculate confidence score for a Jira reference
 */
function calculateConfidence(
  key: string,
  source: "title" | "description" | "branch" | "manual",
  config?: JiraParserConfig
): number {
  // Base confidence by source
  let confidence = 0;

  switch (source) {
    case "title":
      confidence = 0.8; // Very likely if in title
      break;
    case "branch":
      confidence = 0.7; // Quite likely if in branch name
      break;
    case "description":
      confidence = 0.5; // Somewhat likely if in description
      break;
    case "manual":
      confidence = 1.0; // Manually added is 100% confidence
      break;
  }

  // Boost confidence for preferred project keys
  if (config?.preferredProjects && config.preferredProjects.length > 0) {
    const projectKey = key.split("-")[0];
    if (config.preferredProjects.includes(projectKey)) {
      confidence = Math.min(confidence + 0.2, 1.0);
    }
  }

  return confidence;
}

/**
 * Extract all Jira references from a GitLab MR
 * Returns the most likely Jira key for this MR
 */
export function extractJiraReferences(
  mr: {
    title: string;
    description?: string;
    source_branch?: string;
  },
  config?: JiraParserConfig
): JiraReferenceResult[] {
  try {
    // Extract from different sources
    const titleRefs = extractFromTitle(mr.title, config);
    const descRefs = mr.description
      ? extractFromDescription(mr.description, config)
      : [];
    const branchRefs = mr.source_branch
      ? extractFromBranch(mr.source_branch, config)
      : [];

    // Combine all references
    const allRefs = [...titleRefs, ...branchRefs, ...descRefs];

    // Filter duplicates and sort by confidence
    const uniqueKeys = new Map<string, JiraReferenceResult>();

    allRefs.forEach((ref) => {
      // If we already have this key, keep the one with highest confidence
      if (uniqueKeys.has(ref.key)) {
        const existing = uniqueKeys.get(ref.key)!;
        if (ref.confidence > existing.confidence) {
          uniqueKeys.set(ref.key, ref);
        }
      } else {
        uniqueKeys.set(ref.key, ref);
      }
    });

    // Convert to array and sort by confidence
    return Array.from(uniqueKeys.values()).sort(
      (a, b) => b.confidence - a.confidence
    );
  } catch (error) {
    logger.error("Error extracting Jira references", { error, mr: mr.title });
    return [];
  }
}

/**
 * Get the most likely Jira key for a merge request
 */
export function getMostLikelyJiraKey(
  mr: {
    title: string;
    description?: string;
    source_branch?: string;
  },
  config?: JiraParserConfig
): string | null {
  const refs = extractJiraReferences(mr, config);
  return refs.length > 0 ? refs[0].key : null;
}
