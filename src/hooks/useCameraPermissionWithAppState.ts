import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import type { AppStateStatus } from 'react-native';
import { useCameraPermissions } from 'expo-camera';
import type { PermissionResponse } from 'expo-camera';

/**
 * Options for {@link useCameraPermissionWithAppState}.
 */
export interface UseCameraPermissionWithAppStateOptions {
  /**
   * When `true`, fire the OS camera-permission dialog automatically the first
   * time the permission status is known to be `granted === false` and the OS
   * still allows asking (`canAskAgain === true`). The request fires at most
   * once for the lifetime of the hook instance (guarded by a ref), so toggling
   * this flag or re-rendering never re-triggers the dialog.
   *
   * Typical usage: pass the screen/modal `visible` flag so the dialog only
   * auto-prompts when the camera surface is actually shown.
   */
  autoRequestOnMount?: boolean;
}

/** Request the camera permission, surfacing the OS dialog when allowed. */
export type RequestCameraPermission = () => Promise<PermissionResponse>;

/**
 * Re-read the current OS camera-permission status WITHOUT showing a dialog.
 * Used to refresh stale state after the user returns from device Settings.
 */
export type GetCameraPermission = () => Promise<PermissionResponse>;

/**
 * Drop-in replacement for expo-camera's `useCameraPermissions()` that:
 *
 *  1. Refreshes the permission status whenever the app returns to the
 *     foreground (`AppState` → `'active'`), so toggling the permission in
 *     device Settings applies immediately — no app restart required. This uses
 *     the silent getter (3rd tuple element) and never shows a prompt.
 *  2. Optionally auto-fires the OS permission dialog once on first open
 *     (see {@link UseCameraPermissionWithAppStateOptions.autoRequestOnMount}).
 *
 * Returns the same `[permission, requestPermission]` shape existing callers use,
 * plus the silent `getPermission` getter as a 3rd element for callers that want
 * to refresh manually.
 */
export function useCameraPermissionWithAppState(
  options: UseCameraPermissionWithAppStateOptions = {},
): [PermissionResponse | null, RequestCameraPermission, GetCameraPermission] {
  const { autoRequestOnMount = false } = options;

  const [permission, requestPermission, getPermission] = useCameraPermissions();

  // Refresh the status when the app returns to the foreground so a permission
  // toggled in device Settings is reflected without a restart.
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        void getPermission();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [getPermission]);

  // Auto-prompt exactly once on first open when allowed.
  const hasAutoRequestedRef = useRef(false);
  useEffect(() => {
    if (!autoRequestOnMount) return;
    if (hasAutoRequestedRef.current) return;
    if (!permission) return; // status not loaded yet
    if (permission.granted) return;
    if (!permission.canAskAgain) return;

    hasAutoRequestedRef.current = true;
    void requestPermission();
  }, [autoRequestOnMount, permission, requestPermission]);

  return [permission, requestPermission, getPermission];
}
