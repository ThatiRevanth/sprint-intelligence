import { Component, OnInit, signal } from '@angular/core';
import { PRAggregate } from '../../core/models';
import { getSprintPullRequests, computePRAggregate } from '../../core/services/git.service';
import { getSprintInfo, buildTeamContext } from '../../core/services/iteration.service';
import { themeColors } from '../../core/utils/theme.utils';

@Component({
  selector: 'si-pr-widget',
  standalone: true,
  template: require('./pr-widget.component.html'),
  styles: [require('./pr-widget.component.scss')],
})
export class PrWidgetComponent implements OnInit {
  loading = signal(true);
  dangerColor = themeColors.danger;
  successColor = themeColors.success;
  agg = signal<PRAggregate>({
    totalPRs: 0, completedPRs: 0, activePRs: 0, stuckPRs: 0,
    avgTimeToFirstReviewHours: 0, avgTimeToMergeHours: 0, avgReworkCount: 0,
    reviewerAvgTime: new Map(),
  });

  async ngOnInit() {
    try {
      const ctx = await buildTeamContext();
      const info = await getSprintInfo(ctx);
      if (info) {
        const prs = await getSprintPullRequests(info.startDate, info.endDate);
        this.agg.set(computePRAggregate(prs));
      }
    } catch { /* graceful fallback */ }
    this.loading.set(false);
  }
}
