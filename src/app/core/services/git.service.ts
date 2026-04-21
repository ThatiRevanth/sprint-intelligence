import { getGitClient, getProjectContext } from './azure-devops.service';
import type {
  GitPullRequest,
  GitPullRequestSearchCriteria,
  GitPullRequestCommentThread,
} from 'azure-devops-extension-api/Git';
import { PullRequestStatus } from 'azure-devops-extension-api/Git';
import { PRMetrics, PRAggregate, ReviewerStats } from '../models';
import { hoursBetween } from '../utils/date.utils';

/**
 * Fetch PRs for all repos in the current project within a date range.
 */
export async function getSprintPullRequests(
  startDate: Date,
  endDate: Date
): Promise<PRMetrics[]> {
  const { projectId } = await getProjectContext();
  return getProjectPullRequests(projectId, startDate, endDate);
}

/**
 * Fetch PRs for all repos in a specific project, optionally within a date range.
 */
export async function getProjectPullRequests(
  projectId: string,
  startDate?: Date,
  endDate?: Date
): Promise<PRMetrics[]> {
  const gitClient = await getGitClient();

  const repos = await gitClient.getRepositories(projectId);
  const allPRs: PRMetrics[] = [];

    for (const repo of repos) {
    const completedSearch: GitPullRequestSearchCriteria = {
      status: PullRequestStatus.Completed,
      includeLinks: true,
    } as GitPullRequestSearchCriteria;

    const activeSearch: GitPullRequestSearchCriteria = {
      status: PullRequestStatus.Active,
      includeLinks: true,
    } as GitPullRequestSearchCriteria;

    const [completed, active] = await Promise.all([
      gitClient.getPullRequests(repo.id, completedSearch).catch(() => []),
      gitClient.getPullRequests(repo.id, activeSearch).catch(() => []),
    ]);

    const allRepoPRs = [...completed, ...active].filter((pr) => {
      if (!startDate || !endDate) return true;
      const created = new Date(pr.creationDate);
      return created >= startDate && created <= endDate;
    });

    // Fetch threads for all PRs in this repo in parallel to get real first-review times
    const threadResults = await Promise.all(
      allRepoPRs.map((pr) =>
        gitClient.getThreads(repo.id, pr.pullRequestId).catch(() => [] as GitPullRequestCommentThread[])
      )
    );

    for (let i = 0; i < allRepoPRs.length; i++) {
      const pr = allRepoPRs[i];
      const threads = threadResults[i];
      const firstReviewDate = getFirstReviewDate(threads, pr.createdBy?.id);
      allPRs.push(mapToPRMetrics(pr, repo.name, firstReviewDate));
    }
  }

  return allPRs;
}

/**
 * Find the earliest non-system, non-author comment in PR threads.
 * Returns the date of the first real reviewer comment, or null.
 */
function getFirstReviewDate(
  threads: GitPullRequestCommentThread[],
  authorId?: string
): Date | null {
  let earliest: Date | null = null;

  for (const thread of threads) {
    // Skip system-generated threads (e.g. auto-complete, policy)
    if (!thread.comments || thread.comments.length === 0) continue;

    for (const comment of thread.comments) {
      // Skip system comments (commentType 'system' or 'text' from bot)
      if ((comment as any).commentType === 'system') continue;
      // Skip the PR author's own comments
      if (authorId && (comment.author as any)?.id === authorId) continue;
      // Skip deleted comments
      if (comment.isDeleted) continue;

      const published = comment.publishedDate
        ? new Date(comment.publishedDate)
        : null;
      if (published && (!earliest || published < earliest)) {
        earliest = published;
      }
    }
  }

  return earliest;
}

