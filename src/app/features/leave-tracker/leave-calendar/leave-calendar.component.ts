import {
  Component,
  Input,
  ElementRef,
  ViewChild,
  AfterViewChecked,
  signal,
  computed,
} from '@angular/core';
import type { TeamSettingsIteration } from 'azure-devops-extension-api/Work';
import { LeaveEntry, PublicHoliday } from '../../../core/models';

export interface MemberInfo {
  name: string;
  imageUrl?: string;
}

/** One day in the calendar */
interface DayInfo {
  iso: string;
  date: Date;
  dayNum: number;
  dayLabel: string; // 'Mon' | 'Tue' …
  isWeekend: boolean;
  holidays: PublicHoliday[];
  /** Set only on first day of each week */
  weekLabel?: string;
  /** Set only on first day of each month */
  monthLabel?: string;
}

/** One week bucket for week-zoom timeline */
interface WeekBucket {
  weekLabel: string; // e.g. 'May 18–22'
  days: DayInfo[];
  /** True if any day of this week has a public holiday */
  hasHoliday: boolean;
  /** Month label if a new month starts within this week */
  monthLabel?: string;
}

/** A month header span (covers N day-columns or N week-columns) */
interface MonthSpan {
  label: string;
  span: number;
}

/** One row in the timeline */
interface MemberRow {
  name: string;
  imageUrl?: string;
  /** ISO date → hours on leave for that day (4 = half day, 8 = full day) */
  leaveHours: Map<string, number>;
}

/** One day cell in the monthly calendar grid */
interface MonthCell {
  iso: string;
  dayNum: number;
  isWeekend: boolean;
  isCurrentMonth: boolean;
  isInRange: boolean;
  holidays: PublicHoliday[];
  membersOnLeave: MemberInfo[];
}

type RangePreset = 'current-sprint' | 'next-sprint' | 'next-2-sprints' | 'next-3-months' | 'custom';
type ZoomLevel = 'day' | 'week';
type SubView = 'timeline' | 'monthly';

const SPRINT_FALLBACK_DAYS = 14;

@Component({
  selector: 'si-leave-calendar',
  standalone: true,
  imports: [],
  templateUrl: './leave-calendar.component.html',
  styleUrls: ['./leave-calendar.component.scss'],
})
export class LeaveCalendarComponent implements AfterViewChecked {
  @Input() set leaves(v: LeaveEntry[]) { this._leaves.set(v); }
  @Input() set holidays(v: PublicHoliday[]) { this._holidays.set(v); }
  @Input() set members(v: MemberInfo[]) { this._members.set(v); }
  @Input() set iterations(v: TeamSettingsIteration[]) {
    this._iterations.set(v);
    this.currentMonthOffset.set(0);
    this.updateAutoZoom();
  }

  private readonly _leaves = signal<LeaveEntry[]>([]);
  private readonly _holidays = signal<PublicHoliday[]>([]);
  private readonly _members = signal<MemberInfo[]>([]);
  private readonly _iterations = signal<TeamSettingsIteration[]>([]);

  @ViewChild('todayCol') todayColRef?: ElementRef<HTMLElement>;
  @ViewChild('timelineScroll') timelineScrollRef?: ElementRef<HTMLElement>;

  private shouldScrollToToday = false;

  // ── View & range controls ────────────────────────────────────────────────

  subView = signal<SubView>('timeline');
  rangePreset = signal<RangePreset>('next-sprint');
  zoomLevel = signal<ZoomLevel>('day');
  showWeekends = signal(false);
  customStart = signal('');
  customEnd = signal('');
  currentMonthOffset = signal(0); // relative to range start month

  readonly today = toLocalISO(new Date());
  readonly todayMinStr = toLocalISO(new Date());

  // ── Derived range ────────────────────────────────────────────────────────

