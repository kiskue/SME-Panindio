import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Text as RNText } from 'react-native';
import { Trash2, Share2, Edit3, Download } from 'lucide-react-native';
import { BottomSheet, SnapPoint } from './BottomSheet';
import { Button } from '../atoms/Button';
import { ListItem } from '../molecules/ListItem';
import { Text } from '../atoms/Text';
import { theme } from '../../core/theme';

export default {
  title: 'Organisms/BottomSheet',
  component: BottomSheet,
  decorators: [
    (Story: () => React.ReactElement) => (
      <ScrollView contentContainerStyle={styles.decorator}>
        <Story />
      </ScrollView>
    ),
  ],
};

const SheetDemo = (
  props: Omit<React.ComponentProps<typeof BottomSheet>, 'visible' | 'onClose' | 'children'> & {
    triggerLabel?: string;
    body?: React.ReactNode;
  },
) => {
  const [visible, setVisible] = useState(false);
  const { triggerLabel = 'Open Sheet', body, ...rest } = props;
  return (
    <View>
      <Button title={triggerLabel} onPress={() => setVisible(true)} fullWidth variant="outline" />
      <BottomSheet visible={visible} onClose={() => setVisible(false)} {...rest}>
        {body ?? (
          <Text variant="body" color="gray">
            Bottom sheet content goes here.
          </Text>
        )}
      </BottomSheet>
    </View>
  );
};

export const Default = () => <SheetDemo triggerLabel="Open Bottom Sheet (50%)" />;

export const ShortSheet = () => (
  <SheetDemo defaultSnapPoint="25%" triggerLabel="Short Sheet (25%)" />
);

export const TallSheet = () => (
  <SheetDemo defaultSnapPoint="75%" triggerLabel="Tall Sheet (75%)" />
);

export const FullSheet = () => (
  <SheetDemo defaultSnapPoint="90%" triggerLabel="Full Sheet (90%)" />
);

export const WithTitle = () => (
  <SheetDemo title="Options" triggerLabel="With Title" />
);

export const WithHandle = () => (
  <SheetDemo showHandle triggerLabel="With Handle" />
);

export const WithScrollableContent = () => (
  <SheetDemo
    title="Terms & Conditions"
    triggerLabel="Scrollable Content"
    scrollable
    defaultSnapPoint="75%"
    body={
      <View>
        {Array.from({ length: 8 }, (_, i) => (
          <RNText key={i} style={styles.lorem}>
            Section {i + 1}: Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
          </RNText>
        ))}
      </View>
    }
  />
);

export const ActionsSheet = () => {
  const [visible, setVisible] = useState(false);
  return (
    <View>
      <Button title="Open Actions Sheet" onPress={() => setVisible(true)} fullWidth variant="outline" />
      <BottomSheet
        visible={visible}
        onClose={() => setVisible(false)}
        title="File Options"
        defaultSnapPoint="50%"
      >
        <View style={styles.actionsList}>
          <ListItem
            title="Edit"
            leftIcon={<Edit3 size={20} color={theme.colors.primary[500]} />}
            onPress={() => setVisible(false)}
            divider
          />
          <ListItem
            title="Share"
            leftIcon={<Share2 size={20} color={theme.colors.primary[500]} />}
            onPress={() => setVisible(false)}
            divider
          />
          <ListItem
            title="Download"
            leftIcon={<Download size={20} color={theme.colors.primary[500]} />}
            onPress={() => setVisible(false)}
            divider
          />
          <ListItem
            title="Delete"
            leftIcon={<Trash2 size={20} color={theme.colors.error[500]} />}
            destructive
            onPress={() => setVisible(false)}
          />
        </View>
      </BottomSheet>
    </View>
  );
};

export const AllSnapPoints = () => {
  const snapPoints: SnapPoint[] = ['25%', '50%', '75%', '90%'];
  return (
    <View style={styles.column}>
      {snapPoints.map(sp => (
        <SheetDemo key={sp} defaultSnapPoint={sp} triggerLabel={`Open at ${sp}`} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  decorator: { padding: theme.spacing.md, backgroundColor: '#fff', flexGrow: 1 },
  column: { gap: theme.spacing.md },
  lorem: {
    fontSize: 14,
    color: theme.colors.gray[600],
    marginBottom: theme.spacing.md,
    lineHeight: 22,
  },
  actionsList: { paddingBottom: theme.spacing.md },
});
