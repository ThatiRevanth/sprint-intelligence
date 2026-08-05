/**
 * @file mock-api-work.js
 * Mock for `azure-devops-extension-api/Work` (WorkRestClient).
 */

import { MOCK_ITERATIONS, MOCK_CAPACITY } from './mock-data.js';

export class WorkRestClient {
  /** All iterations for any team context — returns full iteration list. */
  getTeamIterations(_teamContext) {
    return Promise.resolve(MOCK_ITERATIONS.map(i => ({ ...i })));
  }

  /** Capacity data shaped exactly as the capacity.service expects. */
  getCapacitiesWithIdentityRefAndTotals(_teamContext, _iterationId) {
    return Promise.resolve({ ...MOCK_CAPACITY });
  }

  /**
   * Team field values — used to derive the team's area path.
   * Returns a simple default matching the mock project structure.
   */
  getTeamFieldValues(_teamContext) {
    return Promise.resolve({ defaultValue: 'Demo Project\\Alpha Team' });
  }

  /** Board settings / team settings — not heavily used but must not throw. */
  getTeamSettings(_teamContext) {
    return Promise.resolve({ backlogIteration: MOCK_ITERATIONS[3] });
  }

  /** Returns an empty iteration work-items list (not used by current services). */
  getTeamIterationWorkItems(_teamContext, _iterationId) {
    return Promise.resolve({ workItemRelations: [] });
  }
}
