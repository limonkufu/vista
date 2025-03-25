import {
  GitPullRequest,
  AlertTriangle,
  Clock,
  Activity,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Hourglass,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { JiraTicketWithMRs } from "@/types/Jira";
import { GitLabMRWithJira } from "@/types/Jira";

interface MetricsDashboardProps {
  tickets: JiraTicketWithMRs[];
  mergeRequests: GitLabMRWithJira[];
  isLoading: boolean;
}

export function MetricsDashboard({
  tickets,
  mergeRequests,
  isLoading,
}: MetricsDashboardProps) {
  // Calculate metrics

  // Total MRs
  const totalMRs = mergeRequests.length;

  // Open MRs
  const openMRs = mergeRequests.filter((mr) => mr.state === "opened").length;

  // MRs merged in last 7 days
  const mergedRecentlyMRs = mergeRequests.filter((mr) => {
    if (mr.state !== "merged" || !mr.merged_at) return false;
    const mergedDate = new Date(mr.merged_at);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return mergedDate > sevenDaysAgo;
  }).length;

  // Average MR age in days
  const avgMRAge =
    openMRs === 0
      ? 0
      : Math.round(
          mergeRequests
            .filter((mr) => mr.state === "opened")
            .reduce((sum, mr) => {
              const created = new Date(mr.created_at);
              const now = new Date();
              const ageInDays = Math.floor(
                (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
              );
              return sum + ageInDays;
            }, 0) / openMRs
        );

  // Overdue MRs
  const overdueMRs = mergeRequests.filter((mr) => {
    if (mr.state !== "opened") return false;
    const updated = new Date(mr.updated_at);
    const now = new Date();
    const daysSinceUpdate = Math.floor(
      (now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceUpdate > 14; // MRs not updated in 14 days
  }).length;

  // Blocked tickets
  const blockedTickets = tickets.filter(
    (t) => t.ticket.status === "Blocked"
  ).length;

  // MRs needing review
  const mrsNeedingReview = mergeRequests.filter((mr) => {
    if (mr.state !== "opened") return false;
    // Simple heuristic: MRs with no notes are likely not reviewed yet
    return mr.user_notes_count === 0;
  }).length;

  // MRs with requested changes
  const mrsWithRequestedChanges = mergeRequests.filter((mr) => {
    if (mr.state !== "opened") return false;
    // Simple heuristic: MRs with notes are likely to have requested changes
    return mr.user_notes_count > 0;
  }).length;

  // Change trend - mock data for now, would be calculated from historical data in Phase 3
  const mrTrend = totalMRs > 20 ? 5 : -3; // Positive means more MRs than last period
  const avgAgeTrend = -1; // Negative means getting faster (better)

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Total MRs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total MRs</CardTitle>
          <GitPullRequest className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{isLoading ? "-" : totalMRs}</div>
          <p className="text-xs text-muted-foreground">
            {mrTrend > 0 ? (
              <span className="flex items-center text-green-600 dark:text-green-400">
                <TrendingUp className="mr-1 h-3 w-3" /> {mrTrend} more than last
                period
              </span>
            ) : (
              <span className="flex items-center text-red-600 dark:text-red-400">
                <TrendingDown className="mr-1 h-3 w-3" /> {Math.abs(mrTrend)}{" "}
                fewer than last period
              </span>
            )}
          </p>
        </CardContent>
      </Card>

      {/* Open MRs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Open MRs</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{isLoading ? "-" : openMRs}</div>
          <p className="text-xs text-muted-foreground">
            {mergedRecentlyMRs} merged in the last 7 days
          </p>
        </CardContent>
      </Card>

      {/* Average MR Age */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg. MR Age</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {isLoading ? "-" : `${avgMRAge} days`}
          </div>
          <p className="text-xs text-muted-foreground">
            {avgAgeTrend < 0 ? (
              <span className="flex items-center text-green-600 dark:text-green-400">
                <TrendingDown className="mr-1 h-3 w-3" />{" "}
                {Math.abs(avgAgeTrend)} days faster
              </span>
            ) : (
              <span className="flex items-center text-red-600 dark:text-red-400">
                <TrendingUp className="mr-1 h-3 w-3" /> {avgAgeTrend} days
                slower
              </span>
            )}
          </p>
        </CardContent>
      </Card>

      {/* Overdue MRs */}
      <Card className={overdueMRs > 0 ? "border-red-500" : ""}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Overdue MRs</CardTitle>
          <AlertTriangle
            className={`h-4 w-4 ${
              overdueMRs > 0 ? "text-red-500" : "text-muted-foreground"
            }`}
          />
        </CardHeader>
        <CardContent>
          <div
            className={`text-2xl font-bold ${
              overdueMRs > 0 ? "text-red-500" : ""
            }`}
          >
            {isLoading ? "-" : overdueMRs}
          </div>
          <p className="text-xs text-muted-foreground">
            Not updated in 14+ days
          </p>
        </CardContent>
      </Card>

      {/* Blocked Tickets */}
      <Card className={blockedTickets > 0 ? "border-red-500" : ""}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Blocked Tickets</CardTitle>
          <XCircle
            className={`h-4 w-4 ${
              blockedTickets > 0 ? "text-red-500" : "text-muted-foreground"
            }`}
          />
        </CardHeader>
        <CardContent>
          <div
            className={`text-2xl font-bold ${
              blockedTickets > 0 ? "text-red-500" : ""
            }`}
          >
            {isLoading ? "-" : blockedTickets}
          </div>
          <p className="text-xs text-muted-foreground">
            {blockedTickets > 0
              ? "Requires immediate attention"
              : "No blocked tickets"}
          </p>
        </CardContent>
      </Card>

      {/* MRs Needing Review */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Needs Review</CardTitle>
          <Hourglass className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {isLoading ? "-" : mrsNeedingReview}
          </div>
          <p className="text-xs text-muted-foreground">
            Waiting for initial review
          </p>
        </CardContent>
      </Card>

      {/* MRs with Requested Changes */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Requested Changes
          </CardTitle>
          <CheckCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {isLoading ? "-" : mrsWithRequestedChanges}
          </div>
          <p className="text-xs text-muted-foreground">
            Awaiting updates from authors
          </p>
        </CardContent>
      </Card>

      {/* Completion Rate */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {isLoading
              ? "-"
              : `${
                  totalMRs === 0
                    ? 0
                    : Math.round((mergedRecentlyMRs / totalMRs) * 100)
                }%`}
          </div>
          <p className="text-xs text-muted-foreground">
            MRs merged in last 7 days
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
