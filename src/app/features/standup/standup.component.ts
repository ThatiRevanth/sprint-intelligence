import {
  Component,
  HostListener,
  OnInit,
  OnDestroy,
  signal,
  computed,
  effect,
} from "@angular/core";
import {
  StandupMember,
  TeamGroup,
  DEFAULT_GROUPS,
  TEAM_GROUP_LABELS,
  TEAM_GROUP_ICONS,
  DEFAULT_GROUP_ICON,
  CustomGroup,
  SprintWorkItem,
  LeaveConfig,
  LeaveEntry,
  PublicHoliday,
} from "../../core/models";
import {
  getSprintWorkItems,
  enrichWithMissingParents,
  setCodeProjects,
} from "../../core/services/work-item.service";
import {
  getSelectedTeamContext,
  selectedTeam,
  teamSwitchCount,
  teamSelectorDisabled,
} from "../../core/services/team-selection.service";
import { clearSprintCache } from '../../core/services/sprint-data-cache.service';
import { getSprintInfo } from "../../core/services/iteration.service";
import {
  getProjectContext,
  getExtensionDataManager,
  getOrganizationProjects,
} from "../../core/services/azure-devops.service";
import { getTeamMembers } from "../../core/services/capacity.service";
import {
  loadLeaveConfig,
  getUpcomingLeaves,
  isOnLeaveToday,
  formatLeaveRange,
  getActiveLeave,
  getNextWorkingDay,
} from "../../core/services/leave.service";
import {
  buildWorkItemGroups,
  buildHierarchyTree,
  attachQaItems,
} from "../../core/utils/grouping.utils";
import { WorkItemGroupComponent } from "../../shared/work-item-group/work-item-group.component";
import { InfoTooltipComponent } from "../../shared/info-tooltip/info-tooltip.component";
import { DatePipe } from "@angular/common";

const DOC_COLLECTION = "standup-team-groups";

@Component({
  selector: "si-standup",
  standalone: true,
  imports: [DatePipe, WorkItemGroupComponent, InfoTooltipComponent],
  template: require("./standup.component.html"),
  styles: [require("./standup.component.scss")],
})
export class StandupComponent implements OnInit, OnDestroy {
  loading = signal(true);
  error = signal("");
  sprintName = signal("");
  today = signal(new Date());

  /** Ordered list of all standup members (grouped by team) */
  standupMembers = signal<StandupMember[]>([]);

  /** Current index in presenter mode */
  currentIndex = signal(-1);

  /** Whether we're in presenter (one-at-a-time) mode */
  presenterMode = signal(false);

  /** For team config editing */
  configMode = signal(false);
  teamMembers = signal<
    { name: string; group: TeamGroup; visible: boolean; region: string }[]
  >([]);
  customGroups = signal<CustomGroup[]>([]);
  groupOrder = signal<string[]>([...DEFAULT_GROUPS]);
  newGroupName = signal("");
  private docId = "";
  private existingDoc: Record<string, any> | null = null;
  leaveConfig = signal<LeaveConfig>({ leaves: [], holidays: [], regions: [] });
  /** Code project mappings: where repos/PRs live if different from work item project */
  codeProjectMappings = signal<string[]>([]);
  newCodeProject = signal("");
  /** All org projects for the dropdown (excludes current project) */
  availableProjects = signal<{ id: string; name: string }[]>([]);
  /** Active config tab */
  configTab = signal<"members" | "groups" | "mapping">("members");

  /** Derived: current member in presenter mode */
  currentMember = computed(() => {
    const idx = this.currentIndex();
    const members = this.standupMembers();
    return idx >= 0 && idx < members.length ? members[idx] : null;
  });

  /** Progress text */
  progressText = computed(() => {
    const idx = this.currentIndex();
    const total = this.standupMembers().length;
    if (idx < 0) return "";
    return `${idx + 1} / ${total}`;
  });

  getGroupLabel(group: string): string {
    if (TEAM_GROUP_LABELS[group]) return TEAM_GROUP_LABELS[group];
    const custom = this.customGroups().find((g) => g.key === group);
    return custom?.label ?? group;
  }

