// File: src/components/UserSelector/UserSelector.tsx
import { useState, useEffect } from "react";
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
  DialogClose,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  Users,
  RefreshCw,
  X,
  Plus,
  Trash2,
  UserPlus,
  UserMinus,
  Loader2,
} from "lucide-react";
import { GitLabUser } from "@/lib/gitlab";

export function UserSelector() {
  const {
    teamUsers,
    searchedUsers,
    isLoadingTeam,
    isLoadingSearch,
    errorTeam,
    errorSearch,
    fetchUsersByGroup,
    searchUsers,
    addUser,
    removeUser,
    resetToTeamUsers,
    isDefaultTeam,
  } = useGitLabUsers();

  const [groupName, setGroupName] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Trigger search when searchTerm changes (debounced in hook)
  useEffect(() => {
    searchUsers(searchTerm);
  }, [searchTerm, searchUsers]);

  const handleFetchGroup = async () => {
    if (groupName.trim()) {
      await fetchUsersByGroup(groupName.trim());
      setGroupName("");
    }
  };

  const handleReset = async () => {
    await resetToTeamUsers();
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Users className="h-4 w-4" />
          <span>
            {isLoadingTeam ? "Loading Team..." : `Team (${teamUsers.length})`}
          </span>
          {!isDefaultTeam && !isLoadingTeam && (
            <Badge variant="secondary" className="ml-1">
              Custom
            </Badge>
          )}
        </Button>
      </DialogTrigger>

      {/* Make DialogContent a flex container */}
      <DialogContent className="sm:max-w-[650px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Manage Team Members</DialogTitle>
          <DialogDescription>
            Import members from a group, add individuals, or reset to default.
            Searches groups under 'ska-telescope/ska-dev'.
          </DialogDescription>
        </DialogHeader>

        {errorTeam && (
          <Badge variant="destructive" className="mt-2">
            Error: {errorTeam}
          </Badge>
        )}

        {/* Make grid container grow and allow content to overflow (for nested scroll) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4 flex-grow overflow-y-auto">
          {/* Left Column: Add Members */}
          <div className="flex flex-col gap-4">
            {/* Import by Group */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Import from Group</CardTitle>
                <CardDescription>
                  Replace current team with members of a group under
                  'ska-telescope/ska-dev'.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  <Input
                    placeholder="Enter group name"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    disabled={isLoadingTeam}
                  />
                  <Button
                    onClick={handleFetchGroup}
                    disabled={!groupName.trim() || isLoadingTeam}
                    size="icon"
                    title="Import Group"
                  >
                    {isLoadingTeam ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <UserPlus className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Add Individual */}
            {/* Ensure this card can grow but has internal scroll */}
            <Card className="flex-grow flex flex-col min-h-[250px]">
              {" "}
              {/* Added min-h */}
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Add Individual</CardTitle>
                <CardDescription>
                  Search by name or username to add members.
                </CardDescription>
              </CardHeader>
              {/* Make content grow and establish relative positioning */}
              <CardContent className="flex-grow flex flex-col gap-2 relative">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search name or username..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                    disabled={isLoadingSearch}
                  />
                </div>
                {errorSearch && (
                  <Badge variant="destructive" className="mt-1">
                    Error: {errorSearch}
                  </Badge>
                )}
                {/* Use absolute positioning for ScrollArea to fill parent */}
                <div className="absolute inset-0 top-[calc(2.25rem+0.5rem)] border rounded-md">
                  {" "}
                  {/* Adjust top offset */}
                  <ScrollArea className="h-full w-full">
                    <div className="p-2 space-y-1">
                      {isLoadingSearch ? (
                        Array.from({ length: 3 }).map((_, i) => (
                          <Skeleton key={i} className="h-8 w-full" />
                        ))
                      ) : searchedUsers.length > 0 ? (
                        searchedUsers.map((user) => (
                          <div
                            key={user.id}
                            className="flex items-center justify-between p-1.5 rounded hover:bg-accent"
                          >
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarImage
                                  src={user.avatar_url}
                                  alt={user.name}
                                />
                                <AvatarFallback>
                                  {user.name.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm">
                                {user.name} ({user.username})
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => addUser(user)}
                              disabled={teamUsers.some(
                                (tu) => tu.id === user.id
                              )}
                              title={
                                teamUsers.some((tu) => tu.id === user.id)
                                  ? "Already in team"
                                  : "Add to team"
                              }
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        ))
                      ) : searchTerm.length > 1 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No users found.
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Enter 2+ characters to search.
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Current Team */}
          {/* Ensure this card can grow but has internal scroll */}
          <Card className="flex flex-col min-h-[250px]">
            {" "}
            {/* Added min-h */}
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex justify-between items-center">
                <span>Current Team ({teamUsers.length})</span>
                {!isDefaultTeam && !isLoadingTeam && (
                  <Badge variant="secondary">Custom Team</Badge>
                )}
                {isDefaultTeam && !isLoadingTeam && (
                  <Badge variant="outline">Default Team</Badge>
                )}
              </CardTitle>
              <CardDescription>
                List of members currently selected for the dashboard.
              </CardDescription>
            </CardHeader>
            {/* Make content grow and establish relative positioning */}
            <CardContent className="flex-grow relative">
              {/* Use absolute positioning for ScrollArea */}
              <div className="absolute inset-0">
                <ScrollArea className="h-full w-full">
                  {isLoadingTeam ? (
                    <div className="space-y-2 p-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-10 w-full" />
                      ))}
                    </div>
                  ) : teamUsers.length > 0 ? (
                    <div className="space-y-2 p-1">
                      {teamUsers.map((user) => (
                        <div
                          key={user.id}
                          className="flex items-center justify-between p-2 rounded border bg-card"
                        >
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarImage
                                src={user.avatar_url}
                                alt={user.name}
                              />
                              <AvatarFallback>
                                {user.name.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium">{user.name}</p>
                              <p className="text-xs text-muted-foreground">
                                @{user.username}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => removeUser(user.id)}
                            title="Remove from team"
                          >
                            <UserMinus className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Team is empty. Add members or reset to default.
                    </p>
                  )}
                </ScrollArea>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                variant="outline"
                onClick={handleReset}
                size="sm"
                disabled={isLoadingTeam || isDefaultTeam}
                className="w-full"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Reset to Default Team
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Dialog Footer remains outside the scrollable grid */}
        <DialogFooter>
          <DialogClose asChild>
            <Button>Done</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
