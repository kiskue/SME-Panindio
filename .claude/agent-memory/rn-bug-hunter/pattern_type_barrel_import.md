---
name: Always import from @/types barrel, never from subpath
description: All files (src/ and database/) must import domain types from '@/types', never from '@/types/raw_materials.types' or other subpaths, to stay consistent and prevent barrel-only export failures.
type: feedback
---

All type imports across the project — whether in `src/components/`, `src/store/`, `src/app/`, or `database/repositories/` — must use the `@/types` barrel:

```ts
import type { RawMaterial, RawMaterialReason } from '@/types';
```

NOT:
```ts
import type { RawMaterial } from '@/types/raw_materials.types';
```

The `@/types/*` path alias is valid for direct subpath imports, but using it bypasses the barrel's re-export control and diverges from every other file in the codebase. If the barrel ever switches to re-export-only (removing the source file from the alias), direct subpath imports will break silently.

**Why:** Codebase convention. All ~20 existing stores, repositories, and screens use `'@/types'`. New modules added `@/types/raw_materials.types` subpath imports inconsistently.

**How to apply:** At the end of every new feature implementation, grep for `from '@/types/` (with a trailing slash) and replace with `from '@/types'`.