  getGroupIcon(group: string): string {
    if (TEAM_GROUP_ICONS[group]) return TEAM_GROUP_ICONS[group];
    const custom = this.customGroups().find((g) => g.key === group);
    return custom?.icon ?? DEFAULT_GROUP_ICON;
  }

  private teamEffect = effect(() => {
    teamSwitchCount();
    this.refresh();
  });

  ngOnInit(): void {}

  ngOnDestroy(): void {
    teamSelectorDisabled.set(false);
  }

  refresh(): void {
    this.loading.set(true);
    this.error.set("");
    this.presenterMode.set(false);
    this.currentIndex.set(-1);
    this.loadStandupData();
  }

  forceRefresh(): void {
    clearSprintCache();
    this.refresh();
  }

  /** Refresh data while keeping presenter mode and current member */
  refreshInPlace(): void {
    const currentName = this.currentMember()?.name;
    this.loading.set(true);
    this.error.set("");
    this.loadStandupData().then(() => {
      if (currentName) {
        const idx = this.standupMembers().findIndex(
          (m) => m.name === currentName,
        );
        if (idx >= 0) {
          this.currentIndex.set(idx);
          this.presenterMode.set(true);
        }
      }
    });
  }

  private async loadStandupData(): Promise<void> {
    try {
      const teamContext = await getSelectedTeamContext();
      const sprintInfo = await getSprintInfo(teamContext);
      this.sprintName.set(sprintInfo?.name ?? "Current Sprint");

      // Scope data document to project+team (sanitize for Extension Data Service:
      // IDs must be alphanumeric/dash/underscore and ≤50 chars)
      const { projectId } = await getProjectContext();
      this.docId = `${projectId}-${teamContext.team}`
        .replaceAll(/[^a-zA-Z0-9\-_]/g, "_")
        .substring(0, 50);

      // Load saved config first so code project mappings are ready for repo resolution
      const savedConfig = await this.loadTeamConfig();
      setCodeProjects(this.codeProjectMappings());

      const [items, rosterMembers, leaveConfig] = await Promise.all([
        getSprintWorkItems(teamContext, selectedTeam()?.areaPath),
        getTeamMembers(teamContext.team).catch(() => []),
        loadLeaveConfig().catch(
          () => ({ leaves: [], holidays: [], regions: [] }) as LeaveConfig,
        ),
      ]);
      this.leaveConfig.set(leaveConfig);

      // Index all items by id for parent lookup
      const allItemsById = new Map(items.map((i) => [i.id, i]));
      await enrichWithMissingParents(items, allItemsById);

      // Build parent → children lookup for QA sibling item discovery
      const childrenByParentId = new Map<number, SprintWorkItem[]>();
      for (const item of items) {
        if (item.parentId) {
          if (!childrenByParentId.has(item.parentId))
            childrenByParentId.set(item.parentId, []);
          childrenByParentId.get(item.parentId)!.push(item);
        }
      }

      // Build member → items map (only for team roster + configured members)
      const teamMemberNames = new Set<string>();
      const memberImageMap = new Map<string, string>();
      for (const rm of rosterMembers) {
        teamMemberNames.add(rm.name);
        if (rm.imageUrl) memberImageMap.set(rm.name, rm.imageUrl);
      }
      for (const name of savedConfig.keys()) teamMemberNames.add(name);

      const memberItemMap = new Map<string, SprintWorkItem[]>();
      for (const item of items) {
        if (item.assignedTo === "Unassigned") continue;
        if (!teamMemberNames.has(item.assignedTo)) continue;
        if (!memberItemMap.has(item.assignedTo))
          memberItemMap.set(item.assignedTo, []);
        memberItemMap.get(item.assignedTo)!.push(item);
        // Pick up image from work item if not already known
        if (item.assignedToImageUrl && !memberImageMap.has(item.assignedTo)) {
          memberImageMap.set(item.assignedTo, item.assignedToImageUrl);
        }
      }

      // Include all team roster members (even those with no sprint items)
      for (const name of teamMemberNames) {
        if (!memberItemMap.has(name)) memberItemMap.set(name, []);
      }

      // Build standup members with parent-child grouping
      const allMembers: StandupMember[] = [];
      for (const [name, allMemberItems] of memberItemMap) {
        const activeItems = allMemberItems.filter(
          (i) => i.state !== "Done" && i.state !== "Closed",
        );

        const itemGroups = buildWorkItemGroups(allMemberItems, allItemsById);
        const hierarchy = buildHierarchyTree(allMemberItems, allItemsById);

        // Attach QA sibling tasks to hierarchy nodes
        const memberItemIds = new Set(allMemberItems.map((i) => i.id));
        attachQaItems(hierarchy, memberItemIds, childrenByParentId);

        const cfg = savedConfig.get(name);

        allMembers.push({
          name,
          imageUrl: memberImageMap.get(name),
          group: cfg?.group ?? "FE",
          activeItems,
          allItems: allMemberItems,
          itemGroups,
          hierarchy,
        });
      }

      // Sort by group order, then alphabetically within group
      const order = this.groupOrder();
      const groupIdx = (g: TeamGroup) => {
        const idx = order.indexOf(g);
        return idx >= 0 ? idx : order.length;
      };
      allMembers.sort((a, b) => {
        const gDiff = groupIdx(a.group) - groupIdx(b.group);
        if (gDiff !== 0) return gDiff;
        return a.name.localeCompare(b.name);
      });

      // Filter out hidden members for standup display
      const visibleMembers = allMembers.filter(
        (m) => savedConfig.get(m.name)?.visible !== false,
      );
      this.standupMembers.set(visibleMembers);
      this.teamMembers.set(
        allMembers.map((m) => ({
          name: m.name,
          group: m.group,
          visible: savedConfig.get(m.name)?.visible !== false,
          region: savedConfig.get(m.name)?.region ?? "",
        })),
      );
    } catch (e: any) {
      this.error.set(e.message ?? "Failed to load standup data");
    } finally {
      this.loading.set(false);
    }
  }

