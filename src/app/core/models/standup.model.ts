import { SprintWorkItem, WorkItemGroup, HierarchyNode } from './work-item.model';

export type TeamGroup = string;

export const DEFAULT_GROUPS: readonly string[] = ['UX', 'FE', 'BE', 'QA'];
export const TEAM_GROUP_ORDER: string[] = [...DEFAULT_GROUPS];

export const TEAM_GROUP_LABELS: Record<string, string> = {
  UX: 'UX Design',
  FE: 'Frontend',
  BE: 'Backend',
  QA: 'QA / Testing',
};

export const TEAM_GROUP_ICONS: Record<string, string> = {
  UX: '🎨',
  FE: '🖥️',
  BE: '⚙️',
  QA: '🧪',
};

export const DEFAULT_GROUP_ICON = '👥';

export interface CustomGroup {
  key: string;
  label: string;
  icon: string;
}

/** StandupItemGroup is now an alias for the shared WorkItemGroup */
export type StandupItemGroup = WorkItemGroup;

export interface StandupMember {
  name: string;
  imageUrl?: string;
  group: TeamGroup;
  /** Active work items (In Progress, Blocked, etc.) — excludes Done */
  activeItems: SprintWorkItem[];
  /** All sprint work items (active + completed) */
  allItems: SprintWorkItem[];
  /** All items grouped under their parent PBI/Story/Bug */
  itemGroups: WorkItemGroup[];
  /** Full hierarchy tree (Feature → PBI → Task) for tree display — includes all items */
  hierarchy: HierarchyNode[];
}

export interface TeamGroupConfig {
  /** Map of team member name → team group */
  memberGroups: Map<string, TeamGroup>;
}