  calendarRange = computed<{ start: Date; end: Date }>(() => {
    const preset = this.rangePreset();
    const iters = this._iterations();
    const now = new Date();

    if (preset === 'custom') {
      const s = this.customStart();
      const e = this.customEnd();
      if (s && e) return { start: new Date(s + 'T00:00:00'), end: new Date(e + 'T00:00:00') };
      // fall through to default
    }

    const current = this.findCurrentIteration(iters);
    const sorted = [...iters]
      .filter((i) => i.attributes?.startDate && i.attributes?.finishDate)
      .sort((a, b) =>
        new Date(a.attributes!.startDate!).getTime() - new Date(b.attributes!.startDate!).getTime()
      );
    const currentIdx = current ? sorted.findIndex((i) => i.id === current.id) : -1;

    if (preset === 'current-sprint') {
      if (current?.attributes?.startDate && current?.attributes?.finishDate) {
        return {
          start: new Date(current.attributes.startDate),
          end: new Date(current.attributes.finishDate),
        };
      }
      return { start: now, end: addDays(now, SPRINT_FALLBACK_DAYS) };
    }

    if (preset === 'next-sprint') {
      const next = sorted[currentIdx + 1];
      if (next?.attributes?.startDate && next?.attributes?.finishDate) {
        return {
          start: new Date(next.attributes.startDate),
          end: new Date(next.attributes.finishDate),
        };
      }
      const fallbackStart = current?.attributes?.finishDate
        ? addDays(new Date(current.attributes.finishDate), 1)
        : addDays(now, 1);
      return { start: fallbackStart, end: addDays(fallbackStart, SPRINT_FALLBACK_DAYS) };
    }

    if (preset === 'next-2-sprints') {
      const s1 = sorted[currentIdx + 1];
      const s2 = sorted[currentIdx + 2];
      const rangeStart = s1?.attributes?.startDate
        ? new Date(s1.attributes.startDate)
        : addDays(now, 1);
      const rangeEnd = s2?.attributes?.finishDate
        ? new Date(s2.attributes.finishDate)
        : s1?.attributes?.finishDate
        ? addDays(new Date(s1.attributes.finishDate), SPRINT_FALLBACK_DAYS)
        : addDays(rangeStart, SPRINT_FALLBACK_DAYS * 2);
      return { start: rangeStart, end: rangeEnd };
    }

    // next-3-months
    return { start: now, end: addDays(now, 90) };
  });

  // ── Days list (respecting showWeekends) ──────────────────────────────────

  calendarDays = computed<DayInfo[]>(() => {
    const { start, end } = this.calendarRange();
    const includeWeekends = this.showWeekends();
    const hols = this._holidays();
    const days: DayInfo[] = [];
    const cur = new Date(start);
    cur.setHours(0, 0, 0, 0);
    const endMs = new Date(end).setHours(23, 59, 59, 999);

    let lastWeek = -1;
    let lastMonth = -1;

    while (cur.getTime() <= endMs) {
      const dow = cur.getDay(); // 0=Sun 6=Sat
      const weekend = dow === 0 || dow === 6;
      if (!includeWeekends && weekend) {
        cur.setDate(cur.getDate() + 1);
        continue;
      }
      const iso = toLocalISO(cur);
      const weekNum = getISOWeek(cur);
      const month = cur.getMonth();

      const day: DayInfo = {
        iso,
        date: new Date(cur),
        dayNum: cur.getDate(),
        dayLabel: cur.toLocaleDateString('en-US', { weekday: 'short' }).substring(0, 2),
        isWeekend: weekend,
        holidays: hols.filter((h) => h.date === iso),
        weekLabel: weekNum !== lastWeek ? buildWeekLabel(cur, includeWeekends) : undefined,
        monthLabel: month !== lastMonth ? cur.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : undefined,
      };
      lastWeek = weekNum;
      lastMonth = month;
      days.push(day);
      cur.setDate(cur.getDate() + 1);
    }
    return days;
  });

  // ── Week buckets (for week zoom) ─────────────────────────────────────────

