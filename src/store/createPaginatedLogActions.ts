/**
 * createPaginatedLogActions — shared paginated-log store actions.
 *
 * The ingredient- and raw-material-consumption log stores had byte-identical
 * `initializeLogs` / `refreshLogs` / `loadMore` / `setFilters` / `clearError`
 * implementations (LIMIT/OFFSET pagination on a `consumed_at DESC` list plus a
 * companion "supporting data" fetch for the header summary/trend). This factory
 * holds that logic once; each store supplies its own typed fetchers + messages
 * and keeps its own initial state and any extra actions.
 *
 * Page math: `loadMore` uses `currentPage * PAGE_SIZE` offset paging and derives
 * `hasMore` from `totalCount > loaded`, matching the original stores exactly.
 */

/** Pagination + status fields every paginated-log store exposes. */
export interface PaginatedLogBase<TLog, TFilters> {
  logs:          TLog[];
  totalCount:    number;
  hasMore:       boolean;
  currentPage:   number;
  filters:       TFilters;
  isLoading:     boolean;
  isLoadingMore: boolean;
  error:         string | null;
}

/** The action set this factory produces. */
export interface PaginatedLogActions<TFilters> {
  initializeLogs: () => Promise<void>;
  refreshLogs:    () => Promise<void>;
  loadMore:       () => Promise<void>;
  setFilters:     (filters: TFilters) => Promise<void>;
  clearError:     () => void;
}

export interface PaginatedLogConfig<TLog, TFilters, S> {
  pageSize: number;
  /** Fetches a single page of rows + the total row count for the filters. */
  fetchPage: (filters: TFilters, offset: number) => Promise<{ logs: TLog[]; totalCount: number }>;
  /** Fetches header companion data (summary/trend/etc.) as a state patch. */
  fetchSupportingData: (filters: TFilters) => Promise<Partial<S>>;
  /** Fallback error messages per action. */
  messages: {
    load:     string;
    refresh:  string;
    filter:   string;
    loadMore: string;
  };
}

/**
 * Builds the shared paginated-log actions, bound to a store's `set`/`get`.
 * Spread the result into the store's creator alongside its initial state.
 *
 * @example
 * create<MyState>()((set, get) => ({
 *   ...INITIAL,
 *   ...createPaginatedLogActions<Log, Filters, MyState>(set, get, { pageSize: 30, fetchPage, fetchSupportingData, messages }),
 * }))
 */
export function createPaginatedLogActions<TLog, TFilters, S extends PaginatedLogBase<TLog, TFilters>>(
  set:    (partial: Partial<S>) => void,
  get:    () => S,
  config: PaginatedLogConfig<TLog, TFilters, S>,
): PaginatedLogActions<TFilters> {
  const { pageSize, fetchPage, fetchSupportingData, messages } = config;

  // initialize and refresh load page 0 + supporting data identically; only the
  // fallback error message differs.
  const loadFirstPage = async (fallbackMessage: string): Promise<void> => {
    set({ isLoading: true, error: null } as Partial<S>);
    try {
      const { filters } = get();
      const [{ logs, totalCount }, supporting] = await Promise.all([
        fetchPage(filters, 0),
        fetchSupportingData(filters),
      ]);
      set({
        ...supporting,
        logs,
        totalCount,
        hasMore:     totalCount > logs.length,
        currentPage: 0,
        isLoading:   false,
      } as Partial<S>);
    } catch (err) {
      const message = err instanceof Error ? err.message : fallbackMessage;
      set({ isLoading: false, error: message } as Partial<S>);
    }
  };

  return {
    initializeLogs: () => loadFirstPage(messages.load),
    refreshLogs:    () => loadFirstPage(messages.refresh),

    loadMore: async () => {
      const { hasMore, isLoadingMore, isLoading, currentPage, filters, logs } = get();
      if (!hasMore || isLoadingMore || isLoading) return;

      set({ isLoadingMore: true } as Partial<S>);
      try {
        const nextPage = currentPage + 1;
        const offset   = nextPage * pageSize;
        const { logs: newLogs, totalCount } = await fetchPage(filters, offset);

        set({
          logs:          [...logs, ...newLogs],
          totalCount,
          hasMore:       totalCount > (logs.length + newLogs.length),
          currentPage:   nextPage,
          isLoadingMore: false,
        } as Partial<S>);
      } catch (err) {
        const message = err instanceof Error ? err.message : messages.loadMore;
        set({ isLoadingMore: false, error: message } as Partial<S>);
      }
    },

    setFilters: async (filters: TFilters) => {
      set({ filters, isLoading: true, error: null, logs: [] as TLog[], currentPage: 0 } as Partial<S>);
      try {
        const [{ logs, totalCount }, supporting] = await Promise.all([
          fetchPage(filters, 0),
          fetchSupportingData(filters),
        ]);
        set({
          ...supporting,
          logs,
          totalCount,
          hasMore:   totalCount > logs.length,
          isLoading: false,
        } as Partial<S>);
      } catch (err) {
        const message = err instanceof Error ? err.message : messages.filter;
        set({ isLoading: false, error: message } as Partial<S>);
      }
    },

    clearError: () => set({ error: null } as Partial<S>),
  };
}
