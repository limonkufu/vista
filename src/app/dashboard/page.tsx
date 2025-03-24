"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getThresholds } from "@/lib/config";

export default function DashboardPage() {
  const thresholds = getThresholds();

  return (
    <div className="container py-8 space-y-8">
      <div className="max-w-3xl mx-auto text-center space-y-4">
        <h1 className="text-4xl font-bold">GitLab MR Dashboard</h1>
        <p className="text-xl text-muted-foreground">
          Monitor and analyze GitLab merge requests for team hygiene
        </p>
      </div>

      <div className="max-w-3xl mx-auto">
        <p className="text-lg leading-relaxed mb-8">
          This dashboard helps track merge requests that need attention,
          ensuring your team maintains good code review practices and nothing
          falls through the cracks. Use the navigation to explore different
          views of potentially problematic merge requests.
        </p>

        <div className="grid md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Old Merge Requests</CardTitle>
              <CardDescription>
                MRs created over {thresholds.TOO_OLD_THRESHOLD} days ago
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p>
                Identify merge requests that have been open for too long and may
                need to be closed or prioritized for completion.
              </p>
            </CardContent>
            <CardFooter>
              <Button asChild className="w-full">
                <Link href="/dashboard/too-old">View Old MRs</Link>
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Inactive Merge Requests</CardTitle>
              <CardDescription>
                MRs not updated in {thresholds.NOT_UPDATED_THRESHOLD} days
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p>
                Find merge requests that haven&apos;t seen recent activity and might
                need a nudge to keep moving forward.
              </p>
            </CardContent>
            <CardFooter>
              <Button asChild className="w-full">
                <Link href="/dashboard/not-updated">View Inactive MRs</Link>
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pending Review</CardTitle>
              <CardDescription>
                MRs awaiting review for {thresholds.PENDING_REVIEW_THRESHOLD}{" "}
                days
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p>
                Track merge requests that are waiting for team members to review
                and are becoming stale.
              </p>
            </CardContent>
            <CardFooter>
              <Button asChild className="w-full">
                <Link href="/dashboard/pending-review">
                  View Pending Reviews
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