  calendarWeeks = computed<WeekBucket[]>(() => {
    const days = this.calendarDays();
    const buckets: WeekBucket[] = [];
    let cur: WeekBucket | null = null;

    for (const day of days) {
      if (day.weekLabel !== undefined) {
        if (cur) buckets.push(cur);
        cur = { weekLabel: day.weekLabel, days: [], hasHoliday: false };
      }
      if (!cur) cur = { weekLabel: buildWeekLabel(day.date, this.showWeekends()), days: [], hasHoliday: false };
      cur.days.push(day);
      if (day.holidays.length > 0) cur.hasHoliday = true;
      if (day.monthLabel) cur.monthLabel = day.monthLabel;
    }
    if (cur) buckets.push(cur);
    return buckets;
  });

  // ── Month span helpers (for proper spanning headers) ─────────────────────

  /** Day-zoom: one entry per month, span = number of day columns that month occupies */
  calendarMonthSpans = computed<MonthSpan[]>(() => {
    const spans: MonthSpan[] = [];
    for (const day of this.calendarDays()) {
      if (day.monthLabel !== undefined) {
        spans.push({ label: day.monthLabel, span: 1 });
      } else if (spans.length > 0) {
        spans.at(-1)!.span++;
      }
    }
    return spans;
  });

  /** Week-zoom: one entry per month, span = number of week columns that month occupies */
  calendarWeekMonthSpans = computed<MonthSpan[]>(() => {
    const spans: MonthSpan[] = [];
    for (const bucket of this.calendarWeeks()) {
      if (bucket.monthLabel !== undefined) {
        spans.push({ label: bucket.monthLabel, span: 1 });
      } else if (spans.length > 0) {
        spans.at(-1)!.span++;
      }
    }
    return spans;
  });

  // ── Member leave rows ────────────────────────────────────────────────────

  calendarRows = computed<MemberRow[]>(() => {
    const leaves = this._leaves();
    const { start, end } = this.calendarRange();
    // Normalise to local midnight/end-of-day so sprint dates (UTC midnight from ADO)
    // don't accidentally exclude leaves that fall on the first or last day.
    const rangeStart = new Date(start); rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd   = new Date(end);   rangeEnd.setHours(23, 59, 59, 999);
    const rangeStartMs = rangeStart.getTime();
    const rangeEndMs   = rangeEnd.getTime();

    return this._members().map((m) => {
      const leaveHours = new Map<string, number>();
      for (const l of leaves) {
        if (l.memberName !== m.name) continue;
        const lStart = new Date(l.startDate + 'T00:00:00');
        const lEnd = new Date(l.endDate + 'T00:00:00');
        if (lEnd.getTime() < rangeStartMs || lStart.getTime() > rangeEndMs) continue;
        const ss = l.startSession ?? 1;
        const es = l.endSession ?? 2;
        const cur = new Date(lStart);
        while (cur <= lEnd) {
          const iso = toLocalISO(cur);
          const isFirst = iso === l.startDate;
          const isLast = iso === l.endDate;
          let h = 8;
          if (isFirst && isLast) {
            h = ss === es ? 4 : 8; // half day (S1→S1 or S2→S2) or full day (S1→S2)
          } else if (isFirst && ss === 2) {
            h = 4; // afternoon-only start
          } else if (isLast && es === 1) {
            h = 4; // morning-only end
          }
          leaveHours.set(iso, Math.min(8, (leaveHours.get(iso) ?? 0) + h));
          cur.setDate(cur.getDate() + 1);
        }
      }
      return { name: m.name, imageUrl: m.imageUrl, leaveHours };
    });
  });

  // ── Monthly view ─────────────────────────────────────────────────────────

  visibleMonthStart = computed<Date>(() => {
    const base = new Date(this.calendarRange().start);
    base.setDate(1);
    base.setMonth(base.getMonth() + this.currentMonthOffset());
    return base;
  });

