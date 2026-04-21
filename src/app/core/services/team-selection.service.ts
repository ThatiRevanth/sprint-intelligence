import { signal } from "@angular/core";
import type { TeamContext, WebApiTeam } from "azure-devops-extension-api/Core";
import {
  getCoreClient,
  getProjectContext,
  getExtensionDataManager,
  getWorkClient,
} from "./azure-devops.service";
import { clearSprintCache } from "./sprint-data-cache.service";

export interface TeamInfo {
  id: string;
  name: string;
  description?: string;
  areaPath?: string;
}

const DOC_COLLECTION = "team-selection";
const DOC_ID = "selected-team";

/** All teams in the current project */
export const teams = signal<TeamInfo[]>([]);

/** Currently selected team */
export const selectedTeam = signal<TeamInfo | null>(null);

/** Whether teams are still loading */
export const teamsLoading = signal(true);

/** Whether initTeams has completed at least once (team ready to use) */
export const teamsReady = signal(false);

/** Incremented each time the user explicitly switches teams (not on initial load) */
export const teamSwitchCount = signal(0);

/** Whether the team selector dropdown should be disabled (e.g. during config editing) */
export const teamSelectorDisabled = signal(false);

/**
 * Load all teams for the current project and restore persisted selection.
 */
export async function initTeams(): Promise<void> {
  teamsLoading.set(true);
  try {
    const { projectId } = await getProjectContext();
    const coreClient = await getCoreClient();
    const rawTeams: WebApiTeam[] = await coreClient.getTeams(projectId);
    const workClient = await getWorkClient();

    const teamList: TeamInfo[] = await Promise.all(
      rawTeams.map(async (t) => {
        const teamContext: TeamContext = {
          projectId,
          project: projectId,
          teamId: t.id,
          team: t.name,
        };
        let areaPath: string | undefined;
        try {
          const fieldValues = await workClient.getTeamFieldValues(teamContext);
          areaPath = fieldValues.defaultValue;
        } catch {
          // Team may not have field values configured
        }
        return {
          id: t.id,
          name: t.name,
          description: t.description,
          areaPath,
        };
      })
    );
    teams.set(teamList);

    // Try to restore previously selected team
    const savedName = await loadSavedTeam();
    const saved = savedName ? teamList.find((t) => t.name === savedName) : null;
    selectedTeam.set(saved ?? teamList[0] ?? null);
  } catch {
    teams.set([]);
    selectedTeam.set(null);
  } finally {
    teamsLoading.set(false);
    teamsReady.set(true);
  }
}

/**
 * Switch to a different team and persist the choice.
 */
export async function selectTeam(team: TeamInfo): Promise<void> {
  selectedTeam.set(team);
  clearSprintCache();
  teamSwitchCount.update((c) => c + 1);
  await saveSelectedTeam(team.name);
}

/**
 * Build a TeamContext from the currently selected team.
 * Falls back to buildTeamContext() behavior if no team is selected.
 */
export async function getSelectedTeamContext(): Promise<TeamContext> {
  const team = selectedTeam();
  const { projectName, projectId } = await getProjectContext();

  if (team) {
    return {
      projectId,
      project: projectName,
      teamId: team.id,
      team: team.name,
    };
  }

  // Fallback: first team from API
  const coreClient = await getCoreClient();
  const rawTeams = await coreClient.getTeams(projectId);
  const first = rawTeams[0];
  if (first) {
    return {
      projectId,
      project: projectName,
      teamId: first.id,
      team: first.name,
    };
  }

  return {
    projectId,
    project: projectName,
    teamId: `${projectName} Team`,
    team: `${projectName} Team`,
  };
}

async function loadSavedTeam(): Promise<string | null> {
  try {
    const manager = await getExtensionDataManager();
    const doc = await manager.getDocument(DOC_COLLECTION, DOC_ID);
    return doc?.teamName ?? null;
  } catch {
    return null;
  }
}

let existingDoc: Record<string, any> | null = null;

async function saveSelectedTeam(teamName: string): Promise<void> {
  try {
    const manager = await getExtensionDataManager();
    const doc = {
      ...existingDoc,
      id: DOC_ID,
      teamName,
    };
    existingDoc = await manager.setDocument(DOC_COLLECTION, doc);
  } catch {
    // Non-critical — selection won't persist across reloads
  }
}
