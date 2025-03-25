import { useState } from "react";
import {
  ExternalLink,
  Clock,
  ThumbsUp,
  MessageSquare,
  GitPullRequest,
} from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { GitLabMRWithJira } from "@/types/Jira";
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

interface MRRowProps {
  mr: GitLabMRWithJira;
}

export function MRRow({ mr }: MRRowProps) {
  const [isReviewed, setIsReviewed] = useState(false);
  const [isFlagged, setIsFlagged] = useState(false);

  // Check if MR is stale (older than 14 days without updates)
  const isStale =
    new Date().getTime() - new Date(mr.updated_at).getTime() >
    14 * 24 * 60 * 60 * 1000;

  // Handle marking as reviewed
  const handleMarkReviewed = () => {
    setIsReviewed(!isReviewed);
    // This would be implemented in Phase 3
    console.log(
      `Marked MR ${mr.id} as ${!isReviewed ? "reviewed" : "not reviewed"}`
    );
  };

  // Handle flagging for follow-up
  const handleFlagFollowUp = () => {
    setIsFlagged(!isFlagged);
    // This would be implemented in Phase 3
    console.log(
      `${!isFlagged ? "Flagged" : "Unflagged"} MR ${mr.id} for follow-up`
    );
  };

  return (
    <Card
      className={`
      border-l-4 
      ${
        isReviewed
          ? "border-l-green-500"
          : isFlagged
          ? "border-l-amber-500"
          : isStale
          ? "border-l-red-500"
          : "border-l-transparent"
      }
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
          </div>
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{timeAgo(mr.updated_at)}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  Last updated: {new Date(mr.updated_at).toLocaleString()}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <Badge
              variant={
                mr.state === "opened"
                  ? "default"
                  : mr.state === "merged"
                  ? "success"
                  : "secondary"
              }
            >
              {mr.state}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Author:</span>
            <div className="flex items-center gap-1">
              <Avatar className="h-5 w-5">
                <AvatarImage src={mr.author.avatar_url} alt={mr.author.name} />
                <AvatarFallback>{mr.author.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <span className="text-sm">{mr.author.name}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Reviewers:</span>
            <div className="flex -space-x-1">
              {mr.reviewers.length > 0 ? (
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
              {mr.reviewers.length > 3 && (
                <Avatar className="h-5 w-5 border border-background bg-muted">
                  <AvatarFallback>+{mr.reviewers.length - 3}</AvatarFallback>
                </Avatar>
              )}
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex justify-between py-3 px-6 border-t bg-muted/20">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <ThumbsUp className="h-3 w-3" /> {mr.upvotes}
          </div>
          <div className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" /> {mr.user_notes_count}
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant={isReviewed ? "secondary" : "outline"}
            size="sm"
            onClick={handleMarkReviewed}
          >
            {isReviewed ? "Reviewed" : "Mark Reviewed"}
          </Button>
          <Button
            variant={isFlagged ? "secondary" : "outline"}
            size="sm"
            onClick={handleFlagFollowUp}
          >
            {isFlagged ? "Flagged" : "Flag for Follow-up"}
          </Button>
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
