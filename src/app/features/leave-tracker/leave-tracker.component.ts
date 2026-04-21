import { Component, OnInit, ViewChild, signal, computed, effect } from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  LeaveConfig,
  LeaveEntry,
  PublicHoliday,
} from '../../core/models';
import {
  loadLeaveConfig,
  saveLeaveConfig,
  countBusinessDays,
  formatLeaveRange,
  getUpcomingLeaves,
  isOnLeaveToday,
} from '../../core/services/leave.service';
import { isWeekend } from '../../core/utils/date.utils';
import { getTeamMembers } from '../../core/services/capacity.service';
import { getSelectedTeamContext, teamSwitchCount } from '../../core/services/team-selection.service';
import { loadTeamConfig, getVisibleMembers } from '../../core/services/team-config.service';
import { InfoTooltipComponent } from '../../shared/info-tooltip/info-tooltip.component';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { getCurrentUserDisplayName } from '../../core/services/azure-devops.service';

@Component({
  selector: 'si-leave-tracker',
  standalone: true,
  imports: [DatePipe, InfoTooltipComponent, ConfirmDialogComponent],
  template: require('./leave-tracker.component.html'),
  styles: [require('./leave-tracker.component.scss')],
})
export class LeaveTrackerComponent implements OnInit {
  @ViewChild('confirmDialog') confirmDialog!: ConfirmDialogComponent;

  loading = signal(true);
  error = signal('');
  config = signal<LeaveConfig>({ leaves: [], holidays: [], regions: [] });
  teamMemberNames = signal<string[]>([]);
  currentUserName = signal('');
  searchQuery = signal('');
  memberImageMap = signal<Map<string, string>>(new Map());

  /** Leave form signals */
  selectedMember = signal('');
  leaveStart = signal('');
  leaveEnd = signal('');
  leaveNote = signal('');

  /** Holiday form signals */
  holidayMode = signal(false);
  holidayDate = signal('');
  holidayName = signal('');
  holidayRegion = signal('');
  newRegion = signal('');

  /** Expand/collapse tracking */
  expandedMembers = signal<Set<string>>(new Set());
  expandedRegions = signal<Set<string>>(new Set());

  /** Today's date for min attribute */
  todayStr = new Date().toISOString().substring(0, 10);

  /** Computed: members with their upcoming leaves */
  memberLeaves = computed(() => {
    const cfg = this.config();
    const images = this.memberImageMap();
    return this.teamMemberNames().map((name) => ({
      name,
      imageUrl: images.get(name),
      upcoming: getUpcomingLeaves(name, cfg),
    }));
  });