  visibleMonthCells = computed<MonthCell[]>(() => {
    const monthStart = this.visibleMonthStart();
    const { start: rangeStart, end: rangeEnd } = this.calendarRange();
    const rows = this.calendarRows();
    const hols = this._holidays();

    const year = monthStart.getFullYear();
    const month = monthStart.getMonth();

    // First Monday on or before the 1st
    const firstDay = new Date(year, month, 1);
    const startDow = (firstDay.getDay() + 6) % 7; // 0=Mon
    const gridStart = new Date(firstDay);
    gridStart.setDate(gridStart.getDate() - startDow);

    // Last day of month
    const lastDay = new Date(year, month + 1, 0);
    const endDow = (lastDay.getDay() + 6) % 7;
    const gridEnd = new Date(lastDay);
    gridEnd.setDate(gridEnd.getDate() + (6 - endDow));

    const cells: MonthCell[] = [];
    const cur = new Date(gridStart);
    while (cur <= gridEnd) {
      const iso = toLocalISO(cur);
      const dow = cur.getDay();
      const membersOnLeave = rows
        .filter((r) => r.leaveHours.has(iso))
        .map((r) => ({ name: r.name, imageUrl: r.imageUrl }));

      cells.push({
        iso,
        dayNum: cur.getDate(),
        isWeekend: dow === 0 || dow === 6,
        isCurrentMonth: cur.getMonth() === month,
        isInRange: cur >= rangeStart && cur <= rangeEnd,
        holidays: hols.filter((h) => h.date === iso),
        membersOnLeave,
      });
      cur.setDate(cur.getDate() + 1);
    }
    return cells;
  });

  visibleMonthLabel = computed<string>(() =>
    this.visibleMonthStart().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  );

  canGoToPrevMonth = computed<boolean>(() => {
    const cur = this.visibleMonthStart();
    const start = this.calendarRange().start;
    return (cur.getFullYear() * 12 + cur.getMonth()) > (start.getFullYear() * 12 + start.getMonth());
  });

  canGoToNextMonth = computed<boolean>(() => {
    const cur = this.visibleMonthStart();
    const end = this.calendarRange().end;
    return (cur.getFullYear() * 12 + cur.getMonth()) < (end.getFullYear() * 12 + end.getMonth());
  });

  // ── Lifecycle ────────────────────────────────────────────────────────────

  ngAfterViewChecked(): void {
    if (this.shouldScrollToToday && this.todayColRef && this.timelineScrollRef) {
      const col = this.todayColRef.nativeElement;
      const scroller = this.timelineScrollRef.nativeElement;
      const colLeft = col.offsetLeft;
      const scrollerWidth = scroller.clientWidth;
      scroller.scrollLeft = colLeft - scrollerWidth / 4;
      this.shouldScrollToToday = false;
    }
  }

  // ── Controls ─────────────────────────────────────────────────────────────

  setSubView(v: SubView): void {
    this.subView.set(v);
    if (v === 'timeline') this.shouldScrollToToday = true;
  }

  setPreset(p: RangePreset): void {
    this.rangePreset.set(p);
    this.currentMonthOffset.set(0);
    this.updateAutoZoom();
    if (this.subView() === 'timeline') this.shouldScrollToToday = true;
  }

  toggleWeekends(): void {
    this.showWeekends.set(!this.showWeekends());
  }

  prevMonth(): void {
    if (this.canGoToPrevMonth()) this.currentMonthOffset.update((v) => v - 1);
  }

  nextMonth(): void {
    if (this.canGoToNextMonth()) this.currentMonthOffset.update((v) => v + 1);
  }

  jumpToToday(): void {
    this.shouldScrollToToday = true;
  }

  isToday(iso: string): boolean {
    return iso === this.today;
  }

  memberInitial(name: string): string {
    return name.charAt(0).toUpperCase();
  }

  /** Week zoom: leave fraction 0–1 based on total hours */
  weekLeaveFraction(row: MemberRow, bucket: WeekBucket): number {
    if (bucket.days.length === 0) return 0;
    const totalHours = bucket.days.reduce((sum, d) => sum + (row.leaveHours.get(d.iso) ?? 0), 0);
    return totalHours / (bucket.days.length * 8);
  }