  /** Start presenter mode from the first person */
  startStandup(): void {
    this.presenterMode.set(true);
    this.currentIndex.set(0);
    teamSelectorDisabled.set(true);
  }

  /** Go to next team member */
  next(): void {
    const idx = this.currentIndex();
    if (idx < this.standupMembers().length - 1) {
      this.currentIndex.set(idx + 1);
    }
  }

  /** Go to previous team member */
  prev(): void {
    const idx = this.currentIndex();
    if (idx > 0) {
      this.currentIndex.set(idx - 1);
    }
  }

  /** Exit presenter mode */
  exitPresenter(): void {
    this.presenterMode.set(false);
    this.currentIndex.set(-1);
    teamSelectorDisabled.set(false);
  }

  /** Jump to a specific member */
  goToMember(index: number): void {
    this.currentIndex.set(index);
    if (!this.presenterMode()) {
      this.presenterMode.set(true);
      teamSelectorDisabled.set(true);
    }
  }

  /** Keyboard navigation */
  @HostListener("document:keydown", ["$event"])
  onKeydown(event: KeyboardEvent): void {
    if (!this.presenterMode()) return;
    if (event.key === "ArrowRight" || event.key === " ") {
      event.preventDefault();
      this.next();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      this.prev();
    } else if (event.key === "Escape") {
      this.exitPresenter();
    }
  }

  /** Toggle team config panel */
  toggleConfig(): void {
    const opening = !this.configMode();
    this.configMode.set(opening);
    teamSelectorDisabled.set(opening);
    if (opening) {
      this.loadAvailableProjects();
    }
  }

  /** Load all org projects for the code project mapping dropdown */
  private async loadAvailableProjects(): Promise<void> {
    try {
      const { projectName } = await getProjectContext();
      const allProjects = await getOrganizationProjects();
      // Exclude the current project from the dropdown
      this.availableProjects.set(
        allProjects.filter((p) => p.name !== projectName),
      );
    } catch {
      this.availableProjects.set([]);
    }
  }

  /** Update a member's group */
  setMemberGroup(name: string, group: TeamGroup): void {
    const members = this.teamMembers().map((m) =>
      m.name === name ? { ...m, group } : m,
    );
    this.teamMembers.set(members);
  }

