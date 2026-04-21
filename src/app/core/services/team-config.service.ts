import { TeamGroup } from '../models';
import { getExtensionDataManager, getProjectContext } from './azure-devops.service';
import { getSelectedTeamContext } from './team-selection.service';

const DOC_COLLECTION = 'standup-team-groups';

export interface TeamMemberConfig {
  group: TeamGroup;
  visible: boolean;
  region?: string;
}

/**
 * Load the standup team config (member → group + visible).
 * Returns the same config used by StandupComponent, scoped to project+team.
 */
export async function loadTeamConfig(): Promise<Map<string, TeamMemberConfig>> {
  try {
    const { projectId } = await getProjectContext();
    const teamContext = await getSelectedTeamContext();
    const docId = `${projectId}-${teamContext.team}`
      .replaceAll(/[^a-zA-Z0-9\-_]/g, '_')
      .substring(0, 50);
    const manager = await getExtensionDataManager();
    const doc = await manager.getDocument(DOC_COLLECTION, docId);

    if (doc?.config) {
      return new Map(doc.config as [string, TeamMemberConfig][]);
    }
    if (doc?.groups) {
      const legacy = doc.groups as [string, TeamGroup][];
      return new Map(legacy.map(([name, group]) => [name, { group, visible: true }]));
    }
  } catch {
    // Document doesn't exist yet
  }
  return new Map();
}

/**
 * Get the set of visible member names from standup team config.
 * If no config exists, returns null (meaning: don't filter).
 */
export async function getVisibleMembers(): Promise<Set<string> | null> {
  const config = await loadTeamConfig();
  if (config.size === 0) return null;
  const visible = new Set<string>();
  for (const [name, cfg] of config) {
    if (cfg.visible !== false) visible.add(name);
  }
  return visible;
}
