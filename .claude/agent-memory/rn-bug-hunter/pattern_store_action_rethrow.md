---
name: Store Action Re-throw Convention
description: Zustand store actions called from UI event handlers must re-throw after catching, or the UI can never distinguish success from failure.
type: feedback
---

Store actions that are awaited directly from form `onSubmit` handlers (or any UI try/catch) MUST re-throw after recording the error in state. If they only call `set({ error: message })` and return normally, the caller's promise resolves as a success and the UI's catch block becomes dead code.

**Pattern to enforce:**

```ts
someAction: async (input) => {
  set({ error: null });
  try {
    await doWork(input);
    await get().refreshData();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Operation failed';
    set({ error: message });
    throw err; // <-- required so UI catch blocks fire
  }
},
```

**Why:** The ManualEntryBottomSheet.onSubmit wraps `await logManualEntry(input)` in a try/catch and sets `submitStatus('error')` in the catch. Before the fix, `logManualEntry` swallowed all errors — the form always showed "Entry saved successfully!" even when the DB write failed.

**How to apply:** Every Zustand action in this project that is awaited from a UI try/catch must re-throw. Actions that are fire-and-forget (called with `void` prefix and no UI error handling) may remain silent if they set the store error field.
