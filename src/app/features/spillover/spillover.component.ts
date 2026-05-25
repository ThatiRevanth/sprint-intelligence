import { Component, signal, computed, effect } from '@angular/core';
import { SprintWorkItem, WorkItemGroup } from '../../core/models';
import { getSprintWorkItems } from '../../core/services/work-item.service';
import { getSprintInfo } from '../../core/services/iteration.service';
import { getSelectedTeamContext, selectedTeam, teamSwitchCount } from '../../core/services/team-selection.service';
import { clearSprintCache } from '../../core/services/sprint-data-cache.service';
import { getVisibleMembers } from '../../core/services/team-config.service';
import { InfoTooltipComponent } from '../../shared/info-tooltip/info-tooltip.component';
import { WorkItemGroupComponent } from '../../shared/work-item-group/work-item-group.component';
import { buildWorkItemGroups } from '../../core/utils/grouping.utils';

const DONE_STATES = new Set(['Done', 'Closed', 'Resolved', 'Removed']);
const SPILL_PARENT_TYPES = new Set(['Bug', 'User Story', 'Product Backlog Item']);

const TYPE_ORDER: Record<string, number> = {
  'Bug': 0, 'User Story': 1, 'Product Backlog Item': 1, 'Task': 2,
};

@Component({
  selector: 'si-spillover',
  standalone: true,
  imports: [InfoTooltipComponent, WorkItemGroupComponent],
  templateUrl: './spillover.component.html',
  styleUrls: ['./spillover.component.scss'],
})
export class SpilloverComponent {
  loading = signal(true);
  error = signal('');
  remainingDays = signal<number | null>(null);
  typeFilter = signal<string | null>(null);

  private readonly allItems = signal<SprintWorkItem[]>([]);
  private allItemsById = new Map<number, SprintWorkItem>();

  /** All spilling parent groups — Epics/Features excluded */
  spillGroups = computed<WorkItemGroup[]>(() => {
    const items = this.allItems();
    const spillItems = items.filter(
      item => !DONE_STATES.has(item.state) && item.linkedPrs.length === 0
    );
    const groups = buildWorkItemGroups(spillItems, this.allItemsById);
    return groups
      .filter(g => g.parent === null || SPILL_PARENT_TYPES.has(g.parent.workItemType))
      .sort((a, b) => {
        const ao = TYPE_ORDER[a.parent?.workItemType ?? 'Task'] ?? 99;
        const bo = TYPE_ORDER[b.parent?.workItemType ?? 'Task'] ?? 99;
        return ao - bo;
      });
  });

  /** Count per type for filter chips — derived from unfiltered groups */
  typeOptions = computed(() => {
    const counts = new Map<string, number>();
    for (const g of this.spillGroups()) {
      const t = g.parent?.workItemType ?? 'Task';
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => (TYPE_ORDER[a[0]] ?? 99) - (TYPE_ORDER[b[0]] ?? 99))
      .map(([type, count]) => ({ type, count, label: type === 'Product Backlog Item' ? 'PBI' : type }));
  });

  filteredGroups = computed(() => {
    const filter = this.typeFilter();
    if (!filter) return this.spillGroups();
    return this.spillGroups().filter(g =>
      filter === 'Task' ? g.parent === null : g.parent?.workItemType === filter
    );
  });

  /** Count only parent-level items (not child tasks underneath) */
  totalCount = computed(() => this.spillGroups().filter(g => g.parent !== null).length);

  private readonly teamEffect = effect(() => {
    teamSwitchCount();
    this.refresh();
  });

  refresh(): void {
    this.loading.set(true);
    this.error.set('');
    this.typeFilter.set(null);
    this.loadData();
  }

  forceRefresh(): void {
    clearSprintCache();
    this.refresh();
  }

  toggleTypeFilter(type: string): void {
    this.typeFilter.set(this.typeFilter() === type ? null : type);
  }

  clearFilter(): void {
    this.typeFilter.set(null);
  }

  private async loadData(): Promise<void> {
    try {
      const teamContext = await getSelectedTeamContext();
      const [items, sprintInfo, visibleSet] = await Promise.all([
        getSprintWorkItems(teamContext, selectedTeam()?.areaPath),
        getSprintInfo(teamContext),
        getVisibleMembers(),
      ]);

      this.remainingDays.set(sprintInfo?.remainingDays ?? null);

      const filtered = visibleSet
        ? items.filter(i => i.assignedTo === 'Unassigned' || visibleSet.has(i.assignedTo))
        : items;

      this.allItemsById = new Map(filtered.map(i => [i.id, i]));
      this.allItems.set(filtered);
    } catch (e: any) {
      this.error.set(e.message ?? 'Failed to load spillover data');
    } finally {
      this.loading.set(false);
    }
  }
}

