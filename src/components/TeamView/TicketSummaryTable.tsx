import { useState } from "react";
import { JiraTicketWithMRs } from "@/types/Jira";
import { JiraTicketStatus } from "@/types/Jira";
import {
  ExternalLink,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { MRRow } from "@/components/POView/MRRow";

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

interface TicketSummaryTableProps {
  tickets: JiraTicketWithMRs[];
  isLoading: boolean;
}

export function TicketSummaryTable({
  tickets,
  isLoading,
}: TicketSummaryTableProps) {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  // Toggle row expansion
  const toggleRow = (ticketId: string) => {
    setExpandedRows((prev) => ({
      ...prev,
      [ticketId]: !prev[ticketId],
    }));
  };

  // Check if a row is expanded
  const isRowExpanded = (ticketId: string) => !!expandedRows[ticketId];

  // Sort tickets: blocked first, then by overdue MRs
  const sortedTickets = [...tickets].sort((a, b) => {
    // First sort by blocked status
    if (
      a.ticket.status === JiraTicketStatus.BLOCKED &&
      b.ticket.status !== JiraTicketStatus.BLOCKED
    ) {
      return -1;
    }
    if (
      a.ticket.status !== JiraTicketStatus.BLOCKED &&
      b.ticket.status === JiraTicketStatus.BLOCKED
    ) {
      return 1;
    }

    // Then sort by overdue MRs
    if (a.overdueMRs !== b.overdueMRs) {
      return b.overdueMRs - a.overdueMRs;
    }

    // Then sort by stalled MRs
    if (a.stalledMRs !== b.stalledMRs) {
      return b.stalledMRs - a.stalledMRs;
    }

    // Finally sort by total MRs
    return b.totalMRs - a.totalMRs;
  });

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]"></TableHead>
            <TableHead className="w-[150px]">Ticket</TableHead>
            <TableHead>Title</TableHead>
            <TableHead className="w-[100px]">Status</TableHead>
            <TableHead className="w-[100px] text-center">Total MRs</TableHead>
            <TableHead className="w-[100px] text-center">Open MRs</TableHead>
            <TableHead className="w-[120px] text-center">Overdue MRs</TableHead>
            <TableHead className="w-[120px] text-center">Stalled MRs</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={9} className="h-24 text-center">
                Loading ticket data...
              </TableCell>
            </TableRow>
          ) : sortedTickets.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="h-24 text-center">
                No tickets found
              </TableCell>
            </TableRow>
          ) : (
            sortedTickets.map((ticketWithMRs) => (
              <Collapsible
                key={ticketWithMRs.ticket.id}
                open={isRowExpanded(ticketWithMRs.ticket.id)}
                onOpenChange={() => toggleRow(ticketWithMRs.ticket.id)}
                asChild
              >
                <>
                  <TableRow
                    className={`
                      group hover:bg-muted/50 cursor-pointer
                      ${
                        ticketWithMRs.ticket.status === JiraTicketStatus.BLOCKED
                          ? "bg-red-50 dark:bg-red-950/20"
                          : ""
                      }
                      ${
                        ticketWithMRs.overdueMRs > 0
                          ? "bg-amber-50 dark:bg-amber-950/20"
                          : ""
                      }
                    `}
                    onClick={() => toggleRow(ticketWithMRs.ticket.id)}
                  >
                    <TableCell>
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 p-0"
                        >
                          {isRowExpanded(ticketWithMRs.ticket.id) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                    </TableCell>
                    <TableCell className="font-medium">
                      <a
                        href={ticketWithMRs.ticket.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {ticketWithMRs.ticket.key}
                        <ExternalLink className="h-3 w-3 inline" />
                      </a>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {ticketWithMRs.ticket.title}
                        {(ticketWithMRs.ticket.status ===
                          JiraTicketStatus.BLOCKED ||
                          ticketWithMRs.overdueMRs > 0) && (
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={getStatusColor(ticketWithMRs.ticket.status)}
                      >
                        {ticketWithMRs.ticket.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {ticketWithMRs.totalMRs}
                    </TableCell>
                    <TableCell className="text-center">
                      {ticketWithMRs.openMRs}
                    </TableCell>
                    <TableCell className="text-center">
                      {ticketWithMRs.overdueMRs > 0 ? (
                        <Badge variant="destructive">
                          {ticketWithMRs.overdueMRs}
                        </Badge>
                      ) : (
                        0
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {ticketWithMRs.stalledMRs > 0 ? (
                        <Badge variant="warning" className="bg-amber-500">
                          {ticketWithMRs.stalledMRs}
                        </Badge>
                      ) : (
                        0
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex gap-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleRow(ticketWithMRs.ticket.id);
                        }}
                      >
                        {isRowExpanded(ticketWithMRs.ticket.id)
                          ? "Hide Details"
                          : "View Details"}
                      </Button>
                    </TableCell>
                  </TableRow>

                  <CollapsibleContent asChild>
                    <TableRow>
                      <TableCell colSpan={9} className="p-0">
                        <div className="bg-muted/50 px-4 py-3">
                          <Card className="overflow-hidden">
                            <div className="space-y-3 p-4">
                              {ticketWithMRs.mergeRequests.length > 0 ? (
                                ticketWithMRs.mergeRequests.map((mr) => (
                                  <MRRow key={mr.id} mr={mr} />
                                ))
                              ) : (
                                <div className="text-center py-4 text-muted-foreground">
                                  No merge requests found for this ticket
                                </div>
                              )}
                            </div>
                          </Card>
                        </div>
                      </TableCell>
                    </TableRow>
                  </CollapsibleContent>
                </>
              </Collapsible>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
