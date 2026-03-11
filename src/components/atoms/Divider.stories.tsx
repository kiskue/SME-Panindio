import React from 'react';
import { View, Text as RNText, StyleSheet, ScrollView } from 'react-native';
import { Divider } from './Divider';
import { theme } from '../../core/theme';

export default {
  title: 'Atoms/Divider',
  component: Divider,
  decorators: [
    (Story: () => React.ReactElement) => (
      <ScrollView contentContainerStyle={styles.decorator}>
        <Story />
      </ScrollView>
    ),
  ],
  argTypes: {
    orientation:   { control: { type: 'select' }, options: ['horizontal', 'vertical'] },
    spacing:       { control: { type: 'select' }, options: ['none', 'sm', 'md', 'lg'] },
    labelPosition: { control: { type: 'select' }, options: ['left', 'center', 'right'] },
    thickness:     { control: 'number' },
    label:         { control: 'text' },
  },
};

const Template = (args: React.ComponentProps<typeof Divider>) => <Divider {...args} />;

export const Playground = Template.bind({});
(Playground as any).args = { orientation: 'horizontal', spacing: 'none' };

export const Horizontal = Template.bind({});
(Horizontal as any).args = { orientation: 'horizontal' };

export const Vertical = () => (
  <View style={styles.verticalContainer}>
    <RNText style={styles.text}>Left</RNText>
    <Divider orientation="vertical" />
    <RNText style={styles.text}>Right</RNText>
  </View>
);

export const WithLabel = Template.bind({});
(WithLabel as any).args = { label: 'OR', labelPosition: 'center' };

export const LabelLeft = Template.bind({});
(LabelLeft as any).args = { label: 'Section A', labelPosition: 'left' };

export const LabelCenter = Template.bind({});
(LabelCenter as any).args = { label: 'Continue with', labelPosition: 'center' };

export const LabelRight = Template.bind({});
(LabelRight as any).args = { label: 'End', labelPosition: 'right' };

export const ThickDivider = Template.bind({});
(ThickDivider as any).args = { thickness: 3 };

export const ColoredDivider = Template.bind({});
(ColoredDivider as any).args = { color: theme.colors.primary[300] };

export const SpacingNone = Template.bind({});
(SpacingNone as any).args = { spacing: 'none' };

export const SpacingSm = Template.bind({});
(SpacingSm as any).args = { spacing: 'sm' };

export const SpacingMd = Template.bind({});
(SpacingMd as any).args = { spacing: 'md' };

export const SpacingLg = Template.bind({});
(SpacingLg as any).args = { spacing: 'lg' };

export const InContext = () => (
  <View>
    <RNText style={styles.sectionText}>Profile</RNText>
    <Divider spacing="sm" />
    <RNText style={styles.text}>Name: John Doe</RNText>
    <Divider spacing="sm" />
    <RNText style={styles.text}>Email: john@example.com</RNText>
    <Divider label="OR" labelPosition="center" spacing="md" />
    <RNText style={styles.text}>Sign in with Google</RNText>
  </View>
);

const styles = StyleSheet.create({
  decorator: { padding: theme.spacing.md, backgroundColor: '#fff', flexGrow: 1 },
  verticalContainer: { flexDirection: 'row', alignItems: 'center', height: 40, gap: theme.spacing.md },
  text: { fontSize: theme.typography.sizes.base, color: theme.colors.text },
  sectionText: { fontSize: theme.typography.sizes.lg, fontWeight: '600', color: theme.colors.text, marginBottom: theme.spacing.sm },
});
