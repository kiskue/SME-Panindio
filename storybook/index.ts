/**
 * Storybook UI Entry Point
 *
 * Bootstraps the on-device Storybook UI with:
 *   - AsyncStorage-backed story selection persistence
 *   - Websocket sync disabled by default (enable via env var for remote control)
 *   - story.requires loaded first so all stories + addons are registered before
 *     the UI mounts
 *
 * Usage:
 *   EXPO_PUBLIC_STORYBOOK=1 expo start          # toggle in index.js
 *
 * IMPORTANT: `storage` must be passed as `{ getItem, setItem }` — NOT as the
 * raw AsyncStorage object.  When storage is provided, `_getInitialStory()`
 * performs an AsyncStorage bridge call (macrotask) before resolving, which
 * gives `preview.initialize()` enough time to populate `storyStore.storyIndex`.
 * Without it the Promise resolves synchronously, races with initialization,
 * and throws "Cannot call selectSpecifiedStory before initialization".
 */

import { getStorybookUI } from '@storybook/react-native/V6';
import './storybook.requires';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const AsyncStorage = require('@react-native-async-storage/async-storage').default;

const StorybookUIRoot = getStorybookUI({
  /**
   * Pass storage as { getItem, setItem } — the V6 API does NOT accept
   * a raw AsyncStorage instance; it expects this explicit shape.
   */
  storage: {
    getItem: AsyncStorage.getItem.bind(AsyncStorage),
    setItem: AsyncStorage.setItem.bind(AsyncStorage),
  },
  shouldPersistSelection: true,
});

export default StorybookUIRoot;
