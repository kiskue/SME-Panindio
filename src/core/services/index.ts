/**
 * Core (cross-cutting) services barrel.
 *
 * Domain-neutral services that are consumed across multiple features and do
 * not belong to a single feature folder. Feature-specific services live under
 * `src/features/<feature>/services/`.
 */
export * from './product.service';
