import { useState, useEffect } from "react";
import { fetchAPI } from "@/lib/api";
import { GitLabUser } from "@/lib/gitlab";
import { toast } from "sonner";

interface UseGitLabUsersResult {
  userIds: number[];
  users: GitLabUser[];
  isLoading: boolean;
  error: string | null;
  fetchUsersByGroup: (groupName: string) => Promise<void>;
  resetToTeamUsers: () => Promise<void>;
}

export function useGitLabUsers(): UseGitLabUsersResult {
  const [userIds, setUserIds] = useState<number[]>([]);
  const [users, setUsers] = useState<GitLabUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch the default team user IDs from the environment variables
  const fetchTeamUserIds = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchAPI("/api/users");

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || "Failed to fetch team user IDs");
      }

      const data = await response.json();
      setUserIds(data.ids);

      // Clear users array since we only have IDs
      setUsers([]);

      return data.ids;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "An error occurred";
      setError(message);
      toast.error(`Error fetching team user IDs: ${message}`);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch user IDs by group name
  const fetchUsersByGroup = async (groupName: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchAPI(
        `/api/users?group=${encodeURIComponent(groupName)}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.details || "Failed to fetch user IDs by group"
        );
      }

      const data = await response.json();
      setUserIds(data.ids);
      setUsers(data.users);

      toast.success(`Loaded ${data.count} users from group "${groupName}"`);

      return data;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "An error occurred";
      setError(message);
      toast.error(`Error fetching users by group: ${message}`);
      return { ids: [], users: [] };
    } finally {
      setIsLoading(false);
    }
  };

  // Reset to the default team user IDs
  const resetToTeamUsers = async () => {
    const ids = await fetchTeamUserIds();
    toast.success(`Reset to ${ids.length} default team members`);
  };

  // Fetch team user IDs on initial load
  useEffect(() => {
    fetchTeamUserIds();
  }, []);

  return {
    userIds,
    users,
    isLoading,
    error,
    fetchUsersByGroup,
    resetToTeamUsers,
  };
}
