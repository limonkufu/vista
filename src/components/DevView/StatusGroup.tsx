import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { GitLabMRWithJira } from "@/types/Jira";
import { DevMRRow } from "./DevMRRow";

export enum MRStatusCategory {
  NEEDS_REVIEW = "Needs Review",
  CHANGES_REQUESTED = "Changes Requested",
  WAITING_FOR_CI = "Waiting for CI",
  READY_TO_MERGE = "Ready to Merge",
  BLOCKED = "Blocked",
}

// Helper function to get status color
const getStatusColor = (status: MRStatusCategory): string => {
  switch (status) {
    case MRStatusCategory.NEEDS_REVIEW:
      return "bg-blue-400 hover:bg-blue-500";
    case MRStatusCategory.CHANGES_REQUESTED:
      return "bg-amber-400 hover:bg-amber-500";
    case MRStatusCategory.WAITING_FOR_CI:
      return "bg-purple-400 hover:bg-purple-500";
    case MRStatusCategory.READY_TO_MERGE:
      return "bg-green-400 hover:bg-green-500";
    case MRStatusCategory.BLOCKED:
      return "bg-red-400 hover:bg-red-500";
    default:
      return "bg-slate-400 hover:bg-slate-500";
  }
};

interface StatusGroupProps {
  status: MRStatusCategory;
  mergeRequests: GitLabMRWithJira[];
  isExpanded?: boolean;
}

export function StatusGroup({
  status,
  mergeRequests,
  isExpanded = false,
}: StatusGroupProps) {
  const [isOpen, setIsOpen] = useState(isExpanded);

  // Determine urgency based on MR age and status
  const urgentCount = mergeRequests.filter((mr) => {
    const daysOld = Math.floor(
      (new Date().getTime() - new Date(mr.created_at).getTime()) /
        (1000 * 60 * 60 * 24)
    );

    // Different urgency thresholds based on status
    switch (status) {
      case MRStatusCategory.NEEDS_REVIEW:
        return daysOld > 3; // Urgent if waiting for review more than 3 days
      case MRStatusCategory.CHANGES_REQUESTED:
        return daysOld > 7; // Urgent if changes requested more than 7 days ago
      case MRStatusCategory.READY_TO_MERGE:
        return daysOld > 1; // Urgent if ready to merge for more than 1 day
      default:
        return daysOld > 14; // Default urgency threshold is 14 days
    }
  }).length;

  // Generate appropriate description based on status
  const getStatusDescription = () => {
    switch (status) {
      case MRStatusCategory.NEEDS_REVIEW:
        return "MRs that are waiting for your review";
      case MRStatusCategory.CHANGES_REQUESTED:
        return "MRs where changes have been requested";
      case MRStatusCategory.WAITING_FOR_CI:
        return "MRs waiting for CI pipeline to complete";
      case MRStatusCategory.READY_TO_MERGE:
        return "MRs that are approved and ready to merge";
      case MRStatusCategory.BLOCKED:
        return "MRs that are blocked by conflicts or other issues";
      default:
        return "Merge requests in this category";
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mb-4">
      <Card
        className={`${isOpen ? "border-primary" : ""} ${
          urgentCount > 0 ? "border-l-4 border-l-red-500" : ""
        }`}
      >
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-accent/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <CardTitle className="text-lg flex items-center gap-2">
                  <Badge className={getStatusColor(status)}>{status}</Badge>
                  <span>
                    {mergeRequests.length} MR
                    {mergeRequests.length !== 1 ? "s" : ""}
                  </span>
                </CardTitle>
              </div>
              {urgentCount > 0 && (
                <Badge variant="destructive">{urgentCount} Urgent</Badge>
              )}
            </div>
            <CardDescription className="pt-2">
              {getStatusDescription()}
            </CardDescription>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent>
            {mergeRequests.length > 0 ? (
              <div className="space-y-3">
                {mergeRequests.map((mr) => (
                  <DevMRRow key={mr.id} mr={mr} statusCategory={status} />
                ))}
              </div>
            ) : (
              <div className="py-3 text-center text-muted-foreground">
                No merge requests in this category
              </div>
            )}
          </CardContent>

          <CardFooter>
            <div className="text-sm text-muted-foreground">
              Updated {new Date().toLocaleString()}
            </div>
          </CardFooter>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
