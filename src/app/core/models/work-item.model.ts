export interface LinkedPr {
  id: number;
  repoId: string;
  repoName: string;
  /** The project name where this repo lives (for cross-project PR links) */
  repoProject: string;
}

export interface SprintWorkItem {
  id: number;
  title: string;
  state: string;
  assignedTo: string;
  assignedToImageUrl?: string;
  workItemType: string;
  storyPoints: number;
  lastUpdated: Date;
  createdDate: Date;
  tags: string[];
  parentId?: number;
  url: string;
  /** Relations / links */
  predecessorIds: number[];
  linkedPrs: LinkedPr[];
  /** Computed */
  agingDays: number;
  /** Activity type (e.g. Development, Testing) */
  activity: string;
}

export interface WorkItemStateCount {
  state: string;
  count: number;
  storyPoints: number;
}

export type AgingSeverity = 'normal' | 'warning' | 'critical';

export interface AgingWorkItem extends SprintWorkItem {
  severity: AgingSeverity;
}

export interface WorkItemGroupParent {
  id: number;
  title: string;
  workItemType: string;
  state: string;
  storyPoints: number;
  tags: string[];
  url: string;
  linkedPrs: LinkedPr[];
}

export interface WorkItemGroup {
  parent: WorkItemGroupParent | null;
  children: SprintWorkItem[];
}

/** A QA/testing task that is a sibling under the same parent work item. */
export interface QaItem {
  id: number;
  title: string;
  state: string;
  assignedTo: string;
  tags: string[];
  url: string;
}

/** Multi-level hierarchy tree node (Feature → PBI → Task). */
export interface HierarchyNode {
  item: WorkItemGroupParent;
  childNodes: HierarchyNode[];
  /** True when this node is one of the member's active work items */
  isActiveItem: boolean;
  /** Full work item data (agingDays, linkedPrs, etc.) — only set for active items */
  workItem?: SprintWorkItem;
  /** QA/testing sibling tasks under this parent (assigned to testers) */
  qaItems?: QaItem[];
}
