/**
 * Common types for roles
 */

/**
 * GitHub comment interface for role implementations
 */
export interface GitHubComment {
  id: number;
  node_id: string;
  body: string;
  user: {
    login: string;
    id: number;
    node_id: string;
  };
  created_at: string;
  updated_at: string;
}
