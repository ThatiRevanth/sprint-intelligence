import {
  getWorkItemTrackingClient,
  getProjectContext,
  getGitClient,
} from './azure-devops.service';
import type { TeamContext } from 'azure-devops-extension-api/Core';
import type {
  Wiql,
  WorkItem,
} from 'azure-devops-extension-api/WorkItemTracking';
import { SprintWorkItem, AgingWorkItem, AgingSeverity, VelocityData, LinkedPr } from '../models';
import { daysBetween } from '../utils/date.utils';
import { getCurrentIteration } from './iteration.service';
import type { TeamSettingsIteration } from 'azure-devops-extension-api/Work';
import { cached } from './sprint-data-cache.service';

const BATCH_SIZE = 200;

/**
 * Query all work items in the current sprint for the given team.
 */
export async function getSprintWorkItems(
  teamContext: TeamContext,
  areaPath?: string
): Promise<SprintWorkItem[]> {
  const cacheKey = areaPath
    ? `workitems:${teamContext.teamId}:${areaPath}`
    : `workitems:${teamContext.teamId}`;
  return cached(cacheKey, () => fetchSprintWorkItems(teamContext, areaPath));
}

async function fetchSprintWorkItems(
  teamContext: TeamContext,
  areaPath?: string
): Promise<SprintWorkItem[]> {
  const iteration = await getCurrentIteration(teamContext);
  if (!iteration) return [];

  const witClient = await getWorkItemTrackingClient();
  const { projectName } = await getProjectContext();

  // Escape single quotes to prevent WIQL injection
  const safeProject = projectName.replaceAll("'", "''");
  const safePath = (iteration.path ?? '').replaceAll("'", "''");
  const areaClause = areaPath
    ? `AND [System.AreaPath] UNDER '${areaPath.replaceAll("'", "''")}'`
    : '';

  const wiql: Wiql = {
    query: `
      SELECT [System.Id]
      FROM WorkItems
      WHERE [System.TeamProject] = '${safeProject}'
        AND [System.IterationPath] UNDER '${safePath}'
        ${areaClause}
        AND [System.WorkItemType] IN ('User Story', 'Bug', 'Task', 'Product Backlog Item', 'Impediment', 'Feature', 'Epic', 'QA', 'QA Task')
      ORDER BY [System.State] ASC, [Microsoft.VSTS.Common.Priority] ASC
    `,
  };

  const result = await witClient.queryByWiql(wiql, projectName);
  if (!result.workItems || result.workItems.length === 0) return [];

  const ids = result.workItems.map((wi) => wi.id);
  const workItems = await fetchWorkItemsBatched(ids, projectName);

  const items = workItems.map(mapToSprintWorkItem);
  await resolveRepoNames(items);
  return items;
}

/**
 * Fetch work items in batches of BATCH_SIZE to stay within API limits.
 */
async function fetchWorkItemsBatched(
  ids: number[],
  project: string
): Promise<WorkItem[]> {
  const witClient = await getWorkItemTrackingClient();
  const results: WorkItem[] = [];

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE);
    const items = await witClient.getWorkItems(
      batch,
      project,
      undefined,
      undefined,
      4 /* WorkItemExpand.Relations */
    );
    results.push(...items);
  }

  return results;
}

