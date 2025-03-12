import { useState } from "react";
import { useGitLabUsers } from "@/hooks/useGitLabUsers";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Search, Users, RefreshCw, X } from "lucide-react";
import { GitLabUser } from "@/lib/gitlab";

export function UserSelector() {
  const { userIds, users, isLoading, fetchUsersByGroup, resetToTeamUsers } =
    useGitLabUsers();
  const [groupName, setGroupName] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleFetchUsers = async () => {
    if (groupName.trim()) {
      await fetchUsersByGroup(groupName.trim());
      setIsDialogOpen(false);
    }
  };

  const handleResetUsers = async () => {
    await resetToTeamUsers();
    setIsDialogOpen(false);
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Users className="h-4 w-4" />
          <span>Change Team ({userIds.length})</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Team Members Selection</DialogTitle>
          <DialogDescription>
            Select team members by group name or search for specific users
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Find by Group Name</CardTitle>
              <CardDescription>
                Enter a group name to fetch all its members
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Input
                  placeholder="Enter group name"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  disabled={isLoading}
                />
                <Button
                  onClick={handleFetchUsers}
                  disabled={!groupName.trim() || isLoading}
                  size="sm"
                >
                  {isLoading ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {users.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  Selected Users ({users.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {users.map((user) => (
                    <Badge key={user.id} variant="secondary">
                      {user.username}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleResetUsers} size="sm">
            <X className="mr-2 h-4 w-4" />
            Reset to Default Team
          </Button>
          <Button onClick={() => setIsDialogOpen(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
