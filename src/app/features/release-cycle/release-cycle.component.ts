import { Component, OnInit, signal } from '@angular/core';
import { ReleaseGroup } from '../../core/models';
import { getAllProjectReleaseGroups } from '../../core/services/work-item.service';
import { daysBetween } from '../../core/utils/date.utils';
import { clearSprintCache } from '../../core/services/sprint-data-cache.service';
import { InfoTooltipComponent } from '../../shared/info-tooltip/info-tooltip.component';
import { ReleaseCardComponent } from '../../shared/release-card/release-card.component';

@Component({
  selector: 'si-release-cycle',
  standalone: true,
  imports: [InfoTooltipComponent, ReleaseCardComponent],
  templateUrl: './release-cycle.component.html',
  styleUrls: ['./release-cycle.component.scss'],
})
export class ReleaseCycleComponent implements OnInit {
  loading = signal(true);
  error = signal('');
  groups = signal<ReleaseGroup[]>([]);
  expandedGroups = signal<Set<string>>(new Set());

  ngOnInit(): void {
    this.loadData();
  }

  forceRefresh(): void {
    clearSprintCache();
    this.loadData();
  }

  toggleGroup(majorGroup: string): void {
    const s = new Set(this.expandedGroups());
    if (s.has(majorGroup)) {
      s.delete(majorGroup);
    } else {
      s.add(majorGroup);
    }
    this.expandedGroups.set(s);
  }

  isExpanded(majorGroup: string): boolean {
    return this.expandedGroups().has(majorGroup);
  }

  totalItems(group: ReleaseGroup): number {
    const patches = group.patches.reduce((s, p) => s + p.itemsTotal, 0);
    return (group.major?.itemsTotal ?? 0) + patches;
  }

  doneItems(group: ReleaseGroup): number {
    const patches = group.patches.reduce((s, p) => s + p.itemsDone, 0);
    return (group.major?.itemsDone ?? 0) + patches;
  }

  fullCycleDays(group: ReleaseGroup): number | null {
    if (!group.major || group.patches.length === 0) return null;
    const now = new Date();
    const allEpics = [group.major, ...group.patches];
    // If any epic is still open, use today as the end date
    const endDate = allEpics.some(e => e.closedDate === null)
      ? now
      : new Date(Math.max(...allEpics.map(e => e.closedDate!.getTime())));
    return daysBetween(group.major.createdDate, endDate);
  }

  monthLabel(majorGroup: string): string {
    const [yearStr, monthStr] = majorGroup.split('.');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) return '';
    return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  private async loadData(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const data = await getAllProjectReleaseGroups();
      this.groups.set(data);
      // Expand first group by default
      if (data.length > 0) {
        this.expandedGroups.set(new Set([data[0].majorGroup]));
      }
    } catch (e: any) {
      this.error.set(e.message ?? 'Failed to load release data');
    } finally {
      this.loading.set(false);
    }
  }
}
