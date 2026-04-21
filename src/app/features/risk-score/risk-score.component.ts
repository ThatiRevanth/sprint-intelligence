import { Component, OnInit, signal, effect } from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData } from 'chart.js';
import { SprintRiskScore } from '../../core/models';
import { calculateSprintRisk } from '../../core/services/risk-calculator.service';
import { getSelectedTeamContext, selectedTeam, teamSwitchCount } from '../../core/services/team-selection.service';
import { clearSprintCache } from '../../core/services/sprint-data-cache.service';
import { themeColors } from '../../core/utils/theme.utils';
import { InfoTooltipComponent } from '../../shared/info-tooltip/info-tooltip.component';
import { InfoModalComponent } from '../../shared/info-modal/info-modal.component';

@Component({
  selector: 'si-risk-score',
  standalone: true,
  imports: [BaseChartDirective, InfoTooltipComponent, InfoModalComponent],
  template: require('./risk-score.component.html'),
  styles: [require('./risk-score.component.scss')],
})
export class RiskScoreComponent implements OnInit {
  loading = signal(true);
  error = signal('');

  risk = signal<SprintRiskScore | null>(null);
  gaugeData = signal<ChartData<'doughnut'>>({ labels: [], datasets: [] });

  gaugeOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    cutout: '75%',
    rotation: -90,
    circumference: 180,
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
  };

  private teamEffect = effect(() => {
    teamSwitchCount();
    this.refresh();
  });

  ngOnInit(): void {}

  refresh(): void {
    this.loading.set(true);
    this.error.set('');
    this.loadRiskScore();
  }

  forceRefresh(): void {
    clearSprintCache();
    this.refresh();
  }

  private async loadRiskScore(): Promise<void> {
    try {
      const teamContext = await getSelectedTeamContext();
      const risk = await calculateSprintRisk(teamContext, undefined, selectedTeam()?.areaPath);
      this.risk.set(risk);
      if (risk) {
        this.gaugeData.set({
          datasets: [{
            data: [risk.score, 100 - risk.score],
            backgroundColor: [risk.color, themeColors.borderLight],
            borderWidth: 0,
          }],
        });
      }
    } catch (e: any) {
      this.error.set(e.message ?? 'Failed to calculate risk');
    } finally {
      this.loading.set(false);
    }
  }

  protected getFactorColor(score: number): string {
    if (score >= 70) return themeColors.success;
    if (score >= 40) return themeColors.warning;
    return themeColors.danger;
  }
}
