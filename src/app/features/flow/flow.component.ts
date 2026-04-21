import { Component, OnInit, signal, effect } from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData } from 'chart.js';
import { SprintWorkItem, WorkItemStateCount, AgingWorkItem, WorkItemGroup } from '../../core/models';
import { getSprintWorkItems, classifyAging, enrichWithMissingParents } from '../../core/services/work-item.service';
import { getSelectedTeamContext, selectedTeam, teamSwitchCount } from '../../core/services/team-selection.service';
import { clearSprintCache } from '../../core/services/sprint-data-cache.service';
import { getVisibleMembers } from '../../core/services/team-config.service';
import { buildWorkItemGroups } from '../../core/utils/grouping.utils';
import { WorkItemGroupComponent } from '../../shared/work-item-group/work-item-group.component';
import { InfoTooltipComponent } from '../../shared/info-tooltip/info-tooltip.component';
import { themeColors, stateColor } from '../../core/utils/theme.utils';

@Component({
  selector: 'si-flow',
  standalone: true,
  imports: [BaseChartDirective, WorkItemGroupComponent, InfoTooltipComponent],
  template: require('./flow.component.html'),
  styles: [require('./flow.component.scss')],
})
export class FlowComponent implements OnInit {
  loading = signal(true);
  error = signal('');
  stateCounts = signal<WorkItemStateCount[]>([]);
  agingItems = signal<AgingWorkItem[]>([]);
  agingGroups = signal<WorkItemGroup[]>([]);
  stateChartData = signal<ChartData<'bar'>>({ labels: [], datasets: [] });

  stateChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    plugins: {
      legend: { display: false },
    },
    scales: {
      y: { beginAtZero: true, ticks: { stepSize: 1 } },
    },
  };

  private teamEffect = effect(() => {
    teamSwitchCount();
    this.refresh();
  });

  ngOnInit(): void {}

  forceRefresh(): void {
    clearSprintCache();
    this.refresh();
  }

  async refresh(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const teamContext = await getSelectedTeamContext();
      const allItems = await getSprintWorkItems(teamContext, selectedTeam()?.areaPath);
      const visibleSet = await getVisibleMembers();
      const items = visibleSet
        ? allItems.filter(i => i.assignedTo === 'Unassigned' || visibleSet.has(i.assignedTo))
        : allItems;
      const counts = this.computeStateCounts(items);
      const aging = classifyAging(items);

      // Build parent-child groups from aging items
      const allItemsById = new Map(items.map(i => [i.id, i]));
      await enrichWithMissingParents(items, allItemsById);
      const agingGroups = buildWorkItemGroups(aging, allItemsById);

      this.stateCounts.set(counts);
      this.agingItems.set(aging);
      this.agingGroups.set(agingGroups);
      this.stateChartData.set(this.buildChart(counts));
    } 
    catch (e: any) {
      this.error.set(e.message ?? 'Failed to load work items');
    } 
    finally {
      this.loading.set(false);
    }
  }

  private computeStateCounts(items: SprintWorkItem[]): WorkItemStateCount[] {
    const map = new Map<string, WorkItemStateCount>();
    for (const item of items) {
      const existing = map.get(item.state) ?? {
        state: item.state,
        count: 0,
        storyPoints: 0,
      };
      existing.count++;
      existing.storyPoints += item.storyPoints;
      map.set(item.state, existing);
    }
    return Array.from(map.values());
  }

  private buildChart(stateCounts: WorkItemStateCount[]): ChartData<'bar'> {
    const stateOrder = ['New', 'To Do', 'Approved', 'Committed', 'In Progress', 'Blocked', 'Done', 'Closed'];
    const sorted = [...stateCounts].sort(
      (a, b) =>
        (stateOrder.indexOf(a.state) ?? 99) - (stateOrder.indexOf(b.state) ?? 99)
    );

    return {
      labels: sorted.map((s) => s.state),
      datasets: [
        {
          data: sorted.map((s) => s.count),
          backgroundColor: sorted.map((s) => stateColor(s.state)),
          label: 'Work Items',
        },
      ],
    };
  }
}
