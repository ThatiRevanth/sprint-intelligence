/**
 * @file mock-sdk.js
 * Drop-in mock for `azure-devops-extension-sdk`.
 * Used in local development via webpack alias (see webpack.local.config.js).
 *
 * Seeds default leave / holiday data into localStorage on first load so that
 * every tab renders with realistic content immediately.
 */

import { EXTENSION_DATA_SEED, MOCK_USER, MOCK_PROJECT } from './mock-data.js';

const STORAGE_PREFIX = 'ado-ext-';

/** Seed localStorage with demo data on first run (non-destructive). */
function seedExtensionData() {
  for (const [key, value] of Object.entries(EXTENSION_DATA_SEED)) {
    const storageKey = `${STORAGE_PREFIX}${key}`;
    if (!localStorage.getItem(storageKey)) {
      localStorage.setItem(storageKey, JSON.stringify(value));
    }
  }
}

/** Build a mock IExtensionDataManager backed by localStorage. */
function createDataManager() {
  return {
    getDocument(collection, id) {
      const key = `${STORAGE_PREFIX}${collection}/${id}`;
      const raw = localStorage.getItem(key);
      if (raw == null) return Promise.reject(new Error(`Document not found: ${collection}/${id}`));
      return Promise.resolve(JSON.parse(raw));
    },
    setDocument(collection, doc) {
      const key = `${STORAGE_PREFIX}${collection}/${doc.id}`;
      const saved = { ...doc };
      localStorage.setItem(key, JSON.stringify(saved));
      return Promise.resolve(saved);
    },
    updateDocument(collection, doc) {
      return this.setDocument(collection, doc);
    },
    getDocuments(collection) {
      const prefix = `${STORAGE_PREFIX}${collection}/`;
      const docs = Object.keys(localStorage)
        .filter(k => k.startsWith(prefix))
        .map(k => JSON.parse(localStorage.getItem(k)));
      return Promise.resolve(docs);
    },
  };
}

// Seed on module load
seedExtensionData();

/* ── SDK exports ─────────────────────────────────────── */

export function init()  { return Promise.resolve(); }
export function ready() { return Promise.resolve(); }

export function getUser() {
  return { ...MOCK_USER };
}

export function getAccessToken() {
  return Promise.resolve('mock-local-token');
}

export function getExtensionContext() {
  return { id: 'mock.sprint-intelligence', version: '1.0.0', publisherId: 'local' };
}

/**
 * Mock SDK.getService().
 * Recognises two service IDs — ProjectPageService and ExtensionDataService.
 */
export function getService(serviceId) {
  // ProjectPageService
  if (serviceId === 'ms.vss-tfs-web.tfs-page-data-service') {
    return Promise.resolve({
      getProject: () => Promise.resolve({ ...MOCK_PROJECT }),
    });
  }

  // ExtensionDataService (all other IDs fall through here)
  return Promise.resolve({
    getExtensionDataManager: (_extensionId, _token) =>
      Promise.resolve(createDataManager()),
  });
}

// Alias: some code paths call SDK.getHostContext()
export function getHostContext() {
  return { id: 'local', name: 'Local Dev', type: 'host' };
}
