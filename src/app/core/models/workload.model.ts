import { TeamGroup } from './standup.model';

export interface TeamMemberWorkload {
  name: string;
  imageUrl?: string;
  group?: TeamGroup;
  assignedItems: number;
  completedItems: number;
  remainingItems: number;
}
