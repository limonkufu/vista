import { GitLabMR } from './gitlab';

export const createMockMR = (id: number, daysOld: number): GitLabMR => {
  const date = new Date();
  date.setDate(date.getDate() - daysOld);
  
  return {
    id,
    iid: id,
    project_id: 1,
    title: `Mock MR ${id} (${daysOld} days old)`,
    description: "This is a mock merge request",
    state: "opened",
    created_at: new Date(date.setDate(date.getDate() - daysOld)).toISOString(),
    updated_at: date.toISOString(),
    merged_at: null,
    closed_at: null,
    target_branch: "main",
    source_branch: `feature/mock-${id}`,
    user_notes_count: 5,
    upvotes: 1,
    downvotes: 0,
    author: { id: 1, username: `user${id}`, name: `User ${id}` },
    assignees: [{ id: 2, username: `assignee${id}`, name: `Assignee ${id}` }],
    assignee: null,
    reviewers: [{ id: 3, username: `reviewer${id}`, name: `Reviewer ${id}` }],
    source_project_id: 1,
    target_project_id: 1,
    labels: ["mock"],
    work_in_progress: false,
    milestone: null,
    merge_when_pipeline_succeeds: false,
    merge_status: "can_be_merged",
    merge_error: null,
    sha: `mock-sha-${id}`,
    merge_commit_sha: null,
    squash_commit_sha: null,
    discussion_locked: null,
    should_remove_source_branch: null,
    force_remove_source_branch: null,
    reference: `!${id}`,
    references: { short: `!${id}`, relative: `!${id}`, full: `group/project!${id}` },
    web_url: `https://gitlab.com/mock/project/-/merge_requests/${id}`,
    time_stats: {
      time_estimate: 0,
      total_time_spent: 0,
      human_time_estimate: null,
      human_total_time_spent: null,
    },
    squash: false,
    task_completion_status: {
      count: 0,
      completed_count: 0,
    },
    has_conflicts: false,
    blocking_discussions_resolved: true,
  };
};

export const generateMockMRs = (count: number, minDays: number, maxDays: number): GitLabMR[] => {
  return Array.from({ length: count }, (_, i) => {
    const daysOld = Math.floor(Math.random() * (maxDays - minDays + 1)) + minDays;
    return createMockMR(i + 1, daysOld);
  });
}; 