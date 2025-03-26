import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  MessageSquare,
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
}

export function TicketGroup({
  ticketWithMRs,
  isExpanded = false,
}: TicketGroupProps) {
  const [isOpen, setIsOpen] = useState(isExpanded);
  const { ticket, mrs, openMRs, stalledMRs } = ticketWithMRs;

  // Mark as reviewed (would be connected to real functionality in Phase 3)
  const handleMarkReviewed = (e: React.MouseEvent) => {
    e.stopPropagation();
    // This would be implemented in Phase 3
    console.log(`Marked ticket ${ticket.key} as reviewed`);
  };

  // Flag for follow-up (would be connected to real functionality in Phase 3)
  const handleFlagFollowUp = (e: React.MouseEvent) => {
    e.stopPropagation();
    // This would be implemented in Phase 3
    console.log(`Flagged ticket ${ticket.key} for follow-up`);
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mb-4">
      <Card className={isOpen ? "border-primary" : ""}>
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
                {openMRs > 0 && (
                  <Badge variant="secondary">
                    {openMRs} Open MR{openMRs !== 1 ? "s" : ""}
                  </Badge>
                )}
                {stalledMRs > 0 && (
                  <Badge variant="destructive">{stalledMRs} Stalled</Badge>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center">
              <CardDescription className="pt-2">
                {ticket.type} •{" "}
                {ticket.assignee
                  ? `Assigned: ${ticket.assignee.name}`
                  : "Unassigned"}{" "}
                • Story Points: {ticket.storyPoints || "N/A"}
              </CardDescription>
              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="sm" onClick={handleMarkReviewed}>
                  Mark Reviewed
                </Button>
                <Button variant="ghost" size="sm" onClick={handleFlagFollowUp}>
                  Flag for Follow-up
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex gap-1"
                  asChild
                >
                  <a
                    href={ticket.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Jira <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent>
            {mrs && mrs.length > 0 ? (
              <div className="space-y-3">
                {mrs.map((mr) => (
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
