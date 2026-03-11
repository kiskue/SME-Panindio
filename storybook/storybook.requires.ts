/**
 * Storybook Story Registry
 *
 * This file is the single source of truth for:
 *   1. Addon panel registration
 *   2. Global decorator / parameter injection
 *   3. Story module enumeration
 *
 * When stories are added or removed, update the `configure` block below.
 * Everything else (providers, parameters) lives in `./preview`.
 */

// ─── @storybook/react-native v7 — configure/addDecorator/addParameters live in
// the /V6 compat layer (not the main package export). ─────────────────────────
import { configure, addDecorator, addParameters } from '@storybook/react-native/V6';

// ─── Addon Panels ─────────────────────────────────────────────────────────────
import '@storybook/addon-ondevice-actions/register';
import '@storybook/addon-ondevice-backgrounds/register';
import '@storybook/addon-ondevice-controls/register';

// ─── Global Decorators & Parameters ──────────────────────────────────────────
// Imported from preview.tsx so the global setup is defined once and reused
// here (on-device) and in any future web Storybook configuration.
import { decorators, parameters } from './preview';

decorators.forEach(addDecorator);
addParameters(parameters);

// ─── Story Registry ──────────────────────────────────────────────────────────
// In @storybook/react-native v7, executeLoadable() checks `typeof exported === "object"`.
// The loadable MUST return a { [filePath]: module } map — returning nothing keeps the
// story index empty and throws "Couldn't find any stories".
configure(
  () => ({
    // ── Atoms ────────────────────────────────────────────────────────────
    '../src/components/atoms/Button/Button.stories':
      require('../src/components/atoms/Button/Button.stories'),
    '../src/components/atoms/Text.stories':
      require('../src/components/atoms/Text.stories'),
    '../src/components/atoms/Input.stories':
      require('../src/components/atoms/Input.stories'),
    '../src/components/atoms/Card.stories':
      require('../src/components/atoms/Card.stories'),
    '../src/components/atoms/IconButton.stories':
      require('../src/components/atoms/IconButton.stories'),
    '../src/components/atoms/Badge.stories':
      require('../src/components/atoms/Badge.stories'),
    '../src/components/atoms/Avatar.stories':
      require('../src/components/atoms/Avatar.stories'),
    '../src/components/atoms/Divider.stories':
      require('../src/components/atoms/Divider.stories'),
    '../src/components/atoms/Checkbox.stories':
      require('../src/components/atoms/Checkbox.stories'),
    '../src/components/atoms/Radio.stories':
      require('../src/components/atoms/Radio.stories'),
    '../src/components/atoms/Switch.stories':
      require('../src/components/atoms/Switch.stories'),
    '../src/components/atoms/Chip.stories':
      require('../src/components/atoms/Chip.stories'),
    '../src/components/atoms/Tag.stories':
      require('../src/components/atoms/Tag.stories'),

    // ── Molecules ────────────────────────────────────────────────────────
    '../src/components/molecules/FormField.stories':
      require('../src/components/molecules/FormField.stories'),
    '../src/components/molecules/LoadingSpinner.stories':
      require('../src/components/molecules/LoadingSpinner.stories'),
    '../src/components/molecules/ErrorMessage.stories':
      require('../src/components/molecules/ErrorMessage.stories'),
    '../src/components/molecules/SearchBar.stories':
      require('../src/components/molecules/SearchBar.stories'),
    '../src/components/molecules/ListItem.stories':
      require('../src/components/molecules/ListItem.stories'),
    '../src/components/molecules/Toast.stories':
      require('../src/components/molecules/Toast.stories'),
    '../src/components/molecules/Alert.stories':
      require('../src/components/molecules/Alert.stories'),
    '../src/components/molecules/EmptyState.stories':
      require('../src/components/molecules/EmptyState.stories'),
    '../src/components/molecules/LoaderOverlay.stories':
      require('../src/components/molecules/LoaderOverlay.stories'),

    // ── Organisms ────────────────────────────────────────────────────────
    '../src/components/organisms/LoginForm.stories':
      require('../src/components/organisms/LoginForm.stories'),
    '../src/components/organisms/NotificationItem.stories':
      require('../src/components/organisms/NotificationItem.stories'),
    '../src/components/organisms/Modal.stories':
      require('../src/components/organisms/Modal.stories'),
    '../src/components/organisms/BottomSheet.stories':
      require('../src/components/organisms/BottomSheet.stories'),
    '../src/components/organisms/Tabs.stories':
      require('../src/components/organisms/Tabs.stories'),
    '../src/components/organisms/Drawer.stories':
      require('../src/components/organisms/Drawer.stories'),
  }),
  module,
);