function mapToSprintWorkItem(wi: WorkItem): SprintWorkItem {
  const fields = wi.fields ?? {};
  const now = new Date();
  const changedDate = fields['System.ChangedDate'];
  const lastUpdated = changedDate ? new Date(changedDate) : now;
  const assignedTo = fields['System.AssignedTo'];
  const createdRaw = fields['System.CreatedDate'];
  const createdDate = createdRaw ? new Date(createdRaw) : now;

  const predecessorIds: number[] = [];
  const linkedPrs: LinkedPr[] = [];
  let parentId: number | undefined;

  if (wi.relations) {
    for (const rel of wi.relations) {
      if (
        rel.rel === 'System.LinkTypes.Hierarchy-Reverse' &&
        rel.url
      ) {
        const id = extractIdFromUrl(rel.url);
        if (id) parentId = id;
      }
      if (
        rel.rel === 'System.LinkTypes.Dependency-Reverse' &&
        rel.url
      ) {
        const id = extractIdFromUrl(rel.url);
        if (id) predecessorIds.push(id);
      }
      if (
        rel.rel === 'ArtifactLink' &&
        rel.url &&
        rel.url.includes('PullRequestId')
      ) {
        const pr = extractPrFromArtifactUrl(rel.url);
        if (pr) linkedPrs.push(pr);
      }
    }
  }

  return {
    id: wi.id,
    title: fields['System.Title'] ?? '',
    state: fields['System.State'] ?? 'New',
    assignedTo: assignedTo?.displayName ?? 'Unassigned',
    assignedToImageUrl: assignedTo?.imageUrl,
    workItemType: fields['System.WorkItemType'] ?? '',
    storyPoints: fields['Microsoft.VSTS.Scheduling.StoryPoints'] ?? 0,
    lastUpdated,
    createdDate,
    tags: fields['System.Tags']
      ? String(fields['System.Tags']).split(';').map((t: string) => t.trim()).filter(Boolean)
      : [],
    url: wi._links?.html?.href ?? '',
    parentId,
    predecessorIds,
    linkedPrs,
    agingDays: daysBetween(lastUpdated, now),
    activity: fields['Microsoft.VSTS.Common.Activity'] ?? '',
  };
}

/**
 * Get completed item count for a past iteration (velocity).
 */
export async function getIterationVelocity(
  iteration: TeamSettingsIteration,
  areaPath?: string
): Promise<VelocityData> {
  const cacheKey = areaPath
    ? `velocity:${iteration.id}:${areaPath}`
    : `velocity:${iteration.id}`;
  return cached(cacheKey, () => fetchIterationVelocity(iteration, areaPath));
}

async function fetchIterationVelocity(
  iteration: TeamSettingsIteration,
  areaPath?: string
): Promise<VelocityData> {
  const witClient = await getWorkItemTrackingClient();
  const { projectName } = await getProjectContext();

  const safeProject = projectName.replaceAll("'", "''");
  const safePath = (iteration.path ?? '').replaceAll("'", "''");
  const areaClause = areaPath
    ? `AND [System.AreaPath] UNDER '${areaPath.replaceAll("'", "''")}'`
    : '';

  const wiql: Wiql = {
    query: `
      SELECT [System.Id]
      FROM WorkItems
      WHERE [System.TeamProject] = '${safeProject}'
        AND [System.IterationPath] UNDER '${safePath}'
        ${areaClause}
        AND [System.WorkItemType] IN ('User Story', 'Bug', 'Task', 'Product Backlog Item')
      ORDER BY [System.Id] ASC
    `,
  };

  const result = await witClient.queryByWiql(wiql, projectName);
  if (!result.workItems || result.workItems.length === 0) {
    return { iterationName: iteration.name, planned: 0, completed: 0 };
  }

  const ids = result.workItems.map((wi) => wi.id);
  const workItems = await fetchWorkItemsBatched(ids, projectName);

  let planned = 0;
  let completed = 0;
  for (const wi of workItems) {
    planned++;
    const state = wi.fields?.['System.State'] ?? '';
    if (state === 'Done' || state === 'Closed') {
      completed++;
    }
  }

  return { iterationName: iteration.name, planned, completed };
}

/**
 * Get work items with aging severity classification.
 */
export function classifyAging(
  items: SprintWorkItem[],
  warningDays: number = 2,
  criticalDays: number = 5
): AgingWorkItem[] {
  return items
    .filter((item) => item.state !== 'Done' && item.state !== 'Closed')
    .map((item) => {
      let severity: AgingSeverity = 'normal';
      if (item.agingDays >= criticalDays) severity = 'critical';
      else if (item.agingDays >= warningDays) severity = 'warning';
      return { ...item, severity };
    })
    .sort((a, b) => b.agingDays - a.agingDays);
}

/**
 * Fetch specific work items by IDs (e.g. parent items not in sprint).
 */
