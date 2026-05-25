/**
 * Generic data cache with TTL and in-flight request deduplication.
 *
 * When multiple components request the same data simultaneously
 * (e.g. 6 tabs all calling getSprintWorkItems on team switch),
 * only ONE API call is made and the result is shared.
 *
 * A version counter guards against a race condition where:
 * 1. clearSprintCache() is called (cache wiped, version incremented)
 * 2. An async gap occurs before cached() reaches its cache.set() (e.g. await getProjectContext())
 * 3. An old in-flight .then() fires during that gap and repopulates the cache with stale data
 * 4. The new cached() call then gets a cache HIT on that stale entry
 * In-flight promises capture the version at launch and silently discard their result if the
 * version has changed by the time they resolve.
 */

const cache = new Map<string, { data: unknown; ts: number }>();
const inflight = new Map<string, Promise<unknown>>();
let cacheVersion = 0;

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Execute an async function with caching and in-flight deduplication.
 * - If a cached result exists and is within TTL, return it immediately.
 * - If an identical request is already in-flight, piggyback on it.
 * - Otherwise, execute the function, cache the result, and return it.
 */
export async function cached<T>(key: string, fn: () => Promise<T>, ttl = DEFAULT_TTL): Promise<T> {
  const existing = cache.get(key);
  if (existing && Date.now() - existing.ts < ttl) {
    return existing.data as T;
  }

  // Deduplicate concurrent requests for the same key
  if (inflight.has(key)) {
    return inflight.get(key) as Promise<T>;
  }

  // Capture version so we can detect if clearSprintCache() fires while this request is in-flight
  const version = cacheVersion;

  const promise = fn()
    .then((data) => {
      // Only write to cache if no clear has happened since this request started.
      // Without this guard, a stale .then() resolving after a clear would repopulate
      // the cache and cause the next cached() call (which may be waiting on an async
      // gap like getProjectContext()) to get a false cache hit with stale data.
      if (cacheVersion === version) {
        cache.set(key, { data, ts: Date.now() });
      }
      inflight.delete(key);
      return data;
    })
    .catch((err) => {
      inflight.delete(key);
      throw err;
    });

  inflight.set(key, promise);
  return promise;
}

/**
 * Clear all cached data. Called on force-refresh and team switch so stale
 * data from the previous state is never shown.
 * Incrementing cacheVersion invalidates all currently in-flight promises so
 * they cannot repopulate the cache after the clear.
 */
export function clearSprintCache(): void {
  cacheVersion++;
  cache.clear();
  inflight.clear();
}
