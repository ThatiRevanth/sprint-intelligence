import { LeaveConfig, LeaveEntry, PublicHoliday } from '../models';
import { getExtensionDataManager, getProjectContext } from './azure-devops.service';
import { getSelectedTeamContext } from './team-selection.service';
import { isWeekend } from '../utils/date.utils';

const DOC_COLLECTION = 'leave-tracker';

async function getDocId(): Promise<string> {
  const { projectId } = await getProjectContext();
  const teamContext = await getSelectedTeamContext();
  return `${projectId}-${teamContext.team}`
    .replaceAll(/[^a-zA-Z0-9\-_]/g, '_')
    .substring(0, 50);
}

let cachedDoc: Record<string, any> | null = null;

export async function loadLeaveConfig(): Promise<LeaveConfig> {
  try {
    const docId = await getDocId();
    const manager = await getExtensionDataManager();
    const doc = await manager.getDocument(DOC_COLLECTION, docId);
    cachedDoc = doc;
    return {
      leaves: (doc?.leaves as LeaveEntry[]) ?? [],
      holidays: (doc?.holidays as PublicHoliday[]) ?? [],
      regions: (doc?.regions as string[]) ?? [],
    };
  } catch {
    cachedDoc = null;
    return { leaves: [], holidays: [], regions: [] };
  }
}

export async function saveLeaveConfig(config: LeaveConfig): Promise<void> {
  const docId = await getDocId();
  const manager = await getExtensionDataManager();
  const saved = await manager.setDocument(DOC_COLLECTION, {
    ...cachedDoc,
    id: docId,
    leaves: config.leaves,
    holidays: config.holidays,
    regions: config.regions,
  });
  cachedDoc = saved;
}

/**
 * Count business days between two dates, also excluding public holidays.
 */
export function countBusinessDays(
  startDate: string,
  endDate: string,
  holidays: PublicHoliday[],
  memberRegions?: string[],
): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  const holidayDates = new Set(
    holidays
      .filter((h) => !memberRegions || memberRegions.length === 0 || memberRegions.includes(h.region))
      .map((h) => h.date),
  );

  let count = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const iso = cursor.toISOString().substring(0, 10);
    if (!isWeekend(cursor) && !holidayDates.has(iso)) {
      count++;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

/**
 * Get upcoming leaves for a specific member (from today onward).
 */
export function getUpcomingLeaves(
  memberName: string,
  config: LeaveConfig,
): LeaveEntry[] {
  const today = new Date().toISOString().substring(0, 10);
  return config.leaves
    .filter((l) => l.memberName === memberName && l.endDate >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

/**
 * Check if a member is on leave today.
 */
export function isOnLeaveToday(
  memberName: string,
  config: LeaveConfig,
): boolean {
  const today = new Date().toISOString().substring(0, 10);
  return config.leaves.some(
    (l) => l.memberName === memberName && l.startDate <= today && l.endDate >= today,
  );
}

/**
 * Get the active leave entry for a member (where today falls within the range).
 */
export function getActiveLeave(
  memberName: string,
  config: LeaveConfig,
): LeaveEntry | null {
  const today = new Date().toISOString().substring(0, 10);
  return config.leaves.find(
    (l) => l.memberName === memberName && l.startDate <= today && l.endDate >= today,
  ) ?? null;
}

/**
 * Get the next working day after a given date (skips weekends and public holidays).
 */
export function getNextWorkingDay(isoDate: string, holidays: PublicHoliday[] = []): string {
  const holidayDates = new Set(holidays.map((h) => h.date));
  const d = new Date(isoDate + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6 || holidayDates.has(toLocalIso(d))) {
    d.setDate(d.getDate() + 1);
  }
  return toLocalIso(d);
}

/** Format a Date as YYYY-MM-DD in local timezone */
function toLocalIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Format a leave entry for display.
 */
export function formatLeaveRange(leave: LeaveEntry): string {
  if (leave.startDate === leave.endDate) {
    return formatDate(leave.startDate);
  }
  return `${formatDate(leave.startDate)} – ${formatDate(leave.endDate)}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