  /** Update a member's region */
  setMemberRegion(name: string, region: string): void {
    const members = this.teamMembers().map((m) =>
      m.name === name ? { ...m, region } : m,
    );
    this.teamMembers.set(members);
  }

  /** Get a member's configured region */
  getMemberRegion(name: string): string {
    return this.teamMembers().find((m) => m.name === name)?.region ?? "";
  }

  /** Toggle a member's standup visibility */
  toggleMemberVisibility(name: string): void {
    const members = this.teamMembers().map((m) =>
      m.name === name ? { ...m, visible: !m.visible } : m,
    );
    this.teamMembers.set(members);
  }

  /** Add a custom group */
  addCustomGroup(): void {
    const name = this.newGroupName().trim();
    if (!name) return;
    const key = name
      .toUpperCase()
      .replaceAll(/[^A-Z0-9]/g, "")
      .substring(0, 10);
    if (!key) return;
    const existing = this.groupOrder();
    if (existing.includes(key)) {
      this.newGroupName.set("");
      return;
    }
    this.customGroups.set([
      ...this.customGroups(),
      { key, label: name, icon: DEFAULT_GROUP_ICON },
    ]);
    this.groupOrder.set([...this.groupOrder(), key]);
    this.newGroupName.set("");
  }

  /** Remove a custom group, reassigning its members to the first default */
  removeCustomGroup(key: string): void {
    this.customGroups.set(this.customGroups().filter((g) => g.key !== key));
    this.groupOrder.set(this.groupOrder().filter((g) => g !== key));
    const members = this.teamMembers().map((m) =>
      m.group === key
        ? { ...m, group: this.groupOrder()[0] ?? DEFAULT_GROUPS[0] }
        : m,
    );
    this.teamMembers.set(members);
  }

  /** Move a group up in the order */
  moveGroupUp(key: string): void {
    const order = [...this.groupOrder()];
    const idx = order.indexOf(key);
    if (idx <= 0) return;
    [order[idx - 1], order[idx]] = [order[idx], order[idx - 1]];
    this.groupOrder.set(order);
  }

  /** Move a group down in the order */
  moveGroupDown(key: string): void {
    const order = [...this.groupOrder()];
    const idx = order.indexOf(key);
    if (idx < 0 || idx >= order.length - 1) return;
    [order[idx], order[idx + 1]] = [order[idx + 1], order[idx]];
    this.groupOrder.set(order);
  }

  /** Add a code project mapping */
  addCodeProject(): void {
    const name = this.newCodeProject().trim();
    if (!name) return;
    const existing = this.codeProjectMappings();
    if (existing.includes(name)) return;
    this.codeProjectMappings.set([...existing, name]);
    this.newCodeProject.set("");
  }

  /** Remove a code project mapping */
  removeCodeProject(name: string): void {
    this.codeProjectMappings.set(
      this.codeProjectMappings().filter((p) => p !== name),
    );
  }

  /** Save team config and reload */
  async saveConfig(): Promise<void> {
    const map = new Map(
      this.teamMembers().map((m) => [
        m.name,
        { group: m.group, visible: m.visible, region: m.region },
      ]),
    );
    await this.saveTeamConfig(map);
    this.configMode.set(false);
    teamSelectorDisabled.set(false);
    this.refresh();
  }

  private async loadTeamConfig(): Promise<
    Map<string, { group: TeamGroup; visible: boolean; region?: string }>
  > {
    try {
      const manager = await getExtensionDataManager();
      const doc = await manager.getDocument(DOC_COLLECTION, this.docId);
      this.existingDoc = doc;
      // Restore custom groups and group order
      if (doc?.customGroups) {
        this.customGroups.set(doc.customGroups as CustomGroup[]);
      }
      if (doc?.groupOrder) {
        this.groupOrder.set(doc.groupOrder as string[]);
      } else {
        // Derive order from defaults + custom
        const customKeys = ((doc?.customGroups as CustomGroup[]) ?? []).map(
          (g) => g.key,
        );
        this.groupOrder.set([...DEFAULT_GROUPS, ...customKeys]);
      }
      if (doc?.codeProjects) {
        this.codeProjectMappings.set(doc.codeProjects as string[]);
      }
      // Support new format (config) and legacy format (groups)
      if (doc?.config) {
        return new Map(
          doc.config as [string, { group: TeamGroup; visible: boolean }][],
        );
      }
      if (doc?.groups) {
        // Migrate legacy format: group-only → { group, visible: true }
        const legacy = doc.groups as [string, TeamGroup][];
        return new Map(
          legacy.map(([name, group]) => [name, { group, visible: true }]),
        );
      }
    } catch {
      this.existingDoc = null;
      // Document doesn't exist yet — return empty map
    }
    return new Map();
  }

