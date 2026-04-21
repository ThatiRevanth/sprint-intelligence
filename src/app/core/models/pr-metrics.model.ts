export interface PRMetrics {
  id: number;
  title: string;
  repositoryName: string;
  authorName: string;
  authorImageUrl?: string;
  status: 'active' | 'completed' | 'abandoned';
  creationDate: Date;
  closedDate?: Date;
  mergeDate?: Date;
  /** Time in hours from PR creation to first reviewer vote */
  timeToFirstReviewHours: number | null;
  /** Time in hours from PR creation to merge */
  timeToMergeHours: number | null;
  /** Number of push iterations (rework count = iterations - 1) */
  iterationCount: number;
  reworkCount: number;
  reviewerNames: string[];
  /** Is this PR stuck (active > 2 days with no review)? */
  isStuck: boolean;
  url: string;
  tags: string[];
}

export interface PRAggregate {
  totalPRs: number;
  completedPRs: number;
  activePRs: number;
  stuckPRs: number;
  avgTimeToFirstReviewHours: number;
  avgTimeToMergeHours: number;
  avgReworkCount: number;
  /** Per-reviewer average review time (hours) */
  reviewerAvgTime: Map<string, number>;
}

export interface ReviewerStats {
  name: string;
  imageUrl?: string;
  avgReviewTimeHours: number;
  reviewCount: number;
}
