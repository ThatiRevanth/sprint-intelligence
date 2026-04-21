import { Component, OnInit, signal, effect } from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  SprintSummary,
  WorkItemTypeCount,
  DelayedItem,
  TopBlocker,
  SprintWorkItem,
  WorkItemGroup,
} from '../../core/models';
import { getSprintWorkItems, enrichWithMissingParents } from '../../core/services/work-item.service';
import { detectBlockers, calculateSprintRisk } from '../../core/services/risk-calculator.service';
import { getSelectedTeamContext, selectedTeam, teamSwitchCount } from '../../core/services/team-selection.service';
import { clearSprintCache } from '../../core/services/sprint-data-cache.service';
import { getSprintInfo } from '../../core/services/iteration.service';
import { getVisibleMembers } from '../../core/services/team-config.service';
import { buildWorkItemGroups } from '../../core/utils/grouping.utils';
import { WorkItemGroupComponent } from '../../shared/work-item-group/work-item-group.component';
import { InfoTooltipComponent } from '../../shared/info-tooltip/info-tooltip.component';
import { themeColors } from '../../core/utils/theme.utils';

@Component({
  selector: 'si-summary',
  standalone: true,
  imports: [DatePipe, WorkItemGroupComponent, InfoTooltipComponent],
  template: require('./summary.component.html'),
  styles: [require('./summary.component.scss')],
})
export class SummaryComponent implements OnInit {
  loading = signal(true);
  error = signal('');
  summary = signal<SprintSummary | null>(null);
  delayedGroups = signal<WorkItemGroup[]>([]);

  private teamEffect = effect(() => {
    teamSwitchCount();
    this.refresh();
  });

  public ngOnInit(): void {}

  refresh(): void {
    this.loading.set(true);
    this.error.set('');
    this.loadSummary();
  }

  forceRefresh(): void {
    clearSprintCache();
    this.refresh();
  }

  private async loadSummary(): Promise<void> {
    try {
      const teamContext = await getSelectedTeamContext();
      const areaPath = selectedTeam()?.areaPath;
      const sprintInfo = await getSprintInfo(teamContext);

      if (!sprintInfo) {
        this.error.set('No active sprint found');
        this.loading.set(false);
        return;
      }

      const allItems = await getSprintWorkItems(teamContext, areaPath);
      const visibleSet = await getVisibleMembers();
      const items = visibleSet
        ? allItems.filter(i => i.assignedTo === 'Unassigned' || visibleSet.has(i.assignedTo))
        : allItems;
      const risk = await calculateSprintRisk(teamContext, items, areaPath);
      const blockers = detectBlockers(items, items);

      // Build parent-child groups from delayed (non-done) items
      const delayed = items.filter(i => i.state !== 'Done' && i.state !== 'Closed');
      const allItemsById = new Map(items.map(i => [i.id, i]));
      await enrichWithMissingParents(items, allItemsById);
      this.delayedGroups.set(buildWorkItemGroups(delayed, allItemsById));

      this.summary.set(this.buildSummary(items, sprintInfo, risk, blockers));
    } catch (e: any) {
      this.error.set(e.message ?? 'Failed to generate summary');
    } finally {
      this.loading.set(false);
    }
  }

  private buildSummary(
    items: SprintWorkItem[],
    sprintInfo: any,
    risk: any,
    blockers: any[]
  ): SprintSummary {
    const completed = items.filter(i => i.state === 'Done' || i.state === 'Closed');
    const delayed = items.filter(i => i.state !== 'Done' && i.state !== 'Closed');

    const totalPoints = items.reduce((s, i) => s + i.storyPoints, 0);
    const donePoints = completed.reduce((s, i) => s + i.storyPoints, 0);

    // By type
    const typeMap = new Map<string, { count: number; points: number }>();
    for (const item of completed) {
      const t = typeMap.get(item.workItemType) ?? { count: 0, points: 0 };
      t.count++;
      t.points += item.storyPoints;
      typeMap.set(item.workItemType, t);
    }
    const completedByType: WorkItemTypeCount[] = Array.from(typeMap.entries()).map(
      ([type, data]) => ({ type, count: data.count, storyPoints: data.points })
    );

    const delayedItems: DelayedItem[] = delayed.map(d => ({
      id: d.id,
      title: d.title,
      assignedTo: d.assignedTo,
      state: d.state,
      storyPoints: d.storyPoints,
      reason: d.agingDays > 2 ? `Stale for ${d.agingDays} days` : 'Not completed',
    }));

    const topBlockers: TopBlocker[] = blockers.slice(0, 5).map(b => ({
      title: b.title,
      reason: b.reason,
      daysSinceUpdate: b.daysSinceUpdate,
    }));

    return {
      sprintName: sprintInfo.name,
      startDate: sprintInfo.startDate,
      endDate: sprintInfo.endDate,
      totalItems: items.length,
      completedItems: completed.length,
      completedStoryPoints: donePoints,
      totalStoryPoints: totalPoints,
      completionPercentage: items.length > 0 ? Math.round((completed.length / items.length) * 100) : 0,
      completedByType,
      delayedItems,
      totalBlockers: blockers.length,
      topBlockers,
      riskScore: risk?.score ?? 0,
      riskLevel: risk?.label ?? 'N/A',
      currentVelocity: completed.length,
      avgPastVelocity: items.length,
      velocityTrend: this.getVelocityTrend(completed.length, items.length),
    };
  }

