/**
 * Storybook Main Configuration
 *
 * Used by:
 *   - `sb-rn-get-stories` CLI to auto-discover and generate storybook.requires
 *   - Web Storybook server (optional, for CI/web review workflows)
 *
 * Story glob convention:
 *   <component>.stories.tsx  — co-located with the component it documents
 *
 * @type {import('@storybook/react-native').StorybookConfig}
 */
const config = {
  // ─── Story Discovery ────────────────────────────────────────────────────────
  stories: ['../src/**/*.stories.?(ts|tsx)'],

  // ─── Addons ─────────────────────────────────────────────────────────────────
  addons: [
    '@storybook/addon-ondevice-controls',
    '@storybook/addon-ondevice-actions',
    '@storybook/addon-ondevice-backgrounds',
  ],

  // ─── Framework ──────────────────────────────────────────────────────────────
  framework: {
    name: '@storybook/react-native',
    options: {},
  },

  // ─── TypeScript ─────────────────────────────────────────────────────────────
  // Stories are written in TypeScript; no additional ts config needed here
  // because Metro + babel-preset-expo handle transpilation.
};

module.exports = config;