function mapToPRMetrics(
  pr: GitPullRequest,
  repoName: string,
  firstReviewDate: Date | null
): PRMetrics {
  const creationDate = new Date(pr.creationDate);
  const closedDate = pr.closedDate ? new Date(pr.closedDate) : undefined;
  const now = new Date();

  // Use real first-review timestamp from PR threads
  const timeToFirstReviewHours = firstReviewDate
    ? hoursBetween(creationDate, firstReviewDate)
    : null;

  const timeToMergeHours = closedDate ? hoursBetween(creationDate, closedDate) : null;

  const iterationCount = (pr as any).iterationCount ?? 1;
  const reworkCount = Math.max(0, iterationCount - 1);

  const status: PRMetrics['status'] =
    pr.status === 3
      ? 'completed'
      : pr.status === 2
        ? 'abandoned'
        : 'active';

  const daysSinceCreation = hoursBetween(creationDate, now) / 24;
  const hasReview = firstReviewDate != null || (pr.reviewers?.some((r) => r.vote !== 0) ?? false);
  const isStuck = status === 'active' && daysSinceCreation > 2 && !hasReview;

  return {
    id: pr.pullRequestId,
    title: pr.title,
    repositoryName: repoName,
    authorName: pr.createdBy?.displayName ?? 'Unknown',
    authorImageUrl: pr.createdBy?.imageUrl,
    status,
    creationDate,
    closedDate,
    mergeDate: closedDate,
    timeToFirstReviewHours,
    timeToMergeHours,
    iterationCount,
    reworkCount,
    reviewerNames: pr.reviewers?.map((r) => r.displayName ?? '') ?? [],
    isStuck,
    url: (pr as any)._links?.web?.href ?? '',
    tags: (pr as any).labels?.map((l: any) => l.name) ?? [],
  };
}

/**
 * Compute aggregate PR statistics.
 */
export function computePRAggregate(prs: PRMetrics[]): PRAggregate {
  const completed = prs.filter((p) => p.status === 'completed');
  const active = prs.filter((p) => p.status === 'active');
  const stuck = prs.filter((p) => p.isStuck);

  const reviewTimes = completed
    .filter((p) => p.timeToFirstReviewHours != null)
    .map((p) => p.timeToFirstReviewHours!);

  const mergeTimes = completed
    .filter((p) => p.timeToMergeHours != null)
    .map((p) => p.timeToMergeHours!);

  const reworks = completed.map((p) => p.reworkCount);

  const avgTimeToFirstReview =
    reviewTimes.length > 0
      ? reviewTimes.reduce((a, b) => a + b, 0) / reviewTimes.length
      : 0;
  const avgTimeToMerge =
    mergeTimes.length > 0
      ? mergeTimes.reduce((a, b) => a + b, 0) / mergeTimes.length
      : 0;
  const avgRework =
    reworks.length > 0
      ? reworks.reduce((a, b) => a + b, 0) / reworks.length
      : 0;

  // Per-reviewer average review time
  const reviewerMap = new Map<string, number[]>();
  for (const pr of completed) {
    if (pr.timeToMergeHours != null) {
      for (const reviewer of pr.reviewerNames) {
        if (!reviewerMap.has(reviewer)) reviewerMap.set(reviewer, []);
        reviewerMap.get(reviewer)!.push(pr.timeToMergeHours);
      }
    }
  }

  const reviewerAvgTime = new Map<string, number>();
  reviewerMap.forEach((times, name) => {
    reviewerAvgTime.set(name, times.reduce((a, b) => a + b, 0) / times.length);
  });

  return {
    totalPRs: prs.length,
    completedPRs: completed.length,
    activePRs: active.length,
    stuckPRs: stuck.length,
    avgTimeToFirstReviewHours: Math.round(avgTimeToFirstReview * 10) / 10,
    avgTimeToMergeHours: Math.round(avgTimeToMerge * 10) / 10,
    avgReworkCount: Math.round(avgRework * 10) / 10,
    reviewerAvgTime,
  };
}

/**
 * Build per-reviewer stats.
 */
export function getReviewerStats(prs: PRMetrics[]): ReviewerStats[] {
  const map = new Map<string, { totalHours: number; count: number }>();

  for (const pr of prs.filter((p) => p.status === 'completed')) {
    if (pr.timeToMergeHours == null) continue;
    for (const reviewer of pr.reviewerNames) {
      const existing = map.get(reviewer) ?? { totalHours: 0, count: 0 };
      existing.totalHours += pr.timeToMergeHours;
      existing.count++;
      map.set(reviewer, existing);
    }
  }

  return Array.from(map.entries()).map(([name, data]) => ({
    name,
    avgReviewTimeHours: Math.round((data.totalHours / data.count) * 10) / 10,
    reviewCount: data.count,
  }));
}
