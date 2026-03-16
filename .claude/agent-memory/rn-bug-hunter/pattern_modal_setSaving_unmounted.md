---
name: Modal setSaving on Unmounted Component
description: finally { setSaving(false) } in a bottom sheet handleSave must guard with a mountedRef because onClose() may unmount the component before finally runs
type: feedback
---

In `AddEditBottomSheet`, `handleSave` calls `onClose()` on success inside the `try` block. The parent then hides the Modal. By the time the `finally` block executes, the component may be unmounted. Calling `setSaving(false)` on an unmounted component triggers a React warning in development and is a latent memory/state leak.

**Why:** React 19 keeps this as a warning (not a crash), but it still indicates improper lifecycle management. The Modal's parent can hide it synchronously once `onClose()` is called.

**How to apply:** Add a `mountedRef = useRef(true)` and a cleanup effect that sets it to `false` on unmount. In the `finally` block, guard `setSaving(false)` behind `if (mountedRef.current)`. This pattern is needed in any component that calls an async operation and then closes itself on success.