export async function fetchWorkItemsByIds(
  ids: number[]
): Promise<SprintWorkItem[]> {
  if (ids.length === 0) return [];
  const { projectName } = await getProjectContext();
  const workItems = await fetchWorkItemsBatched(ids, projectName);
  const items = workItems.map(mapToSprintWorkItem);
  await resolveRepoNames(items);
  return items;
}

/**
 * Recursively fetch ancestor work items that aren't already in the map.
 * Walks up the parent chain so the full hierarchy (Feature → PBI → Task) is available.
 */
export async function enrichWithMissingParents(
  items: SprintWorkItem[],
  allItemsById: Map<number, SprintWorkItem>
): Promise<void> {
  let toCheck = items;
  while (true) {
    const missingIds = [
      ...new Set(
        toCheck
          .filter((i) => i.parentId && !allItemsById.has(i.parentId))
          .map((i) => i.parentId!)
      ),
    ];
    if (missingIds.length === 0) break;
    const parents = await fetchWorkItemsByIds(missingIds);
    for (const p of parents) {
      allItemsById.set(p.id, p);
    }
    toCheck = parents; // check if these parents also have missing ancestors
  }
}

function extractIdFromUrl(url: string): number | null {
  const match = url.match(/\/(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}

function extractPrFromArtifactUrl(url: string): LinkedPr | null {
  // Format: vstfs:///Git/PullRequestId/{projectId}%2F{repoId}%2F{prId}
  const decoded = decodeURIComponent(url);
  const match = decoded.match(/PullRequestId\/([^/]+)\/([^/]+)\/([\d]+)/i);
  if (match) {
    return { id: Number.parseInt(match[3], 10), repoId: match[2], repoName: '', repoProject: '' };
  }
  // Fallback: simple format PullRequestId/{prId}
  const simple = decoded.match(/PullRequestId\/(\d+)/i);
  return simple ? { id: Number.parseInt(simple[1], 10), repoId: '', repoName: '', repoProject: '' } : null;
}

/** Resolve repo GUIDs to repo names via the Git API. */
let repoCache: Map<string, string> | null = null;
/** Maps repo GUID → project name where the repo lives. */
let repoProjectCache: Map<string, string> | null = null;

/** Additional project names to search for repos (cross-project mapping). */
let codeProjectNames: string[] = [];

/**
 * Configure additional projects where repos/PRs live.
 * Call before getSprintWorkItems if work items and code are in different projects.
 */
export function setCodeProjects(projects: string[]): void {
  codeProjectNames = projects;
  // Clear caches so repos from new projects get fetched
  repoCache = null;
  repoProjectCache = null;
}

async function resolveRepoNames(items: SprintWorkItem[]): Promise<void> {
  const unknownIds = new Set<string>();
  for (const item of items) {
    for (const pr of item.linkedPrs) {
      if (pr.repoId && !pr.repoName) {
        if (repoCache?.has(pr.repoId)) {
          pr.repoName = repoCache.get(pr.repoId)!;
        } else {
          unknownIds.add(pr.repoId);
        }
      }
    }
  }

  if (unknownIds.size === 0) return;

  try {
    const { projectName } = await getProjectContext();
    const gitClient = await getGitClient();
    repoCache ??= new Map();
    repoProjectCache ??= new Map();

    // Fetch repos from all projects: current project + any mapped code projects
    const projectsToSearch = new Set([projectName, ...codeProjectNames]);
    for (const proj of projectsToSearch) {
      try {
        const repos = await gitClient.getRepositories(proj);
        for (const repo of repos) {
          repoCache.set(repo.id, repo.name);
          repoProjectCache.set(repo.id, proj);
        }
      } catch {
        // Skip projects that fail (permissions, not found, etc.)
      }
    }
  } catch {
    return; // graceful fallback — URLs will use repoId
  }

  for (const item of items) {
    for (const pr of item.linkedPrs) {
      if (pr.repoId && !pr.repoName && repoCache.has(pr.repoId)) {
        pr.repoName = repoCache.get(pr.repoId)!;
      }
      if (pr.repoId && !pr.repoProject && repoProjectCache?.has(pr.repoId)) {
        pr.repoProject = repoProjectCache.get(pr.repoId)!;
      }
    }
  }
}
