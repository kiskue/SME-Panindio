import { doUpdate } from '@storybook/react-native';

const getStories = () => {
  return [
    require('../src/components/atoms/Button/Button.stories.tsx'),
    require('../src/components/atoms/Input/Input.stories.tsx'),
    require('../src/components/atoms/Text/Text.stories.tsx'),
    require('../src/components/atoms/Card/Card.stories.tsx'),
    require('../src/components/molecules/FormField/FormField.stories.tsx'),
    require('../src/components/molecules/LoadingSpinner/LoadingSpinner.stories.tsx'),
    require('../src/components/molecules/ErrorMessage/ErrorMessage.stories.tsx'),
    require('../src/components/organisms/LoginForm/LoginForm.stories.tsx'),
    require('../src/components/organisms/NotificationItem/NotificationItem.stories.tsx'),
  ];
};

doUpdate({
  stories: getStories(),
});

export const decorators = [];
export const parameters = {
  actions: { argTypesRegex: '^on[A-Z].*' },
  controls: {
    matchers: {
      color: /(background|color)$/i,
      date: /Date$/,
    },
  },
};