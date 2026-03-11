/**
 * Storybook / App toggle entry point.
 *
 * Run with:  EXPO_PUBLIC_STORYBOOK=1 expo start
 * Run app:   expo start
 */
const isStorybookEnabled = process.env.EXPO_PUBLIC_STORYBOOK === '1';

if (isStorybookEnabled) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const StorybookUIRoot = require('./storybook').default;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { registerRootComponent } = require('expo');
  registerRootComponent(StorybookUIRoot);
} else {
  require('expo-router/entry');
}
