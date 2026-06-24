/**
 * Auth feature store barrel.
 *
 * Authentication/session state. Note: app-wide store bootstrapping still lives
 * in `src/store/index.ts` (`initializeStores`/`resetAllStores`), which re-exports
 * this store for backwards-compatible `@/store` consumers.
 */
export * from './auth.store';
