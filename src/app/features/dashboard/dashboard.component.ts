import { Component, OnInit, signal, computed } from '@angular/core';
import { FlowComponent } from '../flow/flow.component';
import { BlockersComponent } from '../blockers/blockers.component';
import { PrTrackerComponent } from '../pr-tracker/pr-tracker.component';
import { RiskScoreComponent } from '../risk-score/risk-score.component';
import { WorkloadComponent } from '../workload/workload.component';
import { SummaryComponent } from '../summary/summary.component';
import { StandupComponent } from '../standup/standup.component';
import { LeaveTrackerComponent } from '../leave-tracker/leave-tracker.component';
import { TeamSelectorComponent } from '../../shared/team-selector/team-selector.component';
import { getExtensionDataManager } from '../../core/services/azure-devops.service';
import { teamsReady } from '../../core/services/team-selection.service';

type TabId = 'flow' | 'blockers' | 'pr' | 'risk' | 'workload' | 'summary' | 'standup' | 'leaves';

interface Tab {
  id: TabId;
  label: string;
  icon: string;
}

@Component({
  selector: 'si-dashboard',
  standalone: true,
  imports: [
    FlowComponent,
    BlockersComponent,
    PrTrackerComponent,
    RiskScoreComponent,
    WorkloadComponent,
    SummaryComponent,
    StandupComponent,
    LeaveTrackerComponent,
    TeamSelectorComponent,
  ],
  template: require('./dashboard.component.html'),
  styles: [require('./dashboard.component.scss')],
})
export class DashboardComponent implements OnInit {
  activeTab = signal<TabId>('standup');
  settingsOpen = signal(false);

  /** Exposed so template can gate child rendering until teams are loaded */
  teamsReady = teamsReady;

  /** Track which tabs are visible */
  hiddenTabs = signal<Set<TabId>>(new Set());

  private static readonly DOC_COLLECTION = 'dashboard-settings';
  private static readonly DOC_ID = 'tab-visibility';
  private existingDoc: Record<string, any> | null = null;

  tabs: Tab[] = [
    { id: 'standup', label: 'Daily Standup', icon: '📞' },
    { id: 'flow', label: 'Work Item Flow', icon: '🔍' },
    { id: 'blockers', label: 'Blockers', icon: '⚠️' },
    { id: 'pr', label: 'PR Cycle Time', icon: '🔄' },
    { id: 'risk', label: 'Risk Score', icon: '🧠' },
    { id: 'workload', label: 'Workload', icon: '👥' },
    { id: 'summary', label: 'Sprint Summary', icon: '📝' },
    { id: 'leaves', label: 'Leave Tracker', icon: '🏖️' },
  ];

  visibleTabs = computed(() =>
    this.tabs.filter((t) => !this.hiddenTabs().has(t.id)),
  );

  ngOnInit(): void {
    this.loadSettings();
  }

  toggleSettings(): void {
    this.settingsOpen.set(!this.settingsOpen());
  }

  isTabVisible(id: TabId): boolean {
    return !this.hiddenTabs().has(id);
  }

  toggleTab(id: TabId): void {
    const hidden = new Set(this.hiddenTabs());
    if (hidden.has(id)) {
      hidden.delete(id);
    } else {
      hidden.add(id);
      // If we just hid the active tab, switch to first visible
      if (this.activeTab() === id) {
        const firstVisible = this.tabs.find((t) => !hidden.has(t.id));
        if (firstVisible) this.activeTab.set(firstVisible.id);
      }
    }
    this.hiddenTabs.set(hidden);
    this.saveSettings(hidden);
  }

  private async loadSettings(): Promise<void> {
    try {
      const manager = await getExtensionDataManager();
      const doc = await manager.getDocument(
        DashboardComponent.DOC_COLLECTION,
        DashboardComponent.DOC_ID,
      );
      this.existingDoc = doc;
      if (doc?.hiddenTabs) {
        const hidden = new Set<TabId>(doc.hiddenTabs as TabId[]);
        this.hiddenTabs.set(hidden);
        if (hidden.has(this.activeTab())) {
          const first = this.tabs.find((t) => !hidden.has(t.id));
          if (first) this.activeTab.set(first.id);
        }
      }
    } catch {
      this.existingDoc = null;
    }
  }

  private async saveSettings(hidden: Set<TabId>): Promise<void> {
    try {
      const manager = await getExtensionDataManager();
      const doc = {
        ...this.existingDoc,
        id: DashboardComponent.DOC_ID,
        hiddenTabs: Array.from(hidden),
      };
      const saved = await manager.setDocument(DashboardComponent.DOC_COLLECTION, doc);
      this.existingDoc = saved;
    } catch {
      // Silently fail — non-critical
    }
  }
}
