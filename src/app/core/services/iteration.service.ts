import { getWorkClient, getProjectContext, getCoreClient } from './azure-devops.service';
import type { TeamContext } from 'azure-devops-extension-api/Core';
import type { TeamSettingsIteration } from 'azure-devops-extension-api/Work';
import { SprintInfo } from '../models';
import { daysBetween } from '../utils/date.utils';
import { cached } from './sprint-data-cache.service';

/**
 * Get all iterations for the given team context.
 */
export async function getTeamIterations(
  teamContext: TeamContext
): Promise<TeamSettingsIteration[]> {
  return cached(`iterations:${teamContext.teamId}`, async () => {
    const workClient = await getWorkClient();
    return workClient.getTeamIterations(teamContext);
  });
}

/**
 * Get the current active iteration (sprint) for the team.
 */
export async function getCurrentIteration(
  teamContext: TeamContext
): Promise<TeamSettingsIteration | null> {
  const iterations = await getTeamIterations(teamContext);
  const now = new Date();

  return (
    iterations.find((iter) => {
      if (!iter.attributes?.startDate || !iter.attributes?.finishDate) return false;
      const start = new Date(iter.attributes.startDate);
      const end = new Date(iter.attributes.finishDate);
      // Include the entire last day of the sprint
      end.setHours(23, 59, 59, 999);
      return now >= start && now <= end;
    }) ?? null
  );
}

/**
 * Get sprint info for the current iteration.
 */
export async function getSprintInfo(
  teamContext: TeamContext
): Promise<SprintInfo | null> {
  const iteration = await getCurrentIteration(teamContext);
  if (!iteration?.attributes?.startDate || !iteration?.attributes?.finishDate) {
    return null;
  }

  const startDate = new Date(iteration.attributes.startDate);
  const endDate = new Date(iteration.attributes.finishDate);
  const now = new Date();
  const totalDays = daysBetween(startDate, endDate);
  const elapsedDays = Math.min(daysBetween(startDate, now), totalDays);
  const remainingDays = totalDays - elapsedDays;

  return {
    id: iteration.id,
    name: iteration.name,
    startDate,
    endDate,
    totalDays,
    elapsedDays,
    remainingDays,
    timeRatio: totalDays > 0 ? elapsedDays / totalDays : 1,
  };
}

/**
 * Get past N iterations for velocity trending.
 */
export async function getPastIterations(
  teamContext: TeamContext,
  count: number = 3
): Promise<TeamSettingsIteration[]> {
  const iterations = await getTeamIterations(teamContext);
  const now = new Date();

  const past = iterations
    .filter((iter) => {
      if (!iter.attributes?.finishDate) return false;
      return new Date(iter.attributes.finishDate) < now;
    })
    .sort(
      (a, b) =>
        new Date(b.attributes!.finishDate!).getTime() -
        new Date(a.attributes!.finishDate!).getTime()
    );

  return past.slice(0, count);
}

/**
 * Build a team context from the current project.
 * Queries the Core API to resolve the real default team (or a named team).
 */
export async function buildTeamContext(teamName?: string): Promise<TeamContext> {
  const { projectName, projectId } = await getProjectContext();

  if (teamName) {
    return {
      projectId,
      project: projectName,
      teamId: teamName,
      team: teamName,
    };
  }

  // Discover the default team from the project's teams list
  try {
    const coreClient = await getCoreClient();
    const teams = await coreClient.getTeams(projectId);
    const defaultTeam = teams[0]; // ADO returns default team first
    if (defaultTeam) {
      return {
        projectId,
        project: projectName,
        teamId: defaultTeam.id,
        team: defaultTeam.name,
      };
    }
  } catch {
    // Fall through to convention-based name
  }

  // Fallback: use standard convention
  return {
    projectId,
    project: projectName,
    teamId: `${projectName} Team`,
    team: `${projectName} Team`,
  };
}
