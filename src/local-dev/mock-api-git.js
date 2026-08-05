/**
 * @file mock-api-git.js
 * Mock for `azure-devops-extension-api/Git` (GitRestClient + PullRequestStatus enum).
 */

import { MOCK_REPOSITORIES, MOCK_PRS, MOCK_PR_THREADS } from './mock-data.js';

export const PullRequestStatus = {
  NotSet:    0,
  Active:    1,
  Abandoned: 2,
  Completed: 3,
  All:       4,
};

export class GitRestClient {
  /** Returns all mock repositories for the project. */
  getRepositories(_projectId) {
    return Promise.resolve(MOCK_REPOSITORIES.map(r => ({ ...r })));
  }

  /**
   * Returns PRs for a repository, filtered by status from the search criteria.
   * Mirrors the live API shape expected by git.service.ts.
   */
  getPullRequests(repoId, searchCriteria) {
    const all = MOCK_PRS[repoId] ?? [];
    const statusFilter = searchCriteria?.status;
    const filtered = statusFilter !== undefined && statusFilter !== PullRequestStatus.All
      ? all.filter(pr => pr.status === statusFilter)
      : all;
    return Promise.resolve(filtered.map(pr => ({ ...pr })));
  }

  /**
   * Returns review comment threads for a PR.
   * Used to compute "time to first review" in git.service.ts.
   */
  getThreads(_repoId, prId) {
    const threads = MOCK_PR_THREADS[prId] ?? [];
    return Promise.resolve(threads);
  }
}
