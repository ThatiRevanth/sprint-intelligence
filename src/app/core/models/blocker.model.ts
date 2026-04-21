export interface BlockerItem {
  workItemId: number;
  title: string;
  assignedTo: string;
  assignedToImageUrl?: string;
  blockerType: BlockerType;
  reason: string;
  daysSinceUpdate: number;
  severity: BlockerSeverity;
  url: string;
  /** Related dependency or PR info */
  relatedItemId?: number;
  relatedItemTitle?: string;
  tags?: string[];
}

export type BlockerType = 'stale' | 'blocked-dependency' | 'pr-pending';
export type BlockerSeverity = 'low' | 'medium' | 'high';

import { getCssVar } from '../utils/theme.utils';

export function getBlockerSeverityColor(severity: BlockerSeverity): string {
  switch (severity) {
    case 'low': return getCssVar('--si-warning', '#ff8c00');
    case 'medium': return getCssVar('--si-warning', '#d83b01');
    case 'high': return getCssVar('--si-danger', '#e81123');
  }
}

export function getBlockerTypeLabel(type: BlockerType): string {
  switch (type) {
    case 'stale': return 'Stale — Not Updated';
    case 'blocked-dependency': return 'Blocked by Dependency';
    case 'pr-pending': return 'PR Pending Review/Merge';
  }
}
