import { useState } from "react";
import {
  ExternalLink,
  Clock,
  GitPullRequest,
  AlertTriangle,
  Check,
  X,
  MessageSquare,
  CircleAlert,
  GitBranch,
} from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { GitLabMRWithJira } from "@/types/Jira";
import { MRStatusCategory } from "./StatusGroup";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Helper function to format date as time ago
function timeAgo(dateString: string): string {
  const now = new Date();
  const past = new Date(dateString);
  const diffInMs = now.getTime() - past.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInDays === 0) {
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    if (diffInHours === 0) {
      const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
      return `${diffInMinutes} minute${diffInMinutes !== 1 ? "s" : ""} ago`;
    }
    return `${diffInHours} hour${diffInHours !== 1 ? "s" : ""} ago`;
  } else if (diffInDays < 30) {
    return `${diffInDays} day${diffInDays !== 1 ? "s" : ""} ago`;
  } else {
    const diffInMonths = Math.floor(diffInDays / 30);
    return `${diffInMonths} month${diffInMonths !== 1 ? "s" : ""} ago`;
  }
}

interface DevMRRowProps {
  mr: GitLabMRWithJira;
  statusCategory: MRStatusCategory;
}

export function DevMRRow({ mr, statusCategory }: DevMRRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Determine if MR is urgent based on age and status
  const isUrgent = (() => {
    const daysOld = Math.floor(
      (new Date().getTime() - new Date(mr.created_at).getTime()) /
        (1000 * 60 * 60 * 24)
    );

    switch (statusCategory) {
      case MRStatusCategory.NEEDS_REVIEW:
        return daysOld > 3;
      case MRStatusCategory.CHANGES_REQUESTED:
        return daysOld > 7;
      case MRStatusCategory.READY_TO_MERGE:
        return daysOld > 1;
      default:
        return daysOld > 14;
    }
  })();

  // Generate appropriate action button based on status
  const getActionButton = () => {
    switch (statusCategory) {
      case MRStatusCategory.NEEDS_REVIEW:
        return (
          <Button variant="default" size="sm" className="flex gap-1">
            Start Review
          </Button>
        );

      case MRStatusCategory.CHANGES_REQUESTED:
        return (
          <Button variant="default" size="sm" className="flex gap-1">
            View Comments
          </Button>
        );

      case MRStatusCategory.READY_TO_MERGE:
        return (
          <Button variant="default" size="sm" className="flex gap-1">
            Merge
          </Button>
        );

      case MRStatusCategory.BLOCKED:
        return (
          <Button variant="destructive" size="sm" className="flex gap-1">
            Resolve Conflicts
          </Button>
        );

      default:
        return (
          <Button variant="outline" size="sm" className="flex gap-1" asChild>
            <a href={mr.web_url} target="_blank" rel="noopener noreferrer">
              View <ExternalLink className="h-3 w-3" />
            </a>
          </Button>
        );
    }
  };

  // Get CI status indicator
  const getCIStatusIndicator = () => {
    // Simulating CI status based on MR data
    // In a real implementation, this would come from the GitLab API
    const hasPipeline = mr.merge_status !== "cannot_be_merged";
    const pipelineSuccess = mr.merge_status === "can_be_merged";

    if (!hasPipeline) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="flex gap-1 items-center">
                <CircleAlert className="h-3 w-3 text-muted-foreground" />
                No CI
              </Badge>
            </TooltipTrigger>
            <TooltipContent>No CI pipeline found for this MR</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant={pipelineSuccess ? "success" : "destructive"}
              className="flex gap-1 items-center"
            >
              {pipelineSuccess ? (
                <Check className="h-3 w-3" />
              ) : (
                <X className="h-3 w-3" />
              )}
              CI {pipelineSuccess ? "Passed" : "Failed"}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            {pipelineSuccess
              ? "All CI checks have passed"
              : "CI pipeline has failed. Check the pipeline for details."}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <Card
      className={`
      border-l-4 
      ${isUrgent ? "border-l-red-500" : "border-l-transparent"}
    `}
    >
      <CardContent className="py-4">
        <div className="flex justify-between mb-2">
          <div className="flex items-center gap-2">
            <GitPullRequest className="h-4 w-4 text-primary" />
            <h3 className="font-medium">
              <a
                href={mr.web_url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                {mr.title}
              </a>
            </h3>
            {mr.jiraTicketKey && (
              <Badge variant="outline">{mr.jiraTicketKey}</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={`flex items-center gap-1 text-sm ${
                      isUrgent
                        ? "text-red-500 font-medium"
                        : "text-muted-foreground"
                    }`}
                  >
                    <Clock className="h-3 w-3" />
                    <span>{timeAgo(mr.updated_at)}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  Last updated: {new Date(mr.updated_at).toLocaleString()}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {getCIStatusIndicator()}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Branches:</span>
            <div className="flex items-center gap-1">
              <GitBranch className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs bg-muted px-2 py-0.5 rounded">
                {mr.source_branch}
              </span>
              <span className="text-xs">→</span>
              <span className="text-xs bg-muted px-2 py-0.5 rounded">
                {mr.target_branch}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Reviewers:</span>
            <div className="flex -space-x-1">
              {mr.reviewers && mr.reviewers.length > 0 ? (
                mr.reviewers.slice(0, 3).map((reviewer) => (
                  <TooltipProvider key={reviewer.id}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Avatar className="h-5 w-5 border border-background">
                          <AvatarImage
                            src={reviewer.avatar_url}
                            alt={reviewer.name}
                          />
                          <AvatarFallback>
                            {reviewer.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                      </TooltipTrigger>
                      <TooltipContent>{reviewer.name}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">None</span>
              )}
              {mr.reviewers && mr.reviewers.length > 3 && (
                <Avatar className="h-5 w-5 border border-background bg-muted">
                  <AvatarFallback>+{mr.reviewers.length - 3}</AvatarFallback>
                </Avatar>
              )}
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex justify-between py-3 px-6 border-t bg-muted/20">
        <div className="flex items-center gap-3 text-sm">
          <div className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" /> {mr.user_notes_count}
          </div>
          {isUrgent && (
            <div className="flex items-center gap-1 text-red-500">
              <AlertTriangle className="h-3 w-3" /> Needs attention
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {getActionButton()}
          <Button variant="outline" size="sm" className="flex gap-1" asChild>
            <a href={mr.web_url} target="_blank" rel="noopener noreferrer">
              View <ExternalLink className="h-3 w-3" />
            </a>
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
