/**
 * Centralized cache configuration
 * Defines TTL (Time To Live) values for different cache types
 */

// TTL values in seconds
export const TTL_SECONDS = {
  // External API calls (shorter to keep data fresh)
  GITLAB_API: 900, // 15 minutes
  JIRA_API: 900, // 15 minutes

  // Processed data (longer as this is derived data)
  PROCESSED_DATA: 3600, // 60 minutes

  // Client-side cache (longer to reduce API calls from client)
  CLIENT: 3600, // 60 minutes
};

// TTL values in milliseconds (derived from seconds)
export const TTL_MS = {
  GITLAB_API: TTL_SECONDS.GITLAB_API * 1000,
  JIRA_API: TTL_SECONDS.JIRA_API * 1000,
  PROCESSED_DATA: TTL_SECONDS.PROCESSED_DATA * 1000,
  CLIENT: TTL_SECONDS.CLIENT * 1000,
};

// Export both constants and helper functions
export default {
  TTL_SECONDS,
  TTL_MS,
};
