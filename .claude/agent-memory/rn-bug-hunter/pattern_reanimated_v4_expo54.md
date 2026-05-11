---
name: Reanimated 4.x + Expo SDK 54 — Version Lock and Babel Plugin
description: Expo SDK 54 bundles native reanimated 4.1.x; running JS v3 against it causes NativeProxy.initHybrid NPE on Android with New Architecture.
type: project
---

Expo SDK 54 (`bundledNativeModules.json`) specifies `react-native-reanimated: ~4.1.1`. The Android native layer (`ReanimatedPackage`, `NodesManager`, `NativeProxy`) is compiled against v4's C++ JSI interface. Running the JS/JS-interop layer from v3 against v4 native causes a hard crash on Android:

```
NullPointerException at com.swmansion.reanimated.NativeProxy.initHybrid
```

**Fix applied (three parts):**

1. `package.json` — bump `react-native-reanimated` from `^3.19.5` to `4.1.7` (exact, matching Expo SDK 54's bundled version).
2. `package.json` `"main"` field — must be `"expo-router/entry"`, not `"index.js"`.
3. `babel.config.js` — reanimated 4.x delegates worklet babel transforms to `react-native-worklets`. Replace `'react-native-reanimated/plugin'` with `'react-native-worklets/plugin'`. Both resolve to the same `WorkletsBabelPlugin` function (v4 re-exports worklets/plugin through its own /plugin path), but the worklets reference is the canonical one. Plugin must remain the LAST entry.

**How to apply:** Any time `react-native-reanimated` version is pinned in this project, verify it matches `expo/bundledNativeModules.json`'s entry. A `^` range anchored below 4.x will resolve to 3.x and crash on first Android build with New Architecture enabled. `react-native-worklets: 0.5.1` is the correct companion (also in bundledNativeModules).
