import { getCssVar } from '../utils/theme.utils';

export type RiskLevel = 'on-track' | 'at-risk' | 'likely-to-slip';

export interface SprintRiskScore {
  /** Overall score 0-100 (higher = healthier) */
  score: number;
  level: RiskLevel;
  label: string;
  color: string;

  /** Individual factor scores (each 0-100) */
  factors: RiskFactor[];
}

export interface RiskFactor {
  name: string;
  score: number;
  weight: number;
  description: string;
}

export interface SprintInfo {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  totalDays: number;
  elapsedDays: number;
  remainingDays: number;
  timeRatio: number;
}

export interface VelocityData {
  iterationName: string;
  planned: number;
  completed: number;
}

export function getRiskLevel(score: number): RiskLevel {
  if (score >= 70) return 'on-track';
  if (score >= 40) return 'at-risk';
  return 'likely-to-slip';
}

export function getRiskLabel(level: RiskLevel): string {
  switch (level) {
    case 'on-track': return '🟢 On Track';
    case 'at-risk': return '🟡 At Risk';
    case 'likely-to-slip': return '🔴 Likely to Slip';
  }
}

export function getRiskColor(level: RiskLevel): string {
  switch (level) {
    case 'on-track': return getCssVar('--si-success', '#107c10');
    case 'at-risk': return getCssVar('--si-warning', '#ff8c00');
    case 'likely-to-slip': return getCssVar('--si-danger', '#e81123');
  }
}
