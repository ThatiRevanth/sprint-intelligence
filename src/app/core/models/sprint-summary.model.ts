export interface SprintSummary {
  sprintName: string;
  startDate: Date;
  endDate: Date;

  /** Completion stats */
  totalItems: number;
  completedItems: number;
  completedStoryPoints: number;
  totalStoryPoints: number;
  completionPercentage: number;

  /** Breakdown by work item type */
  completedByType: WorkItemTypeCount[];
  delayedItems: DelayedItem[];

  /** Blockers summary */
  totalBlockers: number;
  topBlockers: TopBlocker[];

  /** Risk & velocity */
  riskScore: number;
  riskLevel: string;
  currentVelocity: number;
  avgPastVelocity: number;
  velocityTrend: 'improving' | 'stable' | 'declining';
}

export interface WorkItemTypeCount {
  type: string;
  count: number;
  storyPoints: number;
}

export interface DelayedItem {
  id: number;
  title: string;
  assignedTo: string;
  state: string;
  storyPoints: number;
  reason: string;
}

export interface TopBlocker {
  title: string;
  reason: string;
  daysSinceUpdate: number;
}