  private getVelocityTrend(donePoints: number, totalPoints: number): 'improving' | 'stable' | 'declining' {
    if (donePoints >= totalPoints) {
      return 'improving';
    }

    if (donePoints >= totalPoints * 0.7) {
      return 'stable';
    }

    return 'declining';
  }

  getRiskColor(): string {
    const s = this.summary();
    if (!s) return themeColors.textDisabled;
    if (s.riskScore >= 70) return themeColors.success;
    if (s.riskScore >= 40) return themeColors.warning;
    return themeColors.danger;
  }

  copyToClipboard() {
    const s = this.summary();
    if (!s) return;
    const md = this.generateMarkdown(s);
    navigator.clipboard.writeText(md);
  }

  downloadHtml() {
    const s = this.summary();
    if (!s) return;
    const html = this.generateHtmlReport(s);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${s.sprintName}-summary.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private generateMarkdown(s: SprintSummary): string {
    let md = `# Sprint Summary: ${s.sprintName}\n\n`;
    md += `**Period:** ${s.startDate.toLocaleDateString()} — ${s.endDate.toLocaleDateString()}\n\n`;
    md += `## Completion\n`;
md += `- **${s.completionPercentage}%** complete (${s.completedItems}/${s.totalItems} items)\n\n`;

    if (s.completedByType.length > 0) {
      md += `## Completed Work\n`;
      for (const t of s.completedByType) {
        md += `- **${t.type}**: ${t.count} items\n`;
      }
      md += '\n';
    }

    if (s.delayedItems.length > 0) {
      md += `## Delayed / Carried Over\n`;
      for (const d of s.delayedItems) {
        md += `- #${d.id} ${d.title} (${d.assignedTo}, ${d.state})\n`;
      }
      md += '\n';
    }

    if (s.topBlockers.length > 0) {
      md += `## Key Blockers (${s.totalBlockers})\n`;
      for (const b of s.topBlockers) {
        md += `- ${b.title}: ${b.reason}\n`;
      }
      md += '\n';
    }

    md += `## Risk & Velocity\n`;
    md += `- **Risk:** ${s.riskLevel} (${s.riskScore}/100)\n`;
md += `- **Velocity:** ${s.currentVelocity} items (avg: ${s.avgPastVelocity} items, ${s.velocityTrend})\n`;

    return md;
  }

  private generateHtmlReport(s: SprintSummary): string {
    return `<!DOCTYPE html>
<html><head><title>Sprint Summary: ${s.sprintName}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #333; }
  h1 { color: #0078d4; } h2 { margin-top: 24px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
  .stat { font-size: 18px; font-weight: 600; }
  .progress { height: 16px; background: #f0f0f0; border-radius: 8px; overflow: hidden; margin: 8px 0; }
  .progress-fill { height: 100%; background: #107c10; border-radius: 8px; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; }
  th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #eee; }
  th { background: #fafafa; font-size: 12px; text-transform: uppercase; color: #666; }
  .risk-badge { display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: 700; }
</style></head>
<body>
  <h1>Sprint Summary: ${s.sprintName}</h1>
  <p>${s.startDate.toLocaleDateString()} — ${s.endDate.toLocaleDateString()}</p>
  <h2>Completion</h2>
  <div class="progress"><div class="progress-fill" style="width:${s.completionPercentage}%"></div></div>
      <p class="stat">${s.completionPercentage}% — ${s.completedItems}/${s.totalItems} items</p>
  <h2>Risk & Velocity</h2>
  <p>Risk: <span class="risk-badge">${s.riskLevel} (${s.riskScore}/100)</span></p>
      <p>Velocity: ${s.currentVelocity} items (Avg: ${s.avgPastVelocity} items, Trend: ${s.velocityTrend})</p>
  <p><em>Generated on ${new Date().toLocaleDateString()}</em></p>
</body></html>`;
  }
}
