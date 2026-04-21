import { Component, OnInit, signal, effect } from '@angular/core';
import { DatePipe } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData } from 'chart.js';
import { PRMetrics, PRAggregate, ReviewerStats } from '../../core/models';
import { getSprintPullRequests, getProjectPullRequests, computePRAggregate, getReviewerStats } from '../../core/services/git.service';
import { getSprintInfo } from '../../core/services/iteration.service';
import { getSelectedTeamContext, teamSwitchCount } from '../../core/services/team-selection.service';
import { clearSprintCache } from '../../core/services/sprint-data-cache.service';
import { getProjectContext, getOrganizationProjects, getExtensionDataManager } from '../../core/services/azure-devops.service';
import { themeColors } from '../../core/utils/theme.utils';
import { InfoTooltipComponent } from '../../shared/info-tooltip/info-tooltip.component';

@Component({
  selector: 'si-pr-tracker',
  standalone: true,
  imports: [DatePipe, BaseChartDirective, InfoTooltipComponent],
  template: require('./pr-tracker.component.html'),
  styles: [require('./pr-tracker.component.scss')],
})
export class PrTrackerComponent implements OnInit {
  loading = signal(true);
  error = signal('');
  prs = signal<PRMetrics[]>([]);
  aggregate = signal<PRAggregate>({
    totalPRs: 0, completedPRs: 0, activePRs: 0, stuckPRs: 0,
    avgTimeToFirstReviewHours: 0, avgTimeToMergeHours: 0, avgReworkCount: 0,
    reviewerAvgTime: new Map(),
  });
  reviewerStats = signal<ReviewerStats[]>([]);
  cycleChartData = signal<ChartData<'bar'>>({ labels: [], datasets: [] });

  projects = signal<{ id: string; name: string }[]>([]);
  currentProjectId = signal('');
  selectedProjectId = signal('');

  cycleChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true } },
  };

  private teamEffect = effect(() => {
    teamSwitchCount();
    this.loading.set(true);
    this.error.set('');
    this.initProjects();
  });

  ngOnInit(): void {}

  refresh(): void {
    this.loading.set(true);
    this.error.set('');
    this.loadPRData();
  }

  forceRefresh(): void {
    clearSprintCache();
    this.refresh();
  }

  async onProjectChange(projectId: string): Promise<void> {
    this.selectedProjectId.set(projectId);
    this.loading.set(true);
    this.error.set('');
    this.loadPRData();
  }

  private async initProjects(): Promise<void> {
    try {
      const [ctx, allProjects] = await Promise.all([
        getProjectContext(),
        getOrganizationProjects(),
      ]);
      this.currentProjectId.set(ctx.projectId);
      this.projects.set(allProjects);

      // Auto-select the mapped code project from standup config
      const mappedId = await this.getMappedCodeProjectId(ctx.projectId, allProjects);
      this.selectedProjectId.set(mappedId ?? ctx.projectId);
    } catch {
      // Fall back to current project only
    }
    this.loadPRData();
  }

  /**
   * Load the code project mapping from standup team config.
   * Returns the project ID of the first mapped code project, or null.
   */
  private async getMappedCodeProjectId(
    projectId: string, allProjects: { id: string; name: string }[]
  ): Promise<string | null> {
    try {
      const teamContext = await getSelectedTeamContext();
      const docId = `${projectId}-${teamContext.team}`
        .replaceAll(/[^a-zA-Z0-9\-_]/g, '_')
        .substring(0, 50);
      const manager = await getExtensionDataManager();
      const doc = await manager.getDocument('standup-team-groups', docId);
      const codeProjects = doc?.codeProjects as string[] | undefined;
      if (codeProjects && codeProjects.length > 0) {
        const match = allProjects.find(p => p.name === codeProjects[0]);
        if (match) return match.id;
      }
    } catch {
      // No config saved yet
    }
    return null;
  }

  private async loadPRData(): Promise<void> {
    try {
      const isCurrentProject = this.selectedProjectId() === this.currentProjectId();

      let prs: PRMetrics[];
      if (isCurrentProject) {
        const teamContext = await getSelectedTeamContext();
        const sprintInfo = await getSprintInfo(teamContext);
        if (!sprintInfo) {
          this.error.set('No active sprint found');
          this.loading.set(false);
          return;
        }
        prs = await getSprintPullRequests(sprintInfo.startDate, sprintInfo.endDate);
      } else {
        prs = await getProjectPullRequests(this.selectedProjectId());
      }

      this.prs.set(prs);
      this.aggregate.set(computePRAggregate(prs));
      this.reviewerStats.set(getReviewerStats(prs));
      this.cycleChartData.set(this.buildCycleChart(prs));
    } catch (e: any) {
      this.error.set(e.message ?? 'Failed to load PR data');
    } finally {
      this.loading.set(false);
    }
  }

  private buildCycleChart(prs: PRMetrics[]): ChartData<'bar'> {
    const completed = prs
      .filter(p => p.status === 'completed' && p.timeToMergeHours != null)
      .sort((a, b) => new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime())
      .slice(0, 25)
      .reverse();
    const labels = completed.map(p => `#${p.id}`);
    const data = completed.map(p => p.timeToMergeHours ?? 0);
    const colors = data.map(h => this.getColor(h));

    return {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        label: 'Hours to Merge',
      }],
    };
  }

  private getColor(h: number): string {
    if (h > 48) {
      return themeColors.danger;
    } else if (h > 24) {
      return themeColors.warning;
    } else {
      return themeColors.success;
    }
  }
}
