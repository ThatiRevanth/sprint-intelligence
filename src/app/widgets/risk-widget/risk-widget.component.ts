import { Component, OnInit, signal } from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartConfiguration } from 'chart.js';
import { SprintRiskScore } from '../../core/models';
import { calculateSprintRisk } from '../../core/services/risk-calculator.service';
import { buildTeamContext } from '../../core/services/iteration.service';
import { themeColors } from '../../core/utils/theme.utils';

@Component({
  selector: 'si-risk-widget',
  standalone: true,
  imports: [BaseChartDirective],
  template: require('./risk-widget.component.html'),
  styles: [require('./risk-widget.component.scss')],
})
export class RiskWidgetComponent implements OnInit {
  loading = signal(true);
  risk = signal<SprintRiskScore | null>(null);
  gaugeData = signal<ChartData<'doughnut'>>({ datasets: [] });
  gaugeOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true, cutout: '75%', rotation: -90, circumference: 180,
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
  };

  async ngOnInit() {
    try {
      const ctx = await buildTeamContext();
      const r = await calculateSprintRisk(ctx);
      this.risk.set(r);
      if (r) {
        this.gaugeData.set({
          datasets: [{ data: [r.score, 100 - r.score], backgroundColor: [r.color, themeColors.borderLight], borderWidth: 0 }],
        });
      }
    } catch { /* graceful fallback */ }
    this.loading.set(false);
  }
}
