import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import { Text } from '../atoms/Text';
import { useAppTheme } from '../../core/theme';
import { ComponentProps } from '@/types';

export interface StatusTimelineStep {
  /** Step title, e.g. "Confirmed" or "1. Upload ID". */
  label: string;
  /** Optional supporting line under the label. */
  description?: string;
  /** Optional element rendered on the right (e.g. a "Start" button). */
  trailing?: React.ReactNode;
}

export interface StatusTimelineProps extends ComponentProps {
  /** Ordered steps, top to bottom. */
  steps: StatusTimelineStep[];
  /**
   * Index of the active step. Steps before it render as completed (green check),
   * the active step is highlighted, later steps are muted. Use `-1` for none active.
   */
  currentIndex: number;
  /**
   * Optional override for a step's accent color, keyed by state. Lets callers
   * feed status-color maps (e.g. `orderStatusColor`/`verificationStatusColor`).
   * Returning `undefined` falls back to the default done/active/pending colors.
   */
  getStepColor?: (index: number, state: StatusTimelineState) => string | undefined;
}

export type StatusTimelineState = 'done' | 'active' | 'pending';

function resolveState(index: number, currentIndex: number): StatusTimelineState {
  if (index < currentIndex) return 'done';
  if (index === currentIndex) return 'active';
  return 'pending';
}

/**
 * Vertical dot-and-line progress timeline. Consolidates the duplicated
 * timeline blocks in the customer order-detail status tracker and the profile
 * identity-verification stepper. Presentational only: pass resolved steps and
 * the active index; optionally override per-step color via `getStepColor`.
 */
export const StatusTimeline: React.FC<StatusTimelineProps> = ({
  steps,
  currentIndex,
  getStepColor,
  style,
}) => {
  const theme = useAppTheme();

  const doneColor = theme.colors.accent[500];
  const activeColor = theme.colors.highlight[400];
  const pendingColor = theme.colors.gray[300];
  const lineColor = theme.colors.border;

  return (
    <View style={style}>
      {steps.map((step, index) => {
        const state = resolveState(index, currentIndex);
        const isLast = index === steps.length - 1;

        const defaultColor =
          state === 'done' ? doneColor : state === 'active' ? activeColor : pendingColor;
        const accent = getStepColor?.(index, state) ?? defaultColor;

        const labelColor = state === 'pending' ? theme.colors.textSecondary : theme.colors.text;

        return (
          <View key={`${step.label}-${index}`} style={styles.row}>
            {/* Rail: dot + connecting line */}
            <View style={styles.rail}>
              <View style={[styles.dot, { backgroundColor: accent }]}>
                {state === 'done' && <Check size={12} color={theme.colors.white} strokeWidth={3} />}
              </View>
              {!isLast && (
                <View
                  style={[
                    styles.line,
                    { backgroundColor: state === 'done' ? doneColor : lineColor },
                  ]}
                />
              )}
            </View>

            {/* Content */}
            <View style={[styles.content, isLast && styles.contentLast]}>
              <View style={styles.textWrap}>
                <Text
                  variant="body-sm"
                  weight={state === 'active' ? 'bold' : 'medium'}
                  style={{ color: labelColor }}
                >
                  {step.label}
                </Text>
                {step.description !== undefined && (
                  <Text variant="body-xs" color="textSecondary" style={styles.description}>
                    {step.description}
                  </Text>
                )}
              </View>
              {step.trailing !== undefined && <View style={styles.trailing}>{step.trailing}</View>}
            </View>
          </View>
        );
      })}
    </View>
  );
};

const DOT = 22;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  rail: {
    alignItems: 'center',
    width: DOT,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: {
    width: 2,
    flex: 1,
    minHeight: 14,
    marginVertical: 2,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
    paddingBottom: 16,
  },
  contentLast: {
    paddingBottom: 0,
  },
  textWrap: {
    flex: 1,
  },
  description: {
    marginTop: 2,
  },
  trailing: {
    marginLeft: 8,
  },
});
