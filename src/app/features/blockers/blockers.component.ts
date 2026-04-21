import { Component, OnInit, signal, computed, effect } from "@angular/core";
import {
  BlockerItem,
  BlockerSeverity,
  WorkItemGroup,
  SprintWorkItem,
  getBlockerSeverityColor,
  getBlockerTypeLabel,
} from "../../core/models";
import { getSprintWorkItems, enrichWithMissingParents } from "../../core/services/work-item.service";
import { detectBlockers } from "../../core/services/risk-calculator.service";
import { getSelectedTeamContext, selectedTeam, teamSwitchCount } from '../../core/services/team-selection.service';
import { clearSprintCache } from '../../core/services/sprint-data-cache.service';
import { getVisibleMembers } from "../../core/services/team-config.service";
import { buildWorkItemGroups } from "../../core/utils/grouping.utils";
import { WorkItemGroupComponent } from "../../shared/work-item-group/work-item-group.component";
import { InfoTooltipComponent } from "../../shared/info-tooltip/info-tooltip.component";

@Component({
  selector: "si-blockers",
  standalone: true,
  imports: [WorkItemGroupComponent, InfoTooltipComponent],
  template: require('./blockers.component.html'),
  styles: [require('./blockers.component.scss')],
})
export class BlockersComponent implements OnInit {
  loading = signal(true);
  error = signal("");
  blockers = signal<BlockerItem[]>([]);
  private allItemsById = new Map<number, SprintWorkItem>();
  private readonly sprintItems = signal<SprintWorkItem[]>([]);

  /** Active severity filter — null means show all */
  severityFilter = signal<BlockerSeverity | null>(null);

  highCount = computed(() => this.blockers().filter((b) => b.severity === "high").length);
  mediumCount = computed(() => this.blockers().filter((b) => b.severity === "medium").length);
  lowCount = computed(() => this.blockers().filter((b) => b.severity === "low").length);

  /** Filtered blockers based on selected severity */
  filteredBlockers = computed(() => {
    const filter = this.severityFilter();
    if (!filter) return this.blockers();
    return this.blockers().filter((b) => b.severity === filter);
  });

  /** Groups built from filtered blockers */
  filteredGroups = computed(() => {
    const blockerList = this.filteredBlockers();
    const items = this.sprintItems();
    if (blockerList.length === 0 || items.length === 0) return [];
    const blockerIds = new Set(blockerList.map(b => b.workItemId));
    const blockerWorkItems = items.filter(i => blockerIds.has(i.id));
    return buildWorkItemGroups(blockerWorkItems, this.allItemsById);
  });

  getSeverityColor = getBlockerSeverityColor;
  getTypeLabel = getBlockerTypeLabel;

  private teamEffect = effect(() => {
    teamSwitchCount();
    this.refresh();
  });

  ngOnInit(): void {}

  refresh(): void {
    this.loading.set(true);
    this.error.set('');
    this.severityFilter.set(null);
    this.loadBlockers();
  }

  forceRefresh(): void {
    clearSprintCache();
    this.refresh();
  }

  toggleSeverityFilter(severity: BlockerSeverity): void {
    this.severityFilter.set(this.severityFilter() === severity ? null : severity);
  }

  clearFilter(): void {
    this.severityFilter.set(null);
  }

  private async loadBlockers(): Promise<void> {
    try {
      const teamContext = await getSelectedTeamContext();
      const allItems = await getSprintWorkItems(teamContext, selectedTeam()?.areaPath);
      const visibleSet = await getVisibleMembers();
      const items = visibleSet
        ? allItems.filter(i => i.assignedTo === 'Unassigned' || visibleSet.has(i.assignedTo))
        : allItems;
      const blockerList = detectBlockers(items, items);
      this.blockers.set(blockerList);

      const allItemsById = new Map(items.map(i => [i.id, i]));
      await enrichWithMissingParents(items, allItemsById);
      this.allItemsById = allItemsById;
      this.sprintItems.set(items);
    } catch (e: any) {
      this.error.set(e.message ?? "Failed to detect blockers");
    } finally {
      this.loading.set(false);
    }
  }
}
