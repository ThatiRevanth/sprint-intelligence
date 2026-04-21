import { Component, OnInit, signal } from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartConfiguration } from 'chart.js';
import { getLoadStatus, getLoadColor } from '../../core/models';
import { getSprintWorkItems } from '../../core/services/work-item.service';
import { buildTeamContext } from '../../core/services/iteration.service';
import { getWorkClient } from '../../core/services/azure-devops.service';

@Component({
  selector: 'si-workload-widget',
  standalone: true,
  imports: [BaseChartDirective],
  template: require('./workload-widget.component.html'),
  styles: [require('./workload-widget.component.scss')],
})
export class WorkloadWidgetComponent implements OnInit {
  loading = signal(true);
  overloaded = signal(0);
  light = signal(0);
  chartData = signal<ChartData<'bar'>>({ labels: [], datasets: [] });
  chartOptions: ChartConfiguration<'bar'>['options'] = {
    indexAxis: 'y', responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { x: { display: false }, y: { ticks: { font: { size: 10 } } } },
  };

  public ngOnInit(): void {
    this.loadWorkloadData();
  }

  private async loadWorkloadData(): Promise<void> {
    try {
      const ctx = await buildTeamContext();
      let areaPath: string | undefined;
      try {
        const workClient = await getWorkClient();
        const fieldValues = await workClient.getTeamFieldValues(ctx);
        areaPath = fieldValues.defaultValue;
      } catch { /* team may not have field values */ }
      const items = await getSprintWorkItems(ctx, areaPath);

      const memberMap = new Map<string, number>();
      for (const item of items) {
        if (item.assignedTo === 'Unassigned') continue;
        if (item.state === 'Done' || item.state === 'Closed') continue;
        memberMap.set(item.assignedTo, (memberMap.get(item.assignedTo) ?? 0) + 1);
      }

      const names = Array.from(memberMap.keys());
      const counts = names.map(n => memberMap.get(n) ?? 0);
      const totalRemaining = counts.reduce((s, p) => s + p, 0);
      const avgRemaining = names.length > 0 ? totalRemaining / names.length : 1;

      const statuses = counts.map(c => {
        const load = avgRemaining > 0 ? c / avgRemaining : 0;
        return getLoadStatus(load);
      });

      const colors = statuses.map(s => getLoadColor(s));

      this.overloaded.set(statuses.filter(s => s === 'overloaded' || s === 'heavy').length);
      this.light.set(statuses.filter(s => s === 'light').length);

      this.chartData.set({
        labels: names.map(n => n.split(' ')[0]),
        datasets: [{ data: counts, backgroundColor: colors }],
      });
    } catch { /* graceful fallback */ }
    this.loading.set(false);
  }
}
