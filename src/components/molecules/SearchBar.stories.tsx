import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { SearchBar } from './SearchBar';
import { theme } from '../../core/theme';

export default {
  title: 'Molecules/SearchBar',
  component: SearchBar,
  decorators: [
    (Story: () => React.ReactElement) => (
      <ScrollView contentContainerStyle={styles.decorator}>
        <Story />
      </ScrollView>
    ),
  ],
  argTypes: {
    variant:   { control: { type: 'select' }, options: ['default', 'filled', 'outlined'] },
    loading:   { control: 'boolean' },
    editable:  { control: 'boolean' },
    autoFocus: { control: 'boolean' },
    placeholder: { control: 'text' },
  },
};

const Controlled = (args: Omit<React.ComponentProps<typeof SearchBar>, 'value' | 'onChangeText'>) => {
  const [value, setValue] = useState('');
  return (
    <SearchBar
      {...args}
      value={value}
      onChangeText={setValue}
      onClear={() => setValue('')}
    />
  );
};

export const Playground = () => <Controlled variant="default" />;

export const Default  = () => <Controlled variant="default"  placeholder="Search…" />;
export const Filled   = () => <Controlled variant="filled"   placeholder="Search…" />;
export const Outlined = () => <Controlled variant="outlined" placeholder="Search…" />;

export const WithValue = () => {
  const [value, setValue] = useState('React Native');
  return (
    <SearchBar value={value} onChangeText={setValue} onClear={() => setValue('')} />
  );
};

export const Loading  = () => <SearchBar value="" onChangeText={() => {}} loading />;
export const Disabled = () => <SearchBar value="Read only" onChangeText={() => {}} editable={false} />;

export const AllVariants = () => (
  <View style={styles.column}>
    {(['default', 'filled', 'outlined'] as const).map(v => (
      <Controlled key={v} variant={v} placeholder={v} />
    ))}
  </View>
);

const styles = StyleSheet.create({
  decorator: { padding: theme.spacing.md, backgroundColor: '#fff', flexGrow: 1 },
  column: { gap: theme.spacing.md },
});