  private async saveTeamConfig(
    map: Map<string, { group: TeamGroup; visible: boolean; region: string }>,
  ): Promise<void> {
    const manager = await getExtensionDataManager();
    await manager.setDocument(DOC_COLLECTION, {
      ...this.existingDoc,
      id: this.docId,
      config: Array.from(map.entries()),
      customGroups: this.customGroups(),
      groupOrder: this.groupOrder(),
      codeProjects: this.codeProjectMappings(),
    });
  }

  getStateClass(state: string): string {
    switch (state) {
      case "In Progress":
        return "state-progress";
      case "Blocked":
        return "state-blocked";
      case "New":
      case "To Do":
        return "state-new";
      default:
        return "";
    }
  }

  getMembersInGroup(group: string): StandupMember[] {
    return this.standupMembers().filter((m) => m.group === group);
  }

  getMemberIndex(name: string): number {
    return this.standupMembers().findIndex((m) => m.name === name);
  }

  /** Count only Task items (the real work items people work on) */
  leafItemCount(items: SprintWorkItem[]): number {
    return items.filter((i) => i.workItemType === "Task").length;
  }

  /** Get upcoming leaves for a member */
  getMemberLeaves(name: string): LeaveEntry[] {
    return getUpcomingLeaves(name, this.leaveConfig());
  }

  /** Get leaves starting within the next 10 days */
  getNearLeaves(name: string): LeaveEntry[] {
    const today = new Date();
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() + 10);
    const cutoffStr = cutoff.toISOString().substring(0, 10);
    return this.getMemberLeaves(name).filter((l) => l.startDate <= cutoffStr);
  }

  /** Check if member is on leave today */
  isMemberOnLeave(name: string): boolean {
    return isOnLeaveToday(name, this.leaveConfig());
  }

  /** Get leave status text for a member currently on leave */
  getLeaveStatus(name: string): string {
    const leave = getActiveLeave(name, this.leaveConfig());
    if (!leave) return "";
    const today = new Date().toISOString().substring(0, 10);
    if (leave.endDate === today) return "On Leave Today";
    return `On Leave till ${this.formatDateShort(leave.endDate)}`;
  }

  /** Get "back on" text for a member currently on leave */
  getBackOnDate(name: string): string {
    const leave = getActiveLeave(name, this.leaveConfig());
    if (!leave) return "";
    const today = new Date().toISOString().substring(0, 10);
    if (leave.endDate === today) return "";
    const region = this.getMemberRegion(name);
    const holidays = region
      ? this.leaveConfig().holidays.filter((h) => h.region === region)
      : this.leaveConfig().holidays;
    const nextDay = getNextWorkingDay(leave.endDate, holidays);
    return `Back on ${this.formatDateShort(nextDay)}`;
  }

  private formatDateShort(iso: string): string {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  /** Format a leave range for display */
  formatLeave(leave: LeaveEntry): string {
    return formatLeaveRange(leave);
  }

  /** Get public holidays that fall on today */
  getTodayHolidays(): PublicHoliday[] {
    const today = new Date().toISOString().substring(0, 10);
    return this.leaveConfig().holidays.filter((h) => h.date === today);
  }

  /** Get today's public holidays relevant to a specific member's region */
  getMemberTodayHolidays(name: string): PublicHoliday[] {
    const region = this.getMemberRegion(name);
    const all = this.getTodayHolidays();
    if (!region) return all; // no region set — show all holidays
    return all.filter((h) => h.region === region);
  }
}