  /** Computed: filtered by search query */
  filteredMemberLeaves = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this.memberLeaves();
    return this.memberLeaves().filter((ml) => ml.name.toLowerCase().includes(q));
  });

  /** Weekend-only check for add leave button */
  isWeekendOnly = computed(() => {
    const start = this.leaveStart();
    if (!start) return false;
    const end = this.leaveEnd() || start;
    if (start !== end) return false; // range – ignore weekends in calc
    const d = new Date(start + 'T00:00:00');
    return isWeekend(d);
  });

  /** Summary stats */
  totalOnLeave = computed(() => {
    const today = new Date().toISOString().substring(0, 10);
    return this.memberLeaves().filter((ml) =>
      ml.upcoming.some((l) => l.startDate <= today && l.endDate >= today),
    ).length;
  });
  totalUpcomingLeaves = computed(() => {
    const today = new Date().toISOString().substring(0, 10);
    return this.memberLeaves().reduce((sum, ml) => sum + ml.upcoming.filter((l) => l.startDate > today).length, 0);
  });

  /** Computed: holidays grouped by region */
  holidaysByRegion = computed(() => {
    const map = new Map<string, PublicHoliday[]>();
    for (const h of this.config().holidays) {
      if (!map.has(h.region)) map.set(h.region, []);
      map.get(h.region)?.push(h);
    }
    // Sort holidays within each region by date
    for (const list of map.values()) {
      list.sort((a, b) => a.date.localeCompare(b.date));
    }
    return map;
  });

  private teamEffect = effect(() => {
    teamSwitchCount();
    this.loading.set(true);
    this.error.set('');
    this.loadData();
  });

  ngOnInit(): void {}

  async loadData(): Promise<void> {
    try {
      const teamContext = await getSelectedTeamContext();
      const [cfg, rosterMembers, teamConfig, visibleSet] = await Promise.all([
        loadLeaveConfig(),
        getTeamMembers(teamContext.team).catch(() => []),
        loadTeamConfig(),
        getVisibleMembers(),
      ]);

      // Build image map from roster
      const imageMap = new Map<string, string>();
      const names = new Set<string>();
      for (const m of rosterMembers) {
        names.add(m.name);
        if (m.imageUrl) imageMap.set(m.name, m.imageUrl);
      }
      for (const [name] of teamConfig) names.add(name);
      this.memberImageMap.set(imageMap);

      // Filter to only members enabled in standup config
      const filtered = visibleSet
        ? Array.from(names).filter((n) => visibleSet.has(n))
        : Array.from(names);

      const sorted = filtered.sort((a, b) => a.localeCompare(b));
      this.teamMemberNames.set(sorted);
      this.config.set(cfg);

      const userName = getCurrentUserDisplayName();
      this.currentUserName.set(userName);
      this.selectedMember.set(userName);
    } catch (e: any) {
      this.error.set(e.message ?? 'Failed to load leave data');
    } finally {
      this.loading.set(false);
    }
  }

  getLeaveDays(leave: LeaveEntry): number {
    return countBusinessDays(leave.startDate, leave.endDate, this.config().holidays);
  }

  formatRange(leave: LeaveEntry): string {
    return formatLeaveRange(leave);
  }

  isOwnLeave(memberName: string): boolean {
    return this.currentUserName() === memberName;
  }

  isMemberOnLeaveToday(memberName: string): boolean {
    return isOnLeaveToday(memberName, this.config());
  }

  toggleMemberExpand(name: string): void {
    const s = new Set(this.expandedMembers());
    s.has(name) ? s.delete(name) : s.add(name);
    this.expandedMembers.set(s);
  }

  toggleRegionExpand(region: string): void {
    const s = new Set(this.expandedRegions());
    s.has(region) ? s.delete(region) : s.add(region);
    this.expandedRegions.set(s);
  }

  async addLeave(): Promise<void> {
    const member = this.currentUserName();
    const start = this.leaveStart();
    const end = this.leaveEnd() || start;
    if (!member || !start) return;

    const days = countBusinessDays(start, end, this.config().holidays);
    if (days === 0) return;

    const entry: LeaveEntry = {
      memberName: member,
      startDate: start,
      endDate: end,
      days,
      note: this.leaveNote() || undefined,
    };

    const cfg = this.config();
    const updated: LeaveConfig = {
      ...cfg,
      leaves: [...cfg.leaves, entry],
    };
    await saveLeaveConfig(updated);
    this.config.set(updated);

    // Reset form
    this.leaveStart.set('');
    this.leaveEnd.set('');
    this.leaveNote.set('');
  }

  removeLeave(memberName: string, startDate: string): void {
    this.confirmDialog.open({
      title: 'Remove Leave',
      message: `Remove leave for ${memberName} starting ${startDate}?`,
      buttons: [
        { label: 'Cancel', style: 'secondary', action: () => {} },
        {
          label: 'Remove', style: 'danger', action: async () => {
            const cfg = this.config();
            const updated: LeaveConfig = {
              ...cfg,
              leaves: cfg.leaves.filter(
                (l) => !(l.memberName === memberName && l.startDate === startDate),
              ),
            };
            await saveLeaveConfig(updated);
            this.config.set(updated);
          },
        },
      ],
    });
  }

  /** Holiday management */
  toggleHolidayMode(): void {
    this.holidayMode.set(!this.holidayMode());
  }

  async addRegion(): Promise<void> {
    const r = this.newRegion().trim();
    if (!r) return;
    const cfg = this.config();
    if (cfg.regions.some((existing) => existing.toLowerCase() === r.toLowerCase())) {
      this.newRegion.set('');
      return;
    }
    const updated: LeaveConfig = {
      ...cfg,
      regions: [...cfg.regions, r],
    };
    await saveLeaveConfig(updated);
    this.config.set(updated);
    this.newRegion.set('');
  }

  async addHoliday(): Promise<void> {
    const date = this.holidayDate();
    const name = this.holidayName().trim();
    const region = this.holidayRegion();
    if (!date || !name || !region) return;

    const holiday: PublicHoliday = { date, name, region };
    const cfg = this.config();
    const updated: LeaveConfig = {
      ...cfg,
      holidays: [...cfg.holidays, holiday],
    };
    await saveLeaveConfig(updated);
    this.config.set(updated);

    this.holidayDate.set('');
    this.holidayName.set('');
  }

  removeHoliday(date: string, region: string): void {
    this.confirmDialog.open({
      title: 'Remove Holiday',
      message: `Remove holiday on ${date} from ${region}?`,
      buttons: [
        { label: 'Cancel', style: 'secondary', action: () => {} },
        {
          label: 'Remove', style: 'danger', action: async () => {
            const cfg = this.config();
            const updated: LeaveConfig = {
              ...cfg,
              holidays: cfg.holidays.filter(
                (h) => !(h.date === date && h.region === region),
              ),
            };
            await saveLeaveConfig(updated);
            this.config.set(updated);
          },
        },
      ],
    });
  }

  removeRegion(region: string): void {
    this.confirmDialog.open({
      title: 'Remove Region',
      message: `Remove region "${region}" and all its holidays?`,
      buttons: [
        { label: 'Cancel', style: 'secondary', action: () => {} },
        {
          label: 'Remove', style: 'danger', action: async () => {
            const cfg = this.config();
            const updated: LeaveConfig = {
              ...cfg,
              regions: cfg.regions.filter((r) => r !== region),
              holidays: cfg.holidays.filter((h) => h.region !== region),
            };
            await saveLeaveConfig(updated);
            this.config.set(updated);
          },
        },
      ],
    });
  }

  getRegionLabel(code: string): string {
    return `🌍 ${code}`;
  }

  formatHolidayDate(iso: string): string {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  get configuredRegions(): string[] {
    return this.config().regions;
  }

}
