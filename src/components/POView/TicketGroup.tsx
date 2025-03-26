import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  MessageSquare,
  Check,
  Flag,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { JiraTicketWithMRs } from "@/types/Jira";
import { JiraTicketStatus } from "@/types/Jira";
import { MRRow } from "./MRRow";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"; // Import Tooltip

// Helper function to get status color
const getStatusColor = (status: JiraTicketStatus): string => {
  switch (status) {
    case JiraTicketStatus.TO_DO:
      return "bg-slate-400";
    case JiraTicketStatus.IN_PROGRESS:
      return "bg-blue-400";
    case JiraTicketStatus.IN_REVIEW:
      return "bg-amber-400";
    case JiraTicketStatus.DONE:
      return "bg-green-400";
    case JiraTicketStatus.BLOCKED:
      return "bg-red-400";
    default:
      return "bg-slate-400";
  }
};

interface TicketGroupProps {
  ticketWithMRs: JiraTicketWithMRs;
  isExpanded?: boolean;
  isReviewed: boolean; // Add isReviewed prop
  isFlagged: boolean; // Add isFlagged prop
  onToggleReviewed: (ticketKey: string) => void; // Add callback prop
  onToggleFlagged: (ticketKey: string) => void; // Add callback prop
}

export function TicketGroup({
  ticketWithMRs,
  isExpanded = false,
  isReviewed, // Destructure props
  isFlagged,
  onToggleReviewed,
  onToggleFlagged,
}: TicketGroupProps) {
  const [isOpen, setIsOpen] = useState(isExpanded);
  const { ticket, mrs, openMRs, stalledMRs } = ticketWithMRs;

  // FIX: Use callbacks passed from parent
  const handleMarkReviewed = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleReviewed(ticket.key);
  };

  const handleFlagFollowUp = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFlagged(ticket.key);
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mb-4">
      <Card
        className={`
        ${isOpen ? "border-primary" : ""}
        border-l-4
        ${
          isReviewed
            ? "border-l-green-500"
            : isFlagged
            ? "border-l-amber-500"
            : "border-l-transparent"
        }
      `}
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
                  <Badge variant="outline">{ticket.key}</Badge>
                  {ticket.title}
                </CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={getStatusColor(ticket.status)}>
                  {ticket.status}
                </Badge>
                {openMRs !== undefined && openMRs > 0 && (
                  <Badge variant="secondary">
                    {openMRs} Open MR{openMRs !== 1 ? "s" : ""}
                  </Badge>
                )}
                {stalledMRs !== undefined && stalledMRs > 0 && (
                  <Badge variant="destructive">{stalledMRs} Stalled</Badge>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center mt-2">
              <CardDescription className="pt-2">
                {ticket.type} •{" "}
                {ticket.assignee
                  ? `Assigned: ${ticket.assignee.name}`
                  : "Unassigned"}{" "}
                • Story Points: {ticket.storyPoints || "N/A"}
              </CardDescription>
              {/* FIX: Unified action buttons in header */}
              <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={isReviewed ? "secondary" : "ghost"}
                        size="icon"
                        onClick={handleMarkReviewed}
                        className="h-7 w-7"
                      >
                        <Check
                          className={`h-4 w-4 ${
                            isReviewed ? "text-green-600" : ""
                          }`}
                        />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {isReviewed ? "Mark as Unreviewed" : "Mark as Reviewed"}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={isFlagged ? "secondary" : "ghost"}
                        size="icon"
                        onClick={handleFlagFollowUp}
                        className="h-7 w-7"
                      >
                        <Flag
                          className={`h-4 w-4 ${
                            isFlagged ? "text-amber-600" : ""
                          }`}
                        />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {isFlagged ? "Remove Flag" : "Flag for Follow-up"}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      {/* FIX: Ensure Jira link uses ticket.url */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        asChild
                      >
                        <a
                          href={ticket.url} // Use the URL from the ticket object
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>View in Jira</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent>
            {mrs && mrs.length > 0 ? (
              <div className="space-y-3">
                {mrs.map((mr) => (
                  // Pass down review/flag status if MRRow needs it later
                  <MRRow key={mr.id} mr={mr} />
                ))}
              </div>
            ) : (
              <div className="py-3 text-center text-muted-foreground">
                No merge requests associated with this ticket
              </div>
            )}
          </CardContent>

          <CardFooter className="flex justify-between">
            <div className="text-sm text-muted-foreground">
              {mrs ? mrs.length : 0} Merge Request
              {mrs && mrs.length !== 1 ? "s" : ""}
            </div>
            {ticket.description && (
              <Button variant="ghost" size="sm" className="flex gap-1">
                <MessageSquare className="h-4 w-4" /> View Description
              </Button>
            )}
          </CardFooter>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
