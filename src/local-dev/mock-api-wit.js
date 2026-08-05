/**
 * @file mock-api-wit.js
 * Mock for `azure-devops-extension-api/WorkItemTracking` (WorkItemTrackingRestClient).
 *
 * queryByWiql  → returns all mock work-item IDs regardless of the WIQL filter
 *               (sufficient for local testing of all 10 tabs)
 * getWorkItems → looks up items by ID from the mock dataset
 */

import { MOCK_WORK_ITEMS, MOCK_WORK_ITEM_IDS } from './mock-data.js';

const WI_MAP = new Map(MOCK_WORK_ITEMS.map(w => [w.id, w]));

export class WorkItemTrackingRestClient {
  /**
   * Returns all mock work-item references regardless of the WIQL query.
   * The real service filters by sprint/area — here we return everything and let
   * the downstream mapping functions work with the full dataset.
   */
  queryByWiql(_wiql, _project) {
    return Promise.resolve({ workItems: MOCK_WORK_ITEM_IDS });
  }

  /**
   * Fetch full work-item details for the given IDs.
   * Mirrors the signature used in the real code:
   *   getWorkItems(ids, project, fields, asOf, expand)
   */
  getWorkItems(ids, _project, _fields, _asOf, _expand) {
    const items = ids.map(id => WI_MAP.get(id)).filter(Boolean);
    return Promise.resolve(items);
  }

  /** Alias used in some query paths. */
  getWorkItemsBatch(request, _project) {
    const ids = (request && request.ids) ? request.ids : [];
    return this.getWorkItems(ids);
  }
}
