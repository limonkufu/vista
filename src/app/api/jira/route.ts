import { NextResponse } from "next/server";
import JiraApi from "jira-client";
import { logger, measurePerformance } from "@/lib/logger";
import { jiraApiCache } from "@/lib/jiraCache";

// Initialize Jira client
const jira = new JiraApi({
  protocol: "https",
  host: process.env.JIRA_HOST as string,
  username: process.env.JIRA_EMAIL as string,
  password: process.env.JIRA_API_TOKEN as string,
  apiVersion: "3",
  strictSSL: true,
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const key = searchParams.get("key");
  const jql = searchParams.get("jql");
  const skipCache = searchParams.get("skipCache") === "true";

  try {
    logger.info(
      "Processing Jira API request",
      { action, key, jql, skipCache },
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

        // Generate cache key
        const ticketCacheKey = jiraApiCache.generateKey("getTicket", { key });

        // Try to get from cache if not explicitly skipping
        if (!skipCache) {
          const cachedTicket = jiraApiCache.get(ticketCacheKey);
          if (cachedTicket) {
            logger.info("Using cached Jira ticket", { key }, "JiraAPI");
            return NextResponse.json(cachedTicket);
          }
        }

        logger.info("Fetching Jira ticket", { key }, "JiraAPI");

        const ticket = await measurePerformance(
          "Jira API Request: getTicket",
          () => jira.findIssue(key)
        );

        // Cache the response
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

        // Generate cache key
        const searchCacheKey = jiraApiCache.generateKey("searchTickets", {
          jql,
        });

        // Try to get from cache if not explicitly skipping
        if (!skipCache) {
          const cachedSearch = jiraApiCache.get(searchCacheKey);
          if (cachedSearch) {
            logger.info("Using cached Jira search results", { jql }, "JiraAPI");
            return NextResponse.json(cachedSearch);
          }
        }

        logger.info("Searching Jira tickets", { jql }, "JiraAPI");

        const searchResult = await measurePerformance(
          "Jira API Request: searchTickets",
          () =>
            jira.searchJira(jql, {
              maxResults: 100,
            })
        );

        // Cache the response
        if (!skipCache) {
          jiraApiCache.set(searchCacheKey, searchResult);
        }

        logger.info(
          "Successfully searched Jira tickets",
          {
            jql,
            totalResults: searchResult.issues?.length || 0,
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
  } catch (error) {
    logger.error(
      "Jira API error",
      {
        action,
        key,
        jql,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      "JiraAPI"
    );

    return NextResponse.json(
      {
        error: "Failed to fetch data from Jira",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
