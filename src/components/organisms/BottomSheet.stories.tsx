import React, { useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { Trash2, Share2, Edit3, Download } from 'lucide-react-native';
import { BottomSheet, type BottomSheetHandle, type SnapPoint } from './BottomSheet';
import { Button } from '../atoms/Button';
import { ListItem } from '../molecules/ListItem';
import { Text } from '../atoms/Text';
import { theme } from '../../core/theme';

export default {
  title: 'Organisms/BottomSheet',
  component: BottomSheet,
  decorators: [
    (Story: () => React.ReactElement) => (
      <View style={styles.decorator}>
        <Story />
      </View>
    ),
  ],
};

// ─── Helper: each story renders a trigger button + the sheet ─────────────────

const SheetDemo = (
  props: Omit<React.ComponentProps<typeof BottomSheet>, 'children'> & {
    triggerLabel?: string;
    body?: React.ReactNode;
  },
) => {
  const { triggerLabel = 'Open Sheet', body, ...rest } = props;
  const sheetRef = useRef<BottomSheetHandle>(null);
  return (
    <View>
      <Button
        title={triggerLabel}
        onPress={() => sheetRef.current?.present()}
        fullWidth
        variant="outline"
      />
      <BottomSheet ref={sheetRef} {...rest}>
        {body ?? (
          <Text variant="body" color="gray">
            Bottom sheet content goes here.
          </Text>
        )}
      </BottomSheet>
    </View>
  );
};

// ─── Stories ──────────────────────────────────────────────────────────────────

export const Default = () => (
  <SheetDemo triggerLabel="Open Bottom Sheet (50%)" />
);

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

export const WithCloseButton = () => (
  <SheetDemo title="Settings" showCloseButton triggerLabel="With Close Button" />
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
          <Text key={i} variant="body" style={styles.lorem}>
            Section {i + 1}: Lorem ipsum dolor sit amet, consectetur
            adipiscing elit. Sed do eiusmod tempor incididunt ut labore et
            dolore magna aliqua.
          </Text>
        ))}
      </View>
    }
  />
);

export const ActionsSheet = () => {
  const sheetRef = useRef<BottomSheetHandle>(null);
  return (
    <View>
      <Button
        title="Open Actions Sheet"
        onPress={() => sheetRef.current?.present()}
        fullWidth
        variant="outline"
      />
      <BottomSheet
        ref={sheetRef}
        title="File Options"
        defaultSnapPoint="50%"
      >
        <View style={styles.actionsList}>
          <ListItem
            title="Edit"
            leftIcon={<Edit3 size={20} color={theme.colors.primary[500]} />}
            onPress={() => sheetRef.current?.dismiss()}
            divider
          />
          <ListItem
            title="Share"
            leftIcon={<Share2 size={20} color={theme.colors.primary[500]} />}
            onPress={() => sheetRef.current?.dismiss()}
            divider
          />
          <ListItem
            title="Download"
            leftIcon={<Download size={20} color={theme.colors.primary[500]} />}
            onPress={() => sheetRef.current?.dismiss()}
            divider
          />
          <ListItem
            title="Delete"
            leftIcon={<Trash2 size={20} color={theme.colors.error[500]} />}
            destructive
            onPress={() => sheetRef.current?.dismiss()}
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
      {snapPoints.map((sp) => (
        <SheetDemo key={sp} defaultSnapPoint={sp} triggerLabel={`Open at ${sp}`} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  decorator: {
    padding: theme.spacing.md,
    backgroundColor: '#fff',
    flex: 1,
  },
  column: { gap: theme.spacing.md },
  lorem: {
    color: theme.colors.gray[600],
    marginBottom: theme.spacing.md,
    lineHeight: 22,
  },
  actionsList: { paddingBottom: theme.spacing.md },
});
