import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { InfoIcon } from "lucide-react";

interface MRGuidanceProps {
  type: "too-old" | "not-updated" | "pending-review";
  threshold: number;
}

export function MRGuidance({ type, threshold }: MRGuidanceProps) {
  let title = "";
  let description = "";

  switch (type) {
    case "too-old":
      title = "MRs assigned within the team are not too old";
      description = `This table is populated if an MR assigned within the team was created too long ago -- currently ${threshold} days. Get the MR merged or close it.`;
      break;
    case "not-updated":
      title = "MRs assigned within the team are being worked on";
      description = `This table is populated if an MR assigned within the team has not been updated in a while -- currently ${threshold} days. Either the assignee needs to continue working on the MR in order to get it closed out, or the reviewer needs to get that review done.`;
      break;
    case "pending-review":
      title =
        "MRs assigned to be reviewed within the team are being reviewed";
      description = `This table is populated if an MR assigned for review within the team has not been updated in a while -- currently ${threshold} days. The reviewer needs to get that review done.`;
      break;
  }

  return (
    <Alert>
      <InfoIcon className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{description}</AlertDescription>
    </Alert>
  );
}
