---
name: Overhead Expenses Module Patterns
description: Screen patterns, store API, and design decisions for the Overhead Expenses module
type: project
---

## Key Files
- Screen: `src/app/(app)/(tabs)/overhead.tsx`
- Store: `src/store/overhead_expenses.store.ts` (SQLite-backed)
- Repository: `database/repositories/overhead_expenses.repository.ts`
- Types: `src/types/overhead_expenses.types.ts`

## Domain Rules
- `OverheadFrequency`: `'one_time' | 'monthly' | 'quarterly' | 'annual'` — uses UNDERSCORES, NOT hyphens
- Entries are **immutable** — no edit/delete; corrections are new entries. `logExpense` is the only mutation action.
- `OverheadExpenseSummary { thisMonth, thisYear, allTime }` — from `getOverheadExpenseSummary()` in repository

## Store Selectors
`selectOverheadExpenses`, `selectOverheadLoading`, `selectOverheadLoadingMore`, `selectOverheadError`,
`selectOverheadTotalCount`, `selectOverheadHasMore`, `selectOverheadFilters`, `selectOverheadSummary`

- `selectOverheadSummary` was added during 2026-03-19 session (not in original store)
- Store state has `summary: OverheadExpenseSummary` populated during `initializeExpenses` via parallel `Promise.all`
- After `logExpense`, summary refreshed non-blockingly: `void getOverheadExpenseSummary().then(s => set({ s })).catch(() => undefined)`

## Category System
Category colors: rent→`#8B5CF6` | renovation→`#F97316` | utilities→`#3B82F6` | insurance→success[500] | maintenance→warning[500] | other→gray
Category icons (lucide): Home | Hammer | Zap | Shield | Wrench | MoreHorizontal

## Screen Architecture
- Stat pills row: 3 pills (This Month / This Year / All Time) from `overheadSummary`
- Category filter chips: All + 6 categories — drives `filters.category` via `setFilters` with conditional spread:
  ```ts
  const { category: _prev, ...rest } = filters;
  void setFilters(cat !== 'all' ? { ...rest, category: cat } : rest);
  ```
- FlatList with header (pills + chips), footer loader, empty state, paginated via `loadMore` on `onEndReached`
- FAB: 56×56, `borderRadius: 28`, `bottom: spacing.xl, right: spacing.md`, `paddingBottom: 100` on list content
- `useFocusEffect` + `refreshExpenses` for focus-triggered refresh

## ExpenseCard
- 4px left accent bar using category color
- Icon pill: 36×36, `borderRadius: 8`, `${categoryColor}1A` bg
- Shows: description, amount (h4, bold), frequency badge, date, notes (if present), recurring indicator
- No edit/delete buttons — view-only by design

## Log Expense Bottom Sheet
- `Animated.spring` slide-up (translateY 700 → 0)
- Fields: category (chip picker), amount, description, frequency (chip picker), expense date, isRecurring (toggle), reference number, notes
- `handleSave` calls `logExpense` (NOT `addExpense`)
- Optional fields use conditional spread: `...(ref.trim() !== '' ? { referenceNumber: ref.trim() } : {})`
- Alert on failure: `Alert.alert('Error', 'Could not log expense. Please try again.')`

## Navigation Registration
- `ROUTE_TITLES`: `'/overhead': 'Overhead Expenses'` in `_layout.tsx`
- `Drawer.Screen name="overhead"` in `_layout.tsx`
- AppDrawer nav item: after utilities, `Building2` icon + `#8B5CF6`, `dividerBefore: false`

## Dashboard Integration
- `overheadSummary = useOverheadExpensesStore(selectOverheadSummary)` in dashboard screen
- Overhead KPI cards use `overheadSummary.thisMonth` / `overheadSummary.thisYear` directly
- `OVERHEAD_PURPLE = '#8B5CF6'` constant in dashboard screen
- QuickActions now has 4 active buttons: POS / Inventory / Utilities / Overhead (Reports removed)
- `QuickActionsProps` has `onPressOverhead: () => void`; `goToOverhead = useCallback(() => router.push('/(app)/(tabs)/overhead'), [router])`
