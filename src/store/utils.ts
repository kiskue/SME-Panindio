/**
 * Shared Zustand store helpers.
 *
 * `withAsync` removes the repeated
 *   `set({ isLoading: true, error: null }); try { … set({ …, isLoading: false }) }
 *    catch (err) { set({ isLoading: false, error: message }) }`
 * boilerplate that appears 50+ times across the stores.
 *
 * The `work` callback returns the success-state patch (or nothing), and the
 * helper merges it with `isLoading: false` in a single `set`, so each action
 * keeps one success `set` and no hand-written try/catch.
 */

/** Minimal slice every async-capable store exposes. */
export interface AsyncSlice {
  isLoading: boolean;
  error:     string | null;
}

type PartialSetter<S> = (partial: Partial<S>) => void;

export interface WithAsyncOptions {
  /** Message used when the thrown error is not an `Error` instance. */
  fallbackMessage?: string;
  /** Re-throw after recording the error (lets a caller's catch react too). Default false. */
  rethrow?: boolean;
}

/**
 * Runs an async store action with standard loading + error handling.
 *
 * @example
 * loadLogs: async (year, month) => {
 *   await withAsync(set, async () => {
 *     const logs = await getUtilityLogs({ year, month });
 *     return { logs, _activeYear: year, _activeMonth: month };
 *   }, { fallbackMessage: 'Failed to load utility logs' });
 * },
 */
export async function withAsync<S extends AsyncSlice>(
  set:  PartialSetter<S>,
  work: () => Promise<Partial<S> | void>,
  opts: WithAsyncOptions = {},
): Promise<void> {
  set({ isLoading: true, error: null } as Partial<S>);
  try {
    const patch = await work();
    set({ ...(patch ?? {}), isLoading: false } as Partial<S>);
  } catch (err) {
    const message = err instanceof Error ? err.message : (opts.fallbackMessage ?? 'Something went wrong');
    set({ isLoading: false, error: message } as Partial<S>);
    if (opts.rethrow) throw err;
  }
}
