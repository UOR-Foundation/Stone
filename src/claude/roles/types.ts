/**
 * Common types for roles
 */

// GitHub comment type
export interface GitHubComment {
  id: number;
  body: string;
  user: {
    login: string;
  };
  created_at: string;
  updated_at: string;
}