// File: src/hooks/useGitLabUsers.ts
import { useState, useEffect, useCallback } from "react";
import { fetchAPI } from "@/lib/api";
import { GitLabUser } from "@/lib/gitlab";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { debounce } from "@/lib/utils"; // Import debounce

// Key for storing custom team IDs in localStorage
const TEAM_STORAGE_KEY = "vista-custom-team-ids";

interface UseGitLabUsersResult {
  teamUsers: GitLabUser[]; // Current team members
  searchedUsers: GitLabUser[]; // Results from user search
  isLoadingTeam: boolean; // Loading state for team members
  isLoadingSearch: boolean; // Loading state for search
  errorTeam: string | null; // Error fetching/managing team
  errorSearch: string | null; // Error during search
  fetchUsersByGroup: (groupName: string) => Promise<void>;
  searchUsers: (searchTerm: string) => Promise<void>;
  addUser: (user: GitLabUser) => void;
  removeUser: (userId: number) => void;
  resetToTeamUsers: () => Promise<void>;
  isDefaultTeam: boolean; // Flag indicating if the current team is the default
}

export function useGitLabUsers(): UseGitLabUsersResult {
  const [teamUsers, setTeamUsers] = useState<GitLabUser[]>([]);
  const [searchedUsers, setSearchedUsers] = useState<GitLabUser[]>([]);
  const [isLoadingTeam, setIsLoadingTeam] = useState(true);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);
  const [errorTeam, setErrorTeam] = useState<string | null>(null);
  const [errorSearch, setErrorSearch] = useState<string | null>(null);
  const [isDefaultTeam, setIsDefaultTeam] = useState(true); // Assume default initially

  // --- Persistence ---

  // Load initial team (custom IDs or default)
  const loadInitialTeam = useCallback(async () => {
    setIsLoadingTeam(true);
    setErrorTeam(null);
    let userIdsToLoad: number[] | null = null;
    let isCustom = false;

    try {
      const storedIdsJson = localStorage.getItem(TEAM_STORAGE_KEY);
      if (storedIdsJson) {
        const storedIds = JSON.parse(storedIdsJson) as number[];
        if (Array.isArray(storedIds) && storedIds.length > 0) {
          userIdsToLoad = storedIds;
          isCustom = true;
          logger.info("Loading custom team from localStorage", {
            count: storedIds.length,
          });
        } else {
          localStorage.removeItem(TEAM_STORAGE_KEY); // Clean up invalid entry
        }
      }
    } catch (e) {
      logger.error("Failed to load custom team IDs from localStorage", {
        error: e,
      });
      localStorage.removeItem(TEAM_STORAGE_KEY); // Clean up potentially corrupted data
    }

    try {
      let fetchedUsers: GitLabUser[] = [];
      if (userIdsToLoad) {
        // Fetch users for custom team IDs
        const response = await fetchAPI(
          `/api/users?ids=${userIdsToLoad.join(",")}`
        );
        if (!response.ok) throw new Error("Failed to fetch custom team users");
        const data = await response.json();
        fetchedUsers = data.users || [];
        setIsDefaultTeam(false);
      } else {
        // Fetch default team users
        const response = await fetchAPI("/api/users"); // No params fetches default
        if (!response.ok) throw new Error("Failed to fetch default team users");
        const data = await response.json();
        fetchedUsers = data.users || [];
        setIsDefaultTeam(true);
      }
      setTeamUsers(fetchedUsers);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load team";
      setErrorTeam(message);
      toast.error(`Error loading team: ${message}`);
      setTeamUsers([]); // Reset on error
    } finally {
      setIsLoadingTeam(false);
    }
  }, []);

  // Save custom team IDs to localStorage
  const saveCustomTeamIds = useCallback((users: GitLabUser[]) => {
    try {
      const ids = users.map((u) => u.id);
      localStorage.setItem(TEAM_STORAGE_KEY, JSON.stringify(ids));
      setIsDefaultTeam(false); // Explicitly set as not default when saving custom
      logger.info("Saved custom team IDs to localStorage", {
        count: ids.length,
      });
    } catch (e) {
      logger.error("Failed to save custom team IDs", { error: e });
      toast.error("Could not save custom team configuration.");
    }
  }, []);

  // --- API Actions ---

  // Fetch users by group name and set as current team
  const fetchUsersByGroup = useCallback(
    async (groupName: string) => {
      if (!groupName.trim()) return;
      setIsLoadingTeam(true);
      setErrorTeam(null);
      try {
        const response = await fetchAPI(
          `/api/users?group=${encodeURIComponent(
            groupName.trim()
          )}&refresh=true` // Force refresh
        );
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.details || "Failed to fetch users by group"
          );
        }
        const data = await response.json();
        setTeamUsers(data.users || []);
        saveCustomTeamIds(data.users || []); // Save this group as the new custom team
        toast.success(`Loaded ${data.count} users from group "${groupName}"`);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "An error occurred";
        setErrorTeam(message);
        toast.error(`Error fetching users by group: ${message}`);
      } finally {
        setIsLoadingTeam(false);
      }
    },
    [saveCustomTeamIds]
  );

  // Search for users by name or username
  const searchUsers = useCallback(async (searchTerm: string) => {
    if (!searchTerm.trim() || searchTerm.trim().length < 2) {
      setSearchedUsers([]); // Clear results if search term is too short
      return;
    }
    setIsLoadingSearch(true);
    setErrorSearch(null);
    try {
      const response = await fetchAPI(
        `/api/users?search=${encodeURIComponent(searchTerm.trim())}`
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || "Failed to search users");
      }
      const data = await response.json();
      setSearchedUsers(data.users || []);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "An error occurred";
      setErrorSearch(message);
      toast.error(`Error searching users: ${message}`);
      setSearchedUsers([]);
    } finally {
      setIsLoadingSearch(false);
    }
  }, []);

  // Debounced version of searchUsers
  const debouncedSearchUsers = useCallback(debounce(searchUsers, 300), [
    searchUsers,
  ]);

  // Add a user to the current team
  const addUser = useCallback(
    (user: GitLabUser) => {
      setTeamUsers((prevUsers) => {
        if (prevUsers.some((u) => u.id === user.id)) {
          toast.info(`${user.username} is already in the team.`);
          return prevUsers; // Avoid duplicates
        }
        const newTeam = [...prevUsers, user];
        saveCustomTeamIds(newTeam); // Save updated custom team
        toast.success(`Added ${user.username} to the team.`);
        return newTeam;
      });
      // Clear search results after adding
      setSearchedUsers([]);
    },
    [saveCustomTeamIds]
  );

  // Remove a user from the current team
  const removeUser = useCallback(
    (userId: number) => {
      setTeamUsers((prevUsers) => {
        const userToRemove = prevUsers.find((u) => u.id === userId);
        const newTeam = prevUsers.filter((u) => u.id !== userId);
        if (newTeam.length === prevUsers.length) return prevUsers; // User not found

        if (newTeam.length > 0) {
          saveCustomTeamIds(newTeam); // Save updated custom team
        } else {
          localStorage.removeItem(TEAM_STORAGE_KEY); // Remove key if team becomes empty
          setIsDefaultTeam(true); // Revert to default state if empty? Or allow empty custom team? Let's allow empty for now.
          logger.info("Custom team is now empty. Removed localStorage key.");
        }
        toast.success(
          `Removed ${userToRemove?.username || "user"} from the team.`
        );
        return newTeam;
      });
    },
    [saveCustomTeamIds]
  );

  // Reset to the default team configuration
  const resetToTeamUsers = useCallback(async () => {
    setIsLoadingTeam(true);
    setErrorTeam(null);
    try {
      const response = await fetchAPI("/api/users?refresh=true"); // Force refresh default
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.details || "Failed to fetch default team users"
        );
      }
      const data = await response.json();
      setTeamUsers(data.users || []);
      localStorage.removeItem(TEAM_STORAGE_KEY); // Clear custom team setting
      setIsDefaultTeam(true);
      toast.success(`Reset to ${data.count} default team members`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "An error occurred";
      setErrorTeam(message);
      toast.error(`Error resetting team: ${message}`);
    } finally {
      setIsLoadingTeam(false);
    }
  }, []);

  // --- Effects ---

  // Load initial team on mount
  useEffect(() => {
    loadInitialTeam();
  }, [loadInitialTeam]);

  // --- Return Value ---
  return {
    teamUsers,
    searchedUsers,
    isLoadingTeam,
    isLoadingSearch,
    errorTeam,
    errorSearch,
    fetchUsersByGroup,
    searchUsers: debouncedSearchUsers, // Use the debounced version for UI binding
    addUser,
    removeUser,
    resetToTeamUsers,
    isDefaultTeam,
  };
}
