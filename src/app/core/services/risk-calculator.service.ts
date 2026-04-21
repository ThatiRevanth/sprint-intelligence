import type { TeamContext } from 'azure-devops-extension-api/Core';
import { SprintWorkItem, BlockerItem, BlockerSeverity } from '../models';
import {
  SprintRiskScore,
  RiskFactor,
  getRiskLevel,
  getRiskLabel,
  getRiskColor,
} from '../models';
import { getSprintWorkItems, getIterationVelocity } from './work-item.service';
import { getSprintInfo, getPastIterations } from './iteration.service';
import {
  calculateRiskScore,
  completionScore,
  timeBalanceScore,
  blockerScore,
  velocityScore,
  DEFAULT_WEIGHTS,
} from '../utils/scoring.utils';

/** Configuration for blocker detection thresholds */
export interface BlockerConfig {
  staleDays: number;
  prPendingDays: number;
}

const DEFAULT_BLOCKER_CONFIG: BlockerConfig = {
  staleDays: 2,
  prPendingDays: 2,
};

/**
 * Detect blockers from a list of sprint work items.
 */
export function detectBlockers(
  items: SprintWorkItem[],
  allItems: SprintWorkItem[],
  config: BlockerConfig = DEFAULT_BLOCKER_CONFIG
): BlockerItem[] {
  const blockers: BlockerItem[] = [];
  const itemMap = new Map(allItems.map((i) => [i.id, i]));

  for (const item of items) {
    // Skip completed items
    if (item.state === 'Done' || item.state === 'Closed') continue;

    // Rule 1: Stale — not updated in X days
    if (item.agingDays >= config.staleDays) {
      blockers.push({
        workItemId: item.id,
        title: item.title,
        assignedTo: item.assignedTo,
        assignedToImageUrl: item.assignedToImageUrl,
        blockerType: 'stale',
        reason: `Not updated for ${item.agingDays} day(s)`,
        daysSinceUpdate: item.agingDays,
        severity: computeSeverity(item.agingDays, config.staleDays),
        url: item.url,
        tags: item.tags,
      });
    }

    // Rule 2: Blocked dependency — predecessor not done
    for (const predId of item.predecessorIds) {
      const pred = itemMap.get(predId);
      if (pred && pred.state !== 'Done' && pred.state !== 'Closed') {
        blockers.push({
          workItemId: item.id,
          title: item.title,
          assignedTo: item.assignedTo,
          assignedToImageUrl: item.assignedToImageUrl,
          blockerType: 'blocked-dependency',
          reason: `Blocked by #${predId}: "${pred.title}" (${pred.state})`,
          daysSinceUpdate: item.agingDays,
          severity: 'high',
          url: item.url,
          relatedItemId: predId,
          relatedItemTitle: pred.title,
          tags: item.tags,
        });
      }
    }

    // Rule 3: PR linked but not merged (active PR older than threshold)
    if (item.linkedPrs.length > 0 && item.state === 'In Progress') {
      blockers.push({
        workItemId: item.id,
        title: item.title,
        assignedTo: item.assignedTo,
        assignedToImageUrl: item.assignedToImageUrl,
        blockerType: 'pr-pending',
        reason: `Has ${item.linkedPrs.length} linked PR(s) not yet merged`,
        daysSinceUpdate: item.agingDays,
        severity: item.agingDays > config.prPendingDays ? 'high' : 'medium',
        url: item.url,
        tags: item.tags,
      });
    }
  }

  // Sort by severity (high first)
  const order: Record<BlockerSeverity, number> = { high: 0, medium: 1, low: 2 };
  blockers.sort((a, b) => order[a.severity] - order[b.severity]);

  return blockers;
}

function computeSeverity(agingDays: number, staleDays: number): BlockerSeverity {
  if (agingDays >= staleDays * 3) return 'high';
  if (agingDays >= staleDays * 2) return 'medium';
  return 'low';
}

/**
 * Calculate the sprint risk score.
 * Accepts optional pre-fetched items to avoid duplicate API calls.
 */
export async function calculateSprintRisk(
  teamContext: TeamContext,
  prefetchedItems?: SprintWorkItem[],
  areaPath?: string
): Promise<SprintRiskScore | null> {
  const sprintInfo = await getSprintInfo(teamContext);
  if (!sprintInfo) return null;

  const items = prefetchedItems ?? await getSprintWorkItems(teamContext, areaPath);
  if (items.length === 0) return null;

  const totalCount = items.length;
  const doneCount = items.filter((i) => i.state === 'Done' || i.state === 'Closed').length;

  const completionRatio = totalCount > 0 ? doneCount / totalCount : 0;
  const timeRatio = sprintInfo.timeRatio;

  const blockers = detectBlockers(items, items);
  const blockedCount = blockers.length;

  // Velocity from past sprints (real data)
  const pastIterations = await getPastIterations(teamContext, 3);
  const pastVelocityData = await Promise.all(
    pastIterations.map((iter) => getIterationVelocity(iter, areaPath))
  );

  const pastCompleted = pastVelocityData
    .map((v) => v.completed)
    .filter((c) => c > 0);

  const avgPastVelocity =
    pastCompleted.length > 0
      ? pastCompleted.reduce((a, b) => a + b, 0) / pastCompleted.length
      : totalCount;

  const currentVelocity = doneCount;

  const score = calculateRiskScore(
    completionRatio,
    timeRatio,
    blockedCount,
    items.length,
    currentVelocity,
    avgPastVelocity
  );

  const level = getRiskLevel(score);

  const factors: RiskFactor[] = [
    {
      name: 'Completion Progress',
      score: completionScore(completionRatio, timeRatio),
      weight: DEFAULT_WEIGHTS.completion,
      description: `${Math.round(completionRatio * 100)}% done, ${Math.round(timeRatio * 100)}% time elapsed`,
    },
    {
      name: 'Time Balance',
      score: timeBalanceScore(completionRatio, timeRatio),
      weight: DEFAULT_WEIGHTS.timeBalance,
      description: `${sprintInfo.remainingDays} day(s) remaining`,
    },
    {
      name: 'Blockers',
      score: blockerScore(blockedCount, items.length),
      weight: DEFAULT_WEIGHTS.blockers,
      description: `${blockedCount} blocker(s) out of ${items.length} items`,
    },
    {
      name: 'Velocity Trend',
      score: velocityScore(currentVelocity, avgPastVelocity),
      weight: DEFAULT_WEIGHTS.velocity,
      description: pastCompleted.length > 0
        ? `${doneCount} items done vs ${Math.round(avgPastVelocity)} avg (${pastCompleted.length} past sprint${pastCompleted.length > 1 ? 's' : ''})`
        : `${doneCount} items done (no past sprint data)`,
    },
  ];

  return {
    score,
    level,
    label: getRiskLabel(level),
    color: getRiskColor(level),
    factors,
  };
}
