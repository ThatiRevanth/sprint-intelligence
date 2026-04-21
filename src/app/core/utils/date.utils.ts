/** Utility functions for date calculations */

/** Check if a date falls on a weekend (Saturday or Sunday) */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * Count business days (Mon–Fri) between two dates, excluding weekends.
 */
export function daysBetween(date1: Date, date2: Date): number {
  const start = date1 < date2 ? new Date(date1) : new Date(date2);
  const end = date1 < date2 ? new Date(date2) : new Date(date1);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  let count = 0;
  const cursor = new Date(start);
  while (cursor < end) {
    cursor.setDate(cursor.getDate() + 1);
    if (!isWeekend(cursor)) count++;
  }
  return count;
}

export function hoursBetween(date1: Date, date2: Date): number {
  const diffMs = Math.abs(date2.getTime() - date1.getTime());
  return Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
}

export function isWithinDateRange(date: Date, start: Date, end: Date): boolean {
  return date >= start && date <= end;
}

export function sprintDayProgress(startDate: Date, endDate: Date): number {
  const now = new Date();
  const totalMs = endDate.getTime() - startDate.getTime();
  const elapsedMs = now.getTime() - startDate.getTime();
  if (totalMs <= 0) return 1;
  return Math.max(0, Math.min(1, elapsedMs / totalMs));
}
