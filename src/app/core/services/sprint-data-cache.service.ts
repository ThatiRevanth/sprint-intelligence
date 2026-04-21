/**
 * Generic data cache with TTL and in-flight request deduplication.
 *
 * When multiple components request the same data simultaneously
 * (e.g. 6 tabs all calling getSprintWorkItems on team switch),
 * only ONE API call is made and the result is shared.
 */

const cache = new Map<string, { data: unknown; ts: number }>();
const inflight = new Map<string, Promise<unknown>>();

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

  const promise = fn()
    .then((data) => {
      cache.set(key, { data, ts: Date.now() });
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
 * Clear all cached data. Called on team switch so stale
 * data from the previous team is never shown.
 */
export function clearSprintCache(): void {
  cache.clear();
  inflight.clear();
}
