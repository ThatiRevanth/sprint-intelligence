/**
 * Scoring utility functions for sprint risk calculation.
 */

export interface ScoringWeights {
  completion: number;
  timeBalance: number;
  blockers: number;
  velocity: number;
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  completion: 0.35,
  timeBalance: 0.25,
  blockers: 0.25,
  velocity: 0.15,
};

/**
 * Completion factor: How well the work done matches elapsed time.
 * Score 100 if completion% >= time%, scaled down proportionally otherwise.
 */
export function completionScore(completionRatio: number, timeRatio: number): number {
  if (timeRatio <= 0) return 100;
  const expected = timeRatio;
  const actual = completionRatio;
  if (actual >= expected) return 100;
  return Math.max(0, Math.round((actual / expected) * 100));
}

/**
 * Time balance factor: Penalizes when lots of time spent but little progress on remaining work.
 */
export function timeBalanceScore(completionRatio: number, timeRatio: number): number {
  const remaining = 1 - completionRatio;
  const timeRemaining = 1 - timeRatio;
  if (remaining <= 0) return 100;
  if (timeRemaining <= 0) return remaining > 0 ? 0 : 100;
  const ratio = timeRemaining / remaining;
  return Math.max(0, Math.min(100, Math.round(ratio * 100)));
}

/**
 * Blocker penalty: More blockers = lower score.
 */
export function blockerScore(blockedCount: number, totalCount: number): number {
  if (totalCount <= 0) return 100;
  const blockedRatio = blockedCount / totalCount;
  return Math.max(0, Math.round((1 - blockedRatio * 2) * 100));
}

/**
 * Velocity trend: Compare current sprint velocity to average of past sprints.
 */
export function velocityScore(currentVelocity: number, avgPastVelocity: number): number {
  if (avgPastVelocity <= 0) return 75; // no history — neutral score
  const ratio = currentVelocity / avgPastVelocity;
  return Math.max(0, Math.min(100, Math.round(ratio * 100)));
}

/**
 * Calculate the weighted total risk score.
 */
export function calculateRiskScore(
  completionRatio: number,
  timeRatio: number,
  blockedCount: number,
  totalCount: number,
  currentVelocity: number,
  avgPastVelocity: number,
  weights: ScoringWeights = DEFAULT_WEIGHTS
): number {
  const cs = completionScore(completionRatio, timeRatio);
  const tb = timeBalanceScore(completionRatio, timeRatio);
  const bs = blockerScore(blockedCount, totalCount);
  const vs = velocityScore(currentVelocity, avgPastVelocity);

  const total =
    cs * weights.completion +
    tb * weights.timeBalance +
    bs * weights.blockers +
    vs * weights.velocity;

  return Math.max(0, Math.min(100, Math.round(total)));
}
