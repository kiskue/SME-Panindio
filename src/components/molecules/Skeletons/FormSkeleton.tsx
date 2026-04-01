/**
 * FormSkeleton — skeleton for full-screen form screens (add / edit).
 *
 * Renders a series of labelled-input blocks matching the rough layout of
 * the Add Inventory / Add Raw Material forms. A `sections` prop controls
 * how many section groups are shown.
 */

import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { SkeletonBox } from '@/components/atoms/SkeletonBox';
import { useThemeStore, selectThemeMode } from '@/store';
import { theme as staticTheme } from '@/core/theme';

export interface FormSkeletonProps {
  /** Number of input groups to render. Default 3. */
  sections?: number;
  /** Number of inputs per section. Default 2. */
  inputsPerSection?: number;
}

const InputRow: React.FC<{ isDark: boolean; fullWidth?: boolean }> = ({ isDark, fullWidth }) => {
  const bg     = isDark ? '#1E2435' : '#F8F9FC';
  const border = isDark ? 'rgba(255,255,255,0.12)' : '#E2E8F0';

  return (
    <View style={[inputStyles.wrapper, fullWidth && inputStyles.fullWidth]}>
      {/* Label */}
      <SkeletonBox width="30%" height={11} borderRadius={5} />
      {/* Input box */}
      <View style={[inputStyles.input, { backgroundColor: bg, borderColor: border }]}>
        <SkeletonBox width="55%" height={14} borderRadius={5} />
      </View>
    </View>
  );
};

const SectionBlock: React.FC<{ isDark: boolean; inputCount: number }> = ({ isDark, inputCount }) => {
  const sectionBg     = isDark ? '#1A2235' : '#FFFFFF';
  const sectionBorder = isDark ? 'rgba(255,255,255,0.07)' : staticTheme.colors.gray[100];

  return (
    <View style={[sectionStyles.card, { backgroundColor: sectionBg, borderColor: sectionBorder }]}>
      {/* Section header */}
      <View style={sectionStyles.header}>
        <SkeletonBox width={28} height={28} borderRadius={8} />
        <SkeletonBox width="40%" height={14} borderRadius={6} />
      </View>
      {/* Input rows */}
      <View style={sectionStyles.inputs}>
        {Array.from({ length: inputCount }).map((_, i) => (
          <InputRow key={i} isDark={isDark} />
        ))}
      </View>
    </View>
  );
};

export const FormSkeleton: React.FC<FormSkeletonProps> = ({
  sections         = 3,
  inputsPerSection = 2,
}) => {
  const mode   = useThemeStore(selectThemeMode);
  const isDark = mode === 'dark';

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      scrollEnabled={false}
      showsVerticalScrollIndicator={false}
    >
      {Array.from({ length: sections }).map((_, i) => (
        <SectionBlock key={i} isDark={isDark} inputCount={inputsPerSection} />
      ))}
      {/* Submit button skeleton */}
      <SkeletonBox width="100%" height={48} borderRadius={staticTheme.borderRadius.lg} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  root:    { flex: 1 },
  content: {
    paddingHorizontal: staticTheme.spacing.md,
    paddingTop:        staticTheme.spacing.md,
    gap:               staticTheme.spacing.md,
    paddingBottom:     staticTheme.spacing.xl,
  },
});

const sectionStyles = StyleSheet.create({
  card: {
    borderRadius: staticTheme.borderRadius.xl,
    borderWidth:  1,
    padding:      staticTheme.spacing.md,
    gap:          staticTheme.spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           staticTheme.spacing.sm,
  },
  inputs: {
    gap: staticTheme.spacing.md,
  },
});

const inputStyles = StyleSheet.create({
  wrapper: {
    gap: 6,
  },
  fullWidth: {
    width: '100%',
  },
  input: {
    height:        48,
    borderRadius:  staticTheme.borderRadius.md,
    borderWidth:   1,
    paddingHorizontal: staticTheme.spacing.md,
    justifyContent: 'center',
  },
});
