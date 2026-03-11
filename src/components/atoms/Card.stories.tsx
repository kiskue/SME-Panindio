import React from 'react';
import { ScrollView, View, StyleSheet, Alert } from 'react-native';
import { Card } from './Card';
import { Text } from './Text';
import { theme } from '../../core/theme';

export default {
  title: 'Atoms/Card',
  component: Card,
  decorators: [
    (Story: () => React.ReactElement) => (
      <ScrollView contentContainerStyle={styles.decorator}>
        <Story />
      </ScrollView>
    ),
  ],
  argTypes: {
    variant:      { control: { type: 'select' }, options: ['default', 'elevated', 'outlined', 'filled'] },
    padding:      { control: { type: 'select' }, options: ['none', 'sm', 'md', 'lg', 'xl'] },
    borderRadius: { control: { type: 'select' }, options: ['none', 'sm', 'md', 'lg', 'xl', 'full'] },
    shadow:       { control: { type: 'select' }, options: ['none', 'sm', 'md', 'lg', 'xl'] },
    onPress:      { action: 'card-pressed' },
  },
};

const CardBody = ({ label }: { label: string }) => (
  <>
    <Text variant="h6" weight="semibold" style={styles.cardTitle}>{label}</Text>
    <Text variant="body-sm" color="gray">
      Cards group related information and actions into a single visual unit.
    </Text>
  </>
);

type CardArgs = Omit<React.ComponentProps<typeof Card>, 'children'>;
const Template = (args: CardArgs) => (
  <Card {...args}>
    <CardBody label={(args.variant ?? 'Card')} />
  </Card>
);

// ─── Playground ───────────────────────────────────────────────────────────────
export const Playground = Template.bind({});
(Playground as any).args = {
  variant: 'default',
  padding: 'md',
  borderRadius: 'md',
  shadow: 'sm',
};

// ─── Variants ────────────────────────────────────────────────────────────────
export const Default = Template.bind({});
(Default as any).args = { variant: 'default', shadow: 'sm' };

export const Elevated = Template.bind({});
(Elevated as any).args = { variant: 'elevated', shadow: 'lg' };

export const Outlined = Template.bind({});
(Outlined as any).args = { variant: 'outlined', shadow: 'none' };

export const Filled = Template.bind({});
(Filled as any).args = { variant: 'filled', shadow: 'none' };

// ─── Padding scale ───────────────────────────────────────────────────────────
export const PaddingNone = Template.bind({});
(PaddingNone as any).args = { padding: 'none', variant: 'outlined' };

export const PaddingSm = Template.bind({});
(PaddingSm as any).args = { padding: 'sm', variant: 'outlined' };

export const PaddingLg = Template.bind({});
(PaddingLg as any).args = { padding: 'lg', variant: 'outlined' };

export const PaddingXl = Template.bind({});
(PaddingXl as any).args = { padding: 'xl', variant: 'outlined' };

// ─── Border radius ───────────────────────────────────────────────────────────
export const RadiusNone = Template.bind({});
(RadiusNone as any).args = { borderRadius: 'none', variant: 'outlined' };

export const RadiusLg = Template.bind({});
(RadiusLg as any).args = { borderRadius: 'lg', variant: 'outlined' };

export const RadiusXl = Template.bind({});
(RadiusXl as any).args = { borderRadius: 'xl', variant: 'elevated', shadow: 'md' };

// ─── Shadow scale ────────────────────────────────────────────────────────────
export const ShadowNone = Template.bind({});
(ShadowNone as any).args = { shadow: 'none', variant: 'outlined' };

export const ShadowMd = Template.bind({});
(ShadowMd as any).args = { shadow: 'md' };

export const ShadowXl = Template.bind({});
(ShadowXl as any).args = { shadow: 'xl' };

// ─── Pressable ───────────────────────────────────────────────────────────────
export const Pressable = () => (
  <Card
    variant="elevated"
    padding="lg"
    shadow="md"
    borderRadius="lg"
    onPress={() => Alert.alert('Card pressed!')}
  >
    <Text variant="h6" weight="semibold" style={styles.cardTitle}>Tap me</Text>
    <Text variant="body-sm" color="gray">This card responds to press events. It dims on press.</Text>
  </Card>
);

// ─── Composites ──────────────────────────────────────────────────────────────
export const AllVariants = () => (
  <View style={styles.column}>
    {(['default', 'elevated', 'outlined', 'filled'] as const).map(v => (
      <View key={v}>
        <Text variant="caption" color="gray" style={styles.sectionLabel}>{v}</Text>
        <Card variant={v} shadow={v === 'elevated' ? 'md' : 'none'} padding="md">
          <CardBody label={v.charAt(0).toUpperCase() + v.slice(1)} />
        </Card>
      </View>
    ))}
  </View>
);

export const ShadowScale = () => (
  <View style={styles.column}>
    {(['none', 'sm', 'md', 'lg', 'xl'] as const).map(s => (
      <View key={s}>
        <Text variant="caption" color="gray" style={styles.sectionLabel}>shadow="{s}"</Text>
        <Card shadow={s} padding="md" borderRadius="md">
          <CardBody label={`Shadow ${s}`} />
        </Card>
      </View>
    ))}
  </View>
);

export const PaddingScale = () => (
  <View style={styles.column}>
    {(['none', 'sm', 'md', 'lg', 'xl'] as const).map(p => (
      <View key={p}>
        <Text variant="caption" color="gray" style={styles.sectionLabel}>padding="{p}"</Text>
        <Card variant="outlined" padding={p}>
          <Text variant="body-sm" color="gray">Content inside card</Text>
        </Card>
      </View>
    ))}
  </View>
);

const styles = StyleSheet.create({
  decorator:    { padding: theme.spacing.md, backgroundColor: '#f5f5f5', flexGrow: 1 },
  column:       { gap: theme.spacing.lg },
  cardTitle:    { marginBottom: theme.spacing.xs },
  sectionLabel: { marginBottom: theme.spacing.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
});
