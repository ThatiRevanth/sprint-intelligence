/**
 * @file mock-api.js
 * Mock for the `azure-devops-extension-api` root package.
 *
 * Provides:
 *  - CommonServiceIds  (string constants matching mock-sdk.js)
 *  - getClient()       (instantiates the right mock REST client)
 */

import { CoreRestClient }                from './mock-api-core.js';
import { WorkRestClient }                from './mock-api-work.js';
import { WorkItemTrackingRestClient }    from './mock-api-wit.js';
import { GitRestClient }                 from './mock-api-git.js';

export { PullRequestStatus } from './mock-api-git.js';

/** Must match the service IDs used in mock-sdk.js's getService(). */
export const CommonServiceIds = {
  ProjectPageService:  'ms.vss-tfs-web.tfs-page-data-service',
  ExtensionDataService: 'ms.vss-web.data-service',
};

/** Map of class → factory function for fast O(1) lookup. */
const REGISTRY = new Map([
  [CoreRestClient,             () => new CoreRestClient()],
  [WorkRestClient,             () => new WorkRestClient()],
  [WorkItemTrackingRestClient, () => new WorkItemTrackingRestClient()],
  [GitRestClient,              () => new GitRestClient()],
]);

/**
 * Drop-in replacement for `API.getClient(ClientClass)`.
 * The ClientClass passed by the source code is the SAME mock class (via webpack
 * alias), so reference equality in the Map lookup works correctly.
 */
export function getClient(ClientClass) {
  const factory = REGISTRY.get(ClientClass);
  if (factory) return factory();
  // Graceful fallback for any un-mocked client
  try { return new ClientClass(); } catch { return {}; }
}
