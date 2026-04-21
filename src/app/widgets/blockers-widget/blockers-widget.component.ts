import { Component, OnInit, signal, computed } from "@angular/core";
import { BlockerItem, getBlockerSeverityColor } from "../../core/models";
import { getSprintWorkItems } from "../../core/services/work-item.service";
import { detectBlockers } from "../../core/services/risk-calculator.service";
import { buildTeamContext } from "../../core/services/iteration.service";
import { getWorkClient } from "../../core/services/azure-devops.service";
import { themeColors } from "../../core/utils/theme.utils";

@Component({
  selector: "si-blockers-widget",
  standalone: true,
  template: require('./blockers-widget.component.html'),
  styles: [require('./blockers-widget.component.scss')],
})
export class BlockersWidgetComponent implements OnInit {
  loading = signal(true);
  blockers = signal<BlockerItem[]>([]);
  topBlockers = computed(() => this.blockers().slice(0, 3));
  getSeverityColor = getBlockerSeverityColor;
  dangerColor = themeColors.danger;
  successColor = themeColors.success;

  async ngOnInit() {
    try {
      const ctx = await buildTeamContext();
      let areaPath: string | undefined;
      try {
        const workClient = await getWorkClient();
        const fieldValues = await workClient.getTeamFieldValues(ctx);
        areaPath = fieldValues.defaultValue;
      } catch { /* team may not have field values */ }
      const items = await getSprintWorkItems(ctx, areaPath);
      this.blockers.set(detectBlockers(items, items));
    } catch {
      /* graceful fallback */
    }
    this.loading.set(false);
  }
}
