/**
 * BrandLogo — SVG representation of the SME Panindio logo mark.
 *
 * Palette reference:
 *   Navy awning frame : #1E4D8C
 *   Amber awning stripe: #F5A623
 *   Green "PANINDIO"  : #27AE60
 *   Orange "i" dot    : #F39C12
 *   Text "SME"        : #1A3A6B
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect, Polygon, Path, Circle, G } from 'react-native-svg';

// ─── Brand colour constants ──────────────────────────────────────────────────
const NAVY   = '#1E4D8C';
const AMBER  = '#F5A623';
const GREEN  = '#27AE60';
const ORANGE = '#F39C12';
const DARK   = '#1A3A6B';

export type BrandLogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type BrandLogoVariant = 'full' | 'icon' | 'wordmark';

export interface BrandLogoProps {
  size?: BrandLogoSize;
  variant?: BrandLogoVariant;
}

const SIZE_MAP: Record<BrandLogoSize, number> = {
  xs: 32,
  sm: 48,
  md: 64,
  lg: 96,
  xl: 128,
};

const FONT_SIZE_MAP: Record<BrandLogoSize, { sme: number; panindio: number }> = {
  xs: { sme: 10, panindio: 7 },
  sm: { sme: 14, panindio: 10 },
  md: { sme: 20, panindio: 14 },
  lg: { sme: 28, panindio: 20 },
  xl: { sme: 36, panindio: 26 },
};

/** Store icon drawn in a 64×64 viewBox */
const StoreIcon: React.FC<{ size: number }> = ({ size }) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    {/* Store body */}
    <Rect x="10" y="28" width="44" height="30" rx="3" fill={NAVY} />
    {/* Door */}
    <Rect x="24" y="40" width="16" height="18" rx="2" fill={AMBER} opacity={0.9} />
    {/* Window left */}
    <Rect x="13" y="33" width="8" height="8" rx="1.5" fill="#FFFFFF" opacity={0.8} />
    {/* Window right */}
    <Rect x="43" y="33" width="8" height="8" rx="1.5" fill="#FFFFFF" opacity={0.8} />
    {/* Awning base */}
    <Rect x="6" y="22" width="52" height="10" rx="2" fill={NAVY} />
    {/* Awning stripes (amber) */}
    <G>
      <Rect x="6"  y="22" width="7" height="10" fill={AMBER} />
      <Rect x="20" y="22" width="7" height="10" fill={AMBER} />
      <Rect x="34" y="22" width="7" height="10" fill={AMBER} />
      <Rect x="48" y="22" width="10" height="10" rx="2" fill={AMBER} />
    </G>
    {/* Awning scalloped edge */}
    <Path
      d="M6 32 Q9.5 36 13 32 Q16.5 36 20 32 Q23.5 36 27 32 Q30.5 36 34 32 Q37.5 36 41 32 Q44.5 36 48 32 Q51.5 36 55 32 Q57 34 58 32"
      stroke={AMBER}
      strokeWidth="1.5"
      fill="none"
    />
    {/* Roof / Gable */}
    <Polygon points="32,4 4,24 60,24" fill={NAVY} />
    <Polygon points="32,8 8,24 56,24" fill={AMBER} opacity={0.35} />
    {/* Box on counter */}
    <Rect x="22" y="34" width="10" height="8" rx="1" fill={AMBER} />
    <Rect x="33" y="36" width="8" height="6" rx="1" fill={AMBER} opacity={0.7} />
    {/* Door handle */}
    <Circle cx="32" cy="50" r="1.5" fill={NAVY} />
  </Svg>
);

/** Full logo: icon + text stack */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  variant = 'full',
}) => {
  const iconSize = SIZE_MAP[size];
  const fontSizes = FONT_SIZE_MAP[size];

  if (variant === 'icon') {
    return <StoreIcon size={iconSize} />;
  }

  if (variant === 'wordmark') {
    return (
      <View style={styles.wordmark}>
        <Text style={[styles.smeText, { fontSize: fontSizes.sme, color: DARK }]}>
          SME
        </Text>
        <WordmarkPanindio fontSize={fontSizes.panindio} />
      </View>
    );
  }

  // variant === 'full'
  return (
    <View style={styles.fullContainer}>
      <StoreIcon size={iconSize} />
      <View style={styles.textBlock}>
        <Text style={[styles.smeText, { fontSize: fontSizes.sme, color: DARK }]}>
          SME
        </Text>
        <WordmarkPanindio fontSize={fontSizes.panindio} />
      </View>
    </View>
  );
};

/** "PANINDIO" with the orange dot on the "i" */
const WordmarkPanindio: React.FC<{ fontSize: number }> = ({ fontSize }) => {
  // We render the word in three parts: P-A-N-I-N-D-[i]-O
  // The dot on "i" is swapped to orange via a custom character approach.
  return (
    <View style={styles.panindioRow}>
      <Text style={[styles.panindioBase, { fontSize }]}>PANIND</Text>
      {/* Custom "i" with coloured dot */}
      <View style={[styles.iContainer, { height: fontSize * 1.3 }]}>
        <View
          style={[
            styles.iDot,
            {
              width: fontSize * 0.28,
              height: fontSize * 0.28,
              borderRadius: fontSize * 0.14,
              backgroundColor: ORANGE,
              marginBottom: fontSize * 0.08,
            },
          ]}
        />
        <View
          style={[
            styles.iStem,
            {
              width: fontSize * 0.14,
              height: fontSize * 0.7,
              backgroundColor: GREEN,
            },
          ]}
        />
      </View>
      <Text style={[styles.panindioBase, { fontSize }]}>O</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  fullContainer: {
    alignItems: 'center',
    gap: 10,
  },
  textBlock: {
    alignItems: 'center',
    gap: 2,
  },
  wordmark: {
    alignItems: 'center',
    gap: 2,
  },
  smeText: {
    fontWeight: '900',
    letterSpacing: 3,
  },
  panindioRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  panindioBase: {
    color: GREEN,
    fontWeight: '800',
    letterSpacing: 1.5,
    lineHeight: undefined,
  },
  iContainer: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 0,
  },
  iDot: {},
  iStem: {
    borderRadius: 1,
  },
});

export default BrandLogo;
