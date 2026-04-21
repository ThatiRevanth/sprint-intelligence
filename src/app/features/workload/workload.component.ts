import { Component, OnInit, signal, effect } from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData } from 'chart.js';
import {
  TeamMemberWorkload,
  RebalanceSuggestion,
  getLoadStatus,
  getLoadColor,
  SprintWorkItem
} from '../../core/models';
import { getSprintWorkItems } from '../../core/services/work-item.service';
import { getSelectedTeamContext, selectedTeam, teamSwitchCount } from '../../core/services/team-selection.service';
import { clearSprintCache } from '../../core/services/sprint-data-cache.service';
import { getVisibleMembers, loadTeamConfig } from '../../core/services/team-config.service';
import { themeColors } from '../../core/utils/theme.utils';
import { InfoTooltipComponent } from '../../shared/info-tooltip/info-tooltip.component';

@Component({
  selector: 'si-workload',
  standalone: true,
  imports: [BaseChartDirective, InfoTooltipComponent],
  template: require('./workload.component.html'),
  styles: [require('./workload.component.scss')],
})
export class WorkloadComponent implements OnInit {
  loading = signal(true);
  error = signal('');
  members = signal<TeamMemberWorkload[]>([]);
  suggestions = signal<RebalanceSuggestion[]>([]);
  workloadChartData = signal<ChartData<'bar'>>({ labels: [], datasets: [] });

  workloadChartOptions: ChartConfiguration<'bar'>['options'] = {
    indexAxis: 'y',
    responsive: true,
    plugins: { legend: { display: false } },
    scales: { x: { beginAtZero: true } },
  };

  getColor = getLoadColor;

  private teamEffect = effect(() => {
    teamSwitchCount();
    this.refresh();
  });

  public ngOnInit(): void {}

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
      this.suggestions.set(this.generateSuggestions(members));
      this.workloadChartData.set(this.buildChart(members));
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
    // Only count Tasks — leaf-level work items
    const taskItems = items.filter(i => i.workItemType === 'Task');

    const memberMap = new Map<string, SprintWorkItem[]>();

    for (const item of taskItems) {
      const name = item.assignedTo;
      if (!memberMap.has(name)) memberMap.set(name, []);
      memberMap.get(name)!.push(item);
    }

    const members: { name: string; total: number; done: number }[] = [];

    for (const [name, memberItems] of memberMap) {
      if (name === 'Unassigned') continue;
      const total = memberItems.length;
      const done = memberItems.filter(i => i.state === 'Done' || i.state === 'Closed').length;
      members.push({ name, total, done });
    }

    const totalRemaining = members.reduce((s, m) => s + (m.total - m.done), 0);
    const avgRemaining = members.length > 0 ? totalRemaining / members.length : 1;

    const result: TeamMemberWorkload[] = members.map(m => {
      const remaining = m.total - m.done;
      const loadRatio = avgRemaining > 0 ? remaining / avgRemaining : 0;
      return {
        name: m.name,
        group: (teamConfig?.get(m.name)?.group as any) ?? undefined,
        assignedItems: m.total,
        completedItems: m.done,
        remainingItems: remaining,
        loadRatio,
        loadStatus: getLoadStatus(loadRatio),
      };
    });

    return result.sort((a, b) => b.loadRatio - a.loadRatio);
  }

  private generateSuggestions(members: TeamMemberWorkload[]): RebalanceSuggestion[] {
    const suggestions: RebalanceSuggestion[] = [];

    // Group members by team group; ungrouped members form their own pool
    const groupMap = new Map<string, TeamMemberWorkload[]>();
    for (const m of members) {
      const key = m.group ?? '__ungrouped__';
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(m);
    }

    for (const [, groupMembers] of groupMap) {
      if (groupMembers.length < 2) continue;

      const totalRemaining = groupMembers.reduce((s, m) => s + m.remainingItems, 0);
      const avgRemaining = totalRemaining / groupMembers.length;
      if (avgRemaining <= 0) continue;

      // Recalculate load status within this group's context
      const groupLoads = groupMembers.map(m => ({
        ...m,
        groupLoadRatio: m.remainingItems / avgRemaining,
        groupStatus: getLoadStatus(m.remainingItems / avgRemaining),
      }));

      // Identify members above and below average for rebalancing
      // Use relaxed thresholds: above = > 1.2x avg, below = < 0.8x avg
      const overloaded = groupLoads.filter(m => m.groupLoadRatio > 1.2);
      const available = groupLoads.filter(m => m.groupLoadRatio < 0.8);

      for (const over of overloaded) {
        for (const under of available) {
          const excessItems = Math.round(over.remainingItems - avgRemaining);
          const availableItems = Math.round(avgRemaining - under.remainingItems);
          const suggestedItems = Math.min(excessItems, availableItems);

          if (suggestedItems > 0) {
            suggestions.push({
              fromMember: over.name,
              toMember: under.name,
              suggestedItems,
              reason: `${over.name} has ${over.remainingItems} remaining, ${under.name} has ${under.remainingItems} (both ${over.group ?? 'unassigned'})`,
            });
          }
        }
      }
    }
    return suggestions;
  }

  private buildChart(members: TeamMemberWorkload[]): ChartData<'bar'> {
    return {
      labels: members.map(m => m.name),
      datasets: [
        {
          label: 'Remaining Items',
          data: members.map(m => m.remainingItems),
          backgroundColor: members.map(m => getLoadColor(m.loadStatus)),
        },
        {
          label: 'Completed Items',
          data: members.map(m => m.completedItems),
          backgroundColor: themeColors.success + '4d',
          borderColor: themeColors.success,
          borderWidth: 1,
        },
      ],
    };
  }
}
