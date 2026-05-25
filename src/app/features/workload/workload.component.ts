import { Component, signal, effect } from '@angular/core';
import {
  TeamMemberWorkload,
  SprintWorkItem
} from '../../core/models';
import { getSprintWorkItems } from '../../core/services/work-item.service';
import { getSelectedTeamContext, selectedTeam, teamSwitchCount } from '../../core/services/team-selection.service';
import { clearSprintCache } from '../../core/services/sprint-data-cache.service';
import { getVisibleMembers, loadTeamConfig } from '../../core/services/team-config.service';
import { InfoTooltipComponent } from '../../shared/info-tooltip/info-tooltip.component';

@Component({
  selector: 'si-workload',
  standalone: true,
  imports: [InfoTooltipComponent],
  templateUrl: './workload.component.html',
  styleUrls: ['./workload.component.scss'],
})
export class WorkloadComponent {
  loading = signal(true);
  error = signal('');
  members = signal<TeamMemberWorkload[]>([]);

  private readonly teamEffect = effect(() => {
    teamSwitchCount();
    this.refresh();
  });

  refresh(): void {
    this.loading.set(true);
    this.error.set('');
    this.loadWorkloadData();
  }

  forceRefresh(): void {
    clearSprintCache();
    this.refresh();
  }

  private async loadWorkloadData(): Promise<void> {
    try {
      const teamContext = await getSelectedTeamContext();
      const items = await getSprintWorkItems(teamContext, selectedTeam()?.areaPath);

      if (items.length === 0) {
        this.error.set('No work items found in current sprint');
        this.loading.set(false);
        return;
      }

      const visibleSet = await getVisibleMembers();
      const teamConfig = await loadTeamConfig();
      const allMembers = this.computeWorkloads(items, teamConfig);
      const members = visibleSet
        ? allMembers.filter(m => visibleSet.has(m.name))
        : allMembers;
      this.members.set(members);
    } catch (e: any) {
      this.error.set(e.message ?? 'Failed to load workload data');
    } finally {
      this.loading.set(false);
    }
  }

  private computeWorkloads(
    items: SprintWorkItem[],
    teamConfig?: Map<string, { group: string; visible: boolean }>,
  ): TeamMemberWorkload[] {
    const taskItems = items.filter(i => i.workItemType === 'Task');
    const memberMap = new Map<string, SprintWorkItem[]>();

    for (const item of taskItems) {
      const name = item.assignedTo;
      if (!memberMap.has(name)) memberMap.set(name, []);
      memberMap.get(name)!.push(item);
    }

    const result: TeamMemberWorkload[] = [];
    for (const [name, memberItems] of memberMap) {
      if (name === 'Unassigned') continue;
      const total = memberItems.length;
      const done = memberItems.filter(i => i.state === 'Done' || i.state === 'Closed').length;
      result.push({
        name,
        group: (teamConfig?.get(name)?.group as any) ?? undefined,
        assignedItems: total,
        completedItems: done,
        remainingItems: total - done,
      });
    }

    return result.sort((a, b) => a.name.localeCompare(b.name));
  }
}
