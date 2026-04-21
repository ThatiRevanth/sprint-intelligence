import { getWorkClient, getCoreClient, getProjectContext } from './azure-devops.service';
import type { TeamContext } from 'azure-devops-extension-api/Core';
import type { TeamMemberCapacityIdentityRef } from 'azure-devops-extension-api/Work';
import { cached } from './sprint-data-cache.service';

export interface TeamMemberInfo {
  name: string;
  id: string;
  imageUrl?: string;
  capacityPerDay: number;
}

/**
 * Get team members with their capacity for the given iteration.
 */
export async function getTeamCapacity(
  teamContext: TeamContext,
  iterationId: string
): Promise<TeamMemberInfo[]> {
  const workClient = await getWorkClient();

  const capacities: TeamMemberCapacityIdentityRef[] =
    await workClient.getCapacitiesWithIdentityRefAndTotals(teamContext, iterationId)
      .then((result) => (result as any).teamMembers ?? [])
      .catch(() => []);

  return capacities.map((cap) => {
    const totalCapacityPerDay = cap.activities
      ? cap.activities.reduce((sum, act) => sum + (act.capacityPerDay ?? 0), 0)
      : 0;

    return {
      name: (cap as any).teamMember?.displayName ?? 'Unknown',
      id: (cap as any).teamMember?.id ?? '',
      imageUrl: (cap as any).teamMember?.imageUrl,
      capacityPerDay: totalCapacityPerDay,
    };
  });
}

/**
 * Get all team members for the project.
 */
export async function getTeamMembers(
  teamName?: string
): Promise<{ name: string; id: string; imageUrl?: string }[]> {
  return cached(`members:${teamName ?? '__default__'}`, () => fetchTeamMembers(teamName));
}

async function fetchTeamMembers(
  teamName?: string
): Promise<{ name: string; id: string; imageUrl?: string }[]> {
  const coreClient = await getCoreClient();
  const { projectId } = await getProjectContext();

  const teams = await coreClient.getTeams(projectId);
  const team = teamName
    ? teams.find((t) => t.name === teamName)
    : teams[0];

  if (!team) return [];

  const members = await coreClient.getTeamMembersWithExtendedProperties(
    projectId,
    team.id
  );

  return members.map((m) => ({
    name: m.identity?.displayName ?? 'Unknown',
    id: m.identity?.id ?? '',
    imageUrl: (m.identity as any)?.imageUrl,
  }));
}
