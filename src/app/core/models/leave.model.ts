export interface LeaveEntry {
  /** Member display name */
  memberName: string;
  /** Start date ISO string (YYYY-MM-DD) */
  startDate: string;
  /** End date ISO string (YYYY-MM-DD) — same as startDate for single-day leave */
  endDate: string;
  /** Business days count (excludes weekends & public holidays) */
  days: number;
  /** Optional note */
  note?: string;
  /** Session on the start date: 1 = first half (morning), 2 = second half (afternoon). Default 1. */
  startSession?: 1 | 2;
  /** Session on the end date: 1 = first half (morning), 2 = second half (afternoon). Default 2. */
  endSession?: 1 | 2;
}

export interface PublicHoliday {
  /** ISO date string (YYYY-MM-DD) */
  date: string;
  /** Holiday name */
  name: string;
  /** Country/region code (e.g. "US", "IN", "UK") for multi-region teams */
  region: string;
}

export interface LeaveConfig {
  /** All leave entries for the team */
  leaves: LeaveEntry[];
  /** Public holidays per region */
  holidays: PublicHoliday[];
  /** Regions configured for the team */
  regions: string[];
}
