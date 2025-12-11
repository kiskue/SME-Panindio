import { getStorybookUI } from '@storybook/react-native';
import './storybook.requires';

const StorybookUIRoot = getStorybookUI({
  enableWebsockets: true,
  onDeviceUI: true,
  shouldPersistSelection: true,
  theme: {
    backgroundColor: '#ffffff',
    headerTextColor: '#333333',
    labelColor: '#666666',
    borderColor: '#e0e0e0',
    previewBorderColor: '#e0e0e0',
    buttonTextColor: '#333333',
    buttonActiveTextColor: '#ffffff',
    buttonBackgroundColor: '#f0f0f0',
    buttonActiveBackgroundColor: '#007AFF',
  },
});

export default StorybookUIRoot;