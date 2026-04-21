import { Component, OnInit, signal } from '@angular/core';
import { getSprintWorkItems } from '../../core/services/work-item.service';
import { calculateSprintRisk } from '../../core/services/risk-calculator.service';
import { buildTeamContext, getSprintInfo } from '../../core/services/iteration.service';
import { getWorkClient } from '../../core/services/azure-devops.service';
import { themeColors } from '../../core/utils/theme.utils';

@Component({
  selector: 'si-summary-widget',
  standalone: true,
  template: require('./summary-widget.component.html'),
  styles: [require('./summary-widget.component.scss')],
})
export class SummaryWidgetComponent implements OnInit {
  loading = signal(true);
  sprintName = signal('');
  completed = signal(0);
  inProgress = signal(0);
  remaining = signal(0);
  riskScore = signal(0);
  riskColor = signal(themeColors.textDisabled);
  completionPct = signal(0);

  async ngOnInit() {
    try {
      const ctx = await buildTeamContext();
      let areaPath: string | undefined;
      try {
        const workClient = await getWorkClient();
        const fieldValues = await workClient.getTeamFieldValues(ctx);
        areaPath = fieldValues.defaultValue;
      } catch { /* team may not have field values */ }
      const [info, items, risk] = await Promise.all([
        getSprintInfo(ctx),
        getSprintWorkItems(ctx, areaPath),
        calculateSprintRisk(ctx, undefined, areaPath),
      ]);

      this.sprintName.set(info?.name ?? 'Current Sprint');
      this.completed.set(items.filter(i => i.state === 'Done' || i.state === 'Closed').length);
      this.inProgress.set(items.filter(i => i.state === 'In Progress').length);
      this.remaining.set(items.filter(i => i.state !== 'Done' && i.state !== 'Closed' && i.state !== 'In Progress').length);

      const totalPts = items.reduce((s, i) => s + i.storyPoints, 0);
      const donePts = items.filter(i => i.state === 'Done' || i.state === 'Closed').reduce((s, i) => s + i.storyPoints, 0);
      this.completionPct.set(totalPts > 0 ? Math.round((donePts / totalPts) * 100) : 0);

      if (risk) {
        this.riskScore.set(risk.score);
        this.riskColor.set(risk.color);
      }
    } catch { /* graceful fallback */ }
    this.loading.set(false);
  }
}
