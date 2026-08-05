/**
 * @file mock-api-core.js
 * Mock for `azure-devops-extension-api/Core` (CoreRestClient).
 */

import { MOCK_TEAMS, MOCK_TEAM_MEMBERS_RAW } from './mock-data.js';

export class CoreRestClient {
  /** Returns the list of teams in the project. */
  getTeams(_projectId) {
    return Promise.resolve(MOCK_TEAMS.map(t => ({ ...t })));
  }

  /** Returns team members wrapped in the identity-ref shape the app expects. */
  getTeamMembersWithExtendedProperties(_projectId, _teamId) {
    const members = MOCK_TEAM_MEMBERS_RAW.map(m => ({
      identity: { ...m },
      isTeamAdmin: m.id === 'user-alice-001',
    }));
    return Promise.resolve(members);
  }
}