  /** Week zoom: total leave hours in this bucket */
  weekLeaveHours(row: MemberRow, bucket: WeekBucket): number {
    return bucket.days.reduce((sum, d) => sum + (row.leaveHours.get(d.iso) ?? 0), 0);
  }

  /** Week zoom: abbreviated day names for days with leave in this bucket (e.g. "Mo, We") */
  weekLeaveDayNames(row: MemberRow, bucket: WeekBucket): string {
    return bucket.days
      .filter((d) => row.leaveHours.has(d.iso))
      .map((d) => d.dayLabel)
      .join(', ');
  }

  /** Week zoom: one formatted line per holiday day in the bucket, e.g. ["Mo · IN", "Th · US"] */
  bucketHolidayLines(bucket: WeekBucket): string[] {
    const lines: string[] = [];
    for (const day of bucket.days) {
      if (day.holidays.length === 0) continue;
      const regions = [...new Set(day.holidays.map((h) => h.region))].join(', ');
      lines.push(`${day.dayLabel} · ${regions}`);
    }
    return lines;
  }

  /** Day zoom: comma-joined region codes for all holidays on a day, e.g. "IN, US" */
  dayHolidayRegions(day: DayInfo): string {
    return [...new Set(day.holidays.map((h) => h.region))].join(', ');
  }

  /** Day zoom: full tooltip text for holidays, e.g. "Republic Day (IN), MLK Day (US)" */
  dayHolidayTitle(day: DayInfo): string {
    return day.holidays.map((h) => `${h.name} (${h.region})`).join(', ');
  }

  /** Hours on leave for a member on a specific day (0 = not on leave) */
  getLeaveHours(row: MemberRow, iso: string): number {
    return row.leaveHours.get(iso) ?? 0;
  }

  /** CSS class for a day cell based on leave hours ('' = no leave) */
  leaveColorClass(hours: number): string {
    if (hours <= 0) return '';
    return hours < 8 ? 'leave-h4' : 'leave-h8';
  }

  membersOnLeavePreview(cells: MonthCell[], iso: string): MemberInfo[] {
    return cells.find((c) => c.iso === iso)?.membersOnLeave ?? [];
  }

  formatCustomRangeLabel(): string {
    const { start, end } = this.calendarRange();
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${fmt(start)} – ${fmt(end)}`;
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private updateAutoZoom(): void {
    // Use a timeout to let the signal settle before reading calendarRange
    const { start, end } = this.calendarRange();
    const days = Math.ceil((end.getTime() - start.getTime()) / 86400000);
    this.zoomLevel.set(days > 28 ? 'week' : 'day');
  }

  private findCurrentIteration(iters: TeamSettingsIteration[]): TeamSettingsIteration | null {
    const now = new Date();
    return (
      iters.find((i) => {
        if (!i.attributes?.startDate || !i.attributes?.finishDate) return false;
        const s = new Date(i.attributes.startDate);
        const e = new Date(i.attributes.finishDate);
        e.setHours(23, 59, 59, 999);
        return now >= s && now <= e;
      }) ?? null
    );
  }
}

// ── Pure helpers ─────────────────────────────────────────────────────────────

function toLocalISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function getISOWeek(d: Date): number {
  const tmp = new Date(d);
  tmp.setHours(0, 0, 0, 0);
  tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7));
  const week1 = new Date(tmp.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((tmp.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
    )
  );
}

function buildWeekLabel(mondayish: Date, includeWeekends: boolean): string {
  // find the Monday of this week
  const tmp = new Date(mondayish);
  const dow = (tmp.getDay() + 6) % 7; // 0=Mon
  tmp.setDate(tmp.getDate() - dow);
  const end = new Date(tmp);
  end.setDate(end.getDate() + (includeWeekends ? 6 : 4));
  const startStr = tmp.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  // Same month: omit repeated month name ("May 18–22"); cross-month: include it ("May 29–Jun 2")
  const endStr =
    end.getMonth() === tmp.getMonth()
      ? String(end.getDate())
      : end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${startStr}–${endStr}`;
}
