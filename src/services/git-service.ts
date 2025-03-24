/**
 * Service for Git operations
 */
export interface GitService {
  /**
   * Clones a repository to a local directory
   * @param repoUrl The URL of the repository to clone
   * @returns The path to the cloned repository
   */
  cloneRepository(repoUrl: string): Promise<string>;

  /**
   * Checks out a specific branch
   * @param repoPath The path to the local repository
   * @param branchName The name of the branch to checkout
   */
  checkoutBranch(repoPath: string, branchName: string): Promise<void>;

  /**
   * Rebases the current branch onto another branch
   * @param repoPath The path to the local repository
   * @param targetBranch The branch to rebase onto
   */
  rebaseBranch(repoPath: string, targetBranch: string): Promise<void>;

  /**
   * Checks if a branch can be merged without conflicts
   * @param repoPath The path to the local repository
   * @param sourceBranch The branch to merge from
   * @param targetBranch The branch to merge into
   * @returns Object containing merge status and conflicting files if any
   */
  checkMergeStatus(repoPath: string, sourceBranch: string, targetBranch: string): Promise<{
    canMerge: boolean;
    conflictingFiles: string[];
  }>;

  /**
   * Resolves merge conflicts in specific files
   * @param repoPath The path to the local repository
   * @param files The files with conflicts to resolve
   * @returns Object containing resolution status and files resolved
   */
  resolveConflicts(repoPath: string, files: string[]): Promise<{
    success: boolean;
    resolvedFiles: string[];
    error?: string;
  }>;

  /**
   * Pushes local changes to remote repository
   * @param repoPath The path to the local repository
   * @param branchName The branch to push
   */
  pushChanges(repoPath: string, branchName: string): Promise<void>;
}
