// File: src/app/api/jira/route.ts
import { NextResponse } from "next/server";
import JiraApi from "jira-client";
import { logger, measurePerformance } from "@/lib/logger";
import { jiraApiCache } from "@/lib/jiraCache";
import Bottleneck from "bottleneck"; // Import bottleneck

// --- Environment Variable Logging ---
const jiraHost = process.env.JIRA_HOST as string;
const jiraEmail = process.env.JIRA_EMAIL as string;
const jiraTokenExists = !!process.env.JIRA_API_TOKEN; // Check existence, don't log token

logger.debug(
  "Jira API Route - Env Vars Check",
  {
    host: jiraHost,
    email: jiraEmail,
    tokenExists: jiraTokenExists,
  },
  "JiraAPI:Init"
);

// Validate Host (Basic Check)
if (!jiraHost || jiraHost.includes("https://") || jiraHost.includes("/")) {
  logger.error(
    "Invalid JIRA_HOST format. Should be just the domain (e.g., your-domain.atlassian.net)",
    { host: jiraHost },
    "JiraAPI:Init"
  );
  // Consider throwing an error here in production if needed
}
// --- End Logging Block ---

// --- Jira Client Initialization ---
// Initialize Jira client
// Ensure 'host' is ONLY the hostname, not the full URL
const jira = new JiraApi({
  protocol: "https",
  host: jiraHost, // Use the variable, ensure it's just the hostname
  username: jiraEmail,
  password: process.env.JIRA_API_TOKEN as string, // Token used as password
  apiVersion: "3",
  strictSSL: true,
});
// --- End Jira Client Initialization ---

// --- Bottleneck Rate Limiter Setup ---
// Configure limits based on Jira's known limits (adjust as needed)
// Example: Max 5 concurrent requests, 100ms minimum time between requests (10/sec)
const jiraLimiter = new Bottleneck({
  maxConcurrent: 5, // Max 5 requests running at the same time
  minTime: 100, // Minimum 100ms between requests (limits to 10 requests/sec)
  // Optional: Add reservoir for bursting
  // reservoir: 15,
  // reservoirRefreshAmount: 15,
  // reservoirRefreshInterval: 1000, // Replenish 15 requests every second
});

// Optional: Log limiter events for debugging
jiraLimiter.on("error", (error) => {
  logger.error("Bottleneck limiter error", { error }, "JiraAPI:Limiter");
});

jiraLimiter.on("failed", (error, jobInfo) => {
  logger.warn(
    "Bottleneck job failed after retries",
    { error: error.message, retryCount: jobInfo.retryCount },
    "JiraAPI:Limiter"
  );
  // Decide how to handle failures. Returning null allows the main logic to throw.
  // Returning a specific error object might also be an option.
  return null; // Indicate failure
});

jiraLimiter.on("depleted", (empty) => {
  if (empty) {
    logger.warn("Bottleneck limiter queue is empty", {}, "JiraAPI:Limiter");
  }
});

