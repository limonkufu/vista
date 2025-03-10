import { logger } from "./logger";

/**
 * Makes an authenticated API request to internal endpoints
 * @param url The API endpoint URL
 * @param options Additional fetch options
 * @returns Response from the API
 */
export async function fetchAPI(url: string, options: RequestInit = {}) {
  const apiKey = process.env.NEXT_PUBLIC_DASHBOARD_API_KEY;

  if (!apiKey) {
    logger.warn("NEXT_PUBLIC_DASHBOARD_API_KEY is not set", {}, "API");
  }

  // Prepare headers with API key
  const headers = new Headers(options.headers || {});
  if (apiKey) {
    headers.set("x-api-key", apiKey);
  }

  // Merge the headers with the options
  const fetchOptions: RequestInit = {
    ...options,
    headers,
  };

  return fetch(url, fetchOptions);
}
