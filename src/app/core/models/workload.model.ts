import { TeamGroup } from './standup.model';

export interface TeamMemberWorkload {
  name: string;
  imageUrl?: string;
  group?: TeamGroup;
  assignedItems: number;
  completedItems: number;
  remainingItems: number;
  /** Remaining items relative to team average (1.0 = average load) */
  loadRatio: number;
  loadStatus: LoadStatus;
}

import { getCssVar } from '../utils/theme.utils';

export type LoadStatus = 'light' | 'balanced' | 'heavy' | 'overloaded';

export interface RebalanceSuggestion {
  fromMember: string;
  toMember: string;
  suggestedItems: number;
  reason: string;
}

export function getLoadStatus(loadRatio: number): LoadStatus {
  if (loadRatio < 0.5) return 'light';
  if (loadRatio <= 1) return 'balanced';
  if (loadRatio <= 1.5) return 'heavy';
  return 'overloaded';
}

export function getLoadColor(status: LoadStatus): string {
  switch (status) {
    case 'light': return getCssVar('--si-primary', '#0078d4');
    case 'balanced': return getCssVar('--si-success', '#107c10');
    case 'heavy': return getCssVar('--si-warning', '#ff8c00');
    case 'overloaded': return getCssVar('--si-danger', '#e81123');
  }
}