jiraLimiter.on("debug", (message, data) => {
  logger.debug(`Bottleneck: ${message}`, data, "JiraAPI:Limiter:Debug");
});
// --- End Limiter Setup ---

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const key = searchParams.get("key");
  const jql = searchParams.get("jql");
  const skipCache = searchParams.get("skipCache") === "true";

  try {
    logger.info(
      "Processing Jira API request",
      {
        action,
        key,
        jql: jql ? jql.substring(0, 50) + "..." : null,
        skipCache,
      },
      "JiraAPI"
    );

    switch (action) {
      case "getTicket":
        if (!key) {
          logger.warn("Missing ticket key in getTicket request", {}, "JiraAPI");
          return NextResponse.json(
            { error: "Ticket key is required" },
            { status: 400 }
          );
        }

        const ticketCacheKey = jiraApiCache.generateKey("getTicket", { key });

        if (!skipCache) {
          const cachedTicket = jiraApiCache.get(ticketCacheKey);
          if (cachedTicket) {
            logger.info(
              "Using cached Jira ticket",
              { key, cacheKey: ticketCacheKey },
              "JiraAPI"
            );
            return NextResponse.json(cachedTicket);
          }
        }

        logger.info("Fetching Jira ticket (via limiter)", { key }, "JiraAPI");
        // Wrap the actual API call with the limiter
        const ticket = await measurePerformance(
          `Jira API Request: getTicket ${key}`,
          () => jiraLimiter.schedule(() => jira.findIssue(key)) // Use limiter.schedule
        );

        // Handle potential null from limiter failure if configured in 'failed' event
        if (ticket === null) {
          logger.error(
            `Rate limited or job failed fetching ticket ${key} after retries.`,
            { key },
            "JiraAPI"
          );
          // Return a 503 Service Unavailable or 429 Too Many Requests
          return NextResponse.json(
            {
              error:
                "Failed to fetch ticket due to rate limits or internal error.",
            },
            { status: 503 }
          );
        }

        if (!skipCache) {
          jiraApiCache.set(ticketCacheKey, ticket);
        }
        logger.info("Successfully fetched Jira ticket", { key }, "JiraAPI");
        return NextResponse.json(ticket);

      case "searchTickets":
        if (!jql) {
          logger.warn(
            "Missing JQL query in searchTickets request",
            {},
            "JiraAPI"
          );
          return NextResponse.json(
            { error: "JQL query is required" },
            { status: 400 }
          );
        }

        const searchCacheKey = jiraApiCache.generateKey("searchTickets", {
          jql, // Use full JQL for cache key
        });

        if (!skipCache) {
          const cachedSearch = jiraApiCache.get(searchCacheKey);
          if (cachedSearch) {
            logger.info(
              "Using cached Jira search results",
              { jql: jql.substring(0, 50) + "...", cacheKey: searchCacheKey },
              "JiraAPI"
            );
            return NextResponse.json(cachedSearch);
          }
        }

        logger.info(
          "Searching Jira tickets (via limiter)",
          { jql: jql.substring(0, 50) + "..." },
          "JiraAPI"
        );
        // Wrap the actual API call with the limiter
        const searchResult = await measurePerformance(
          "Jira API Request: searchTickets",
          () =>
            jiraLimiter.schedule(() =>
              // Use limiter.schedule
              jira.searchJira(jql, {
                // Ensure jql is not null here
                maxResults: 100,
                // Add fields if needed: fields: ['summary', 'status', ...]
              })
            )
        );

        // Handle potential null from limiter failure
        if (searchResult === null) {
          logger.error(
            `Rate limited or job failed searching Jira after retries.`,
            { jql: jql.substring(0, 50) + "..." },
            "JiraAPI"
          );
          return NextResponse.json(
            {
              error:
                "Failed to search Jira due to rate limits or internal error.",
            },
            { status: 503 }
          );
        }

        if (!skipCache) {
          jiraApiCache.set(searchCacheKey, searchResult);
        }
        logger.info(
          "Successfully searched Jira tickets",
          {
            jql: jql.substring(0, 50) + "...",
            totalResults:
              searchResult.total || searchResult.issues?.length || 0,
          },
          "JiraAPI"
        );
        return NextResponse.json(searchResult);

      default:
        logger.warn(
          "Invalid action in Jira API request",
          { action },
          "JiraAPI"
        );
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error: any) {
    // Log more details from the error if possible
    const errorDetails = {
      message: error.message,
      status: error.response?.status, // Axios-like error structure
      data: error.response?.data, // Axios-like error structure
      stack: error.stack?.substring(0, 300) + "...", // Truncate stack
      jiraClientError: error.errorMessages || error.errors, // Check for jira-client specific error format
    };
    logger.error(
      "Jira API error",
      {
        action,
        key,
        jql: jql ? jql.substring(0, 50) + "..." : null,
        error: errorDetails,
      },
      "JiraAPI"
    );

    // Check if it's specifically a rate limit error (often 429)
    const status = error.response?.status || error.statusCode || 500;
    if (status === 429) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded when contacting Jira API.",
          details: error.message || String(error),
        },
        { status: 429 }
      );
    }

    // Return a generic server error for other issues
    return NextResponse.json(
      {
        error: "Failed to process Jira request due to an internal error.",
        details: error.message || String(error),
        statusCode: status,
      },
      { status: status }
    );
  }
}
