import React from 'react';
import { View, Text as RNText, StyleSheet } from 'react-native';
import { ComponentProps } from '@/types';
import { theme } from '../../core/theme';

export interface DividerProps extends ComponentProps {
  orientation?: 'horizontal' | 'vertical';
  thickness?: number;
  color?: string;
  spacing?: 'none' | 'sm' | 'md' | 'lg';
  label?: string;
  labelPosition?: 'left' | 'center' | 'right';
}

const SPACING_MAP = {
  none: 0,
  sm: theme.spacing.sm,
  md: theme.spacing.md,
  lg: theme.spacing.lg,
};

export const Divider: React.FC<DividerProps> = ({
  orientation = 'horizontal',
  thickness = 1,
  color = theme.colors.gray[200],
  spacing = 'none',
  label,
  labelPosition = 'center',
  style,
}) => {
  const spacingValue = SPACING_MAP[spacing];

  if (orientation === 'vertical') {
    return (
      <View
        style={[
          {
            width: thickness,
            backgroundColor: color,
            marginHorizontal: spacingValue,
            alignSelf: 'stretch',
          },
          style,
        ]}
      />
    );
  }

  if (label) {
    const showLeftLine  = labelPosition !== 'left';
    const showRightLine = labelPosition !== 'right';

    return (
      <View style={[styles.labelRow, { marginVertical: spacingValue }, style]}>
        {showLeftLine && (
          <View style={[styles.line, { height: thickness, backgroundColor: color }]} />
        )}
        <RNText
          style={[
            styles.labelText,
            labelPosition === 'left'   && { marginRight: theme.spacing.sm },
            labelPosition === 'right'  && { marginLeft: theme.spacing.sm },
            labelPosition === 'center' && { marginHorizontal: theme.spacing.sm },
          ]}
        >
          {label}
        </RNText>
        {showRightLine && (
          <View style={[styles.line, { height: thickness, backgroundColor: color }]} />
        )}
      </View>
    );
  }

  return (
    <View
      style={[
        {
          height: thickness,
          backgroundColor: color,
          marginVertical: spacingValue,
          alignSelf: 'stretch',
        },
        style,
      ]}
    />
  );
};

const styles = StyleSheet.create({
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  line: {
    flex: 1,
  },
  labelText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.gray[500],
    fontWeight: theme.typography.weights.medium,
  },
});
