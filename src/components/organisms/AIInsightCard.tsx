/**
 * AIInsightCard — organism
 *
 * Displays an AI-generated natural language insight about the current ROI
 * calculation. Supports an animated shimmer loading state and risk-level
 * colour coding.
 *
 * Design:
 *   - Dark gradient card with a subtle glow matching the risk colour
 *   - Robot/AI icon pill at top-left
 *   - Animated typewriter effect when insight changes
 *   - Risk badge at top-right: Low Risk (green) | Medium Risk (amber) | High Risk (red)
 *
 * TypeScript constraints:
 *   - exactOptionalPropertyTypes: no `prop: undefined`, conditional spread
 *   - noUncheckedIndexedAccess: all array access uses `?? fallback`
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Animated,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { Bot, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react-native';
import { Text } from '@/components/atoms/Text';
import { useThemeStore, selectThemeMode } from '@/store';
import { useAppTheme } from '@/core/theme';
import type { ROIRiskLevel } from '@/types/roi.types';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface AIInsightCardProps {
  insight:    string;
  riskLevel:  ROIRiskLevel;
  isLoading:  boolean;
  style?:     ViewStyle;
}

// ─── Tokens ───────────────────────────────────────────────────────────────────

const DARK_CARD_BG    = '#151A27';
const DARK_BORDER     = 'rgba(255,255,255,0.08)';
const SHIMMER_DARK = '#1E2A3A';

function riskTokens(riskLevel: ROIRiskLevel, isDark: boolean): {
  color:      string;
  badgeBg:    string;
  badgeText:  string;
  glowColor:  string;
  label:      string;
} {
  switch (riskLevel) {
    case 'low':
      return {
        color:     isDark ? '#3DD68C' : '#27AE60',
        badgeBg:   isDark ? 'rgba(61,214,140,0.15)' : '#E9F7EF',
        badgeText: isDark ? '#3DD68C' : '#187540',
        glowColor: isDark ? 'rgba(61,214,140,0.12)' : 'rgba(39,174,96,0.08)',
        label:     'Low Risk',
      };
    case 'medium':
      return {
        color:     isDark ? '#FFB020' : '#F5A623',
        badgeBg:   isDark ? 'rgba(255,176,32,0.15)' : '#FEF7E8',
        badgeText: isDark ? '#FFB020' : '#965F09',
        glowColor: isDark ? 'rgba(255,176,32,0.12)' : 'rgba(245,166,35,0.08)',
        label:     'Medium Risk',
      };
    case 'high':
      return {
        color:     isDark ? '#FF6B6B' : '#FF3B30',
        badgeBg:   isDark ? 'rgba(255,107,107,0.15)' : '#FFF5F5',
        badgeText: isDark ? '#FF6B6B' : '#CC2F26',
        glowColor: isDark ? 'rgba(255,107,107,0.12)' : 'rgba(255,59,48,0.08)',
        label:     'High Risk',
      };
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const ShimmerBlock: React.FC<{ widthPercent: number; height: number; isDark: boolean }> = ({
  widthPercent,
  height,
  isDark,
}) => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  const bg = isDark ? SHIMMER_DARK : '#E5E7EB';

  return (
    <Animated.View
      style={{
        width:        `${widthPercent}%` as `${number}%`,
        height,
        borderRadius: 6,
        opacity:      anim,
        backgroundColor: bg,
      }}
    />
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

export const AIInsightCard: React.FC<AIInsightCardProps> = ({
  insight,
  riskLevel,
  isLoading,
  style,
}) => {
  const mode   = useThemeStore(selectThemeMode);
  const isDark = mode === 'dark';
  const appTheme = useAppTheme();

  const tokens = riskTokens(riskLevel, isDark);

  // Typewriter state
  const [displayedText, setDisplayedText] = useState('');
  const typewriterRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const charIndexRef  = useRef(0);

  const startTypewriter = useCallback((text: string) => {
    if (typewriterRef.current) clearTimeout(typewriterRef.current);
    charIndexRef.current = 0;
    setDisplayedText('');

    const type = () => {
      const idx = charIndexRef.current;
      if (idx >= text.length) return;
      charIndexRef.current = idx + 1;
      setDisplayedText(text.slice(0, charIndexRef.current));
      typewriterRef.current = setTimeout(type, 18);
    };
    type();
  }, []);

  useEffect(() => {
    if (!isLoading && insight) {
      startTypewriter(insight);
    }
    return () => {
      if (typewriterRef.current) clearTimeout(typewriterRef.current);
    };
  }, [insight, isLoading, startTypewriter]);

  // Card entrance fade
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue:         1,
      duration:        400,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const cardBg  = isDark ? DARK_CARD_BG : appTheme.colors.surface;
  const border  = isDark ? DARK_BORDER  : appTheme.colors.borderSubtle;

  const RiskIcon = riskLevel === 'low'
    ? CheckCircle
    : riskLevel === 'medium'
    ? TrendingUp
    : AlertTriangle;

  return (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor:  cardBg,
          borderColor:      border,
          shadowColor:      tokens.glowColor,
        },
        style,
        { opacity: fadeAnim },
      ]}
    >
      {/* Top bar — icon pill + risk badge */}
      <View style={styles.topRow}>
        {/* AI icon pill */}
        <View style={[styles.iconPill, { backgroundColor: isDark ? 'rgba(79,158,255,0.15)' : appTheme.colors.primary[50] }]}>
          <Bot size={16} color={isDark ? '#4F9EFF' : appTheme.colors.primary[500]} />
          <Text
            variant="body-xs"
            weight="semibold"
            style={{ color: isDark ? '#4F9EFF' : appTheme.colors.primary[500], marginLeft: 4 }}
          >
            AI Insight
          </Text>
        </View>

        {/* Risk badge */}
        <View style={[styles.riskBadge, { backgroundColor: tokens.badgeBg }]}>
          <RiskIcon size={11} color={tokens.badgeText} />
          <Text
            variant="body-xs"
            weight="semibold"
            style={{ color: tokens.badgeText, marginLeft: 3 }}
          >
            {tokens.label}
          </Text>
        </View>
      </View>

      {/* Risk colour accent bar */}
      <View style={[styles.accentBar, { backgroundColor: tokens.color }]} />

      {/* Insight text or shimmer */}
      <View style={styles.body}>
        {isLoading ? (
          <View style={styles.shimmerContainer}>
            <ShimmerBlock widthPercent={100} height={14} isDark={isDark} />
            <View style={{ height: 8 }} />
            <ShimmerBlock widthPercent={85}  height={14} isDark={isDark} />
            <View style={{ height: 8 }} />
            <ShimmerBlock widthPercent={60}  height={14} isDark={isDark} />
          </View>
        ) : (
          <Text
            variant="body-sm"
            weight="normal"
            style={{
              color: isDark ? 'rgba(241,245,249,0.90)' : appTheme.colors.text,
              lineHeight: 22,
            }}
          >
            {displayedText}
          </Text>
        )}
      </View>
    </Animated.View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    borderRadius:   16,
    borderWidth:    1,
    overflow:       'hidden',
    shadowOffset:   { width: 0, height: 4 },
    shadowOpacity:  1,
    shadowRadius:   12,
    elevation:      6,
  },
  topRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop:        16,
    paddingBottom:      8,
  },
  iconPill: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingVertical:  5,
    paddingHorizontal: 10,
    borderRadius:    20,
  },
  riskBadge: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingVertical:  4,
    paddingHorizontal: 8,
    borderRadius:    20,
  },
  accentBar: {
    height:           3,
    marginHorizontal: 16,
    borderRadius:     2,
    marginBottom:     12,
  },
  body: {
    paddingHorizontal: 16,
    paddingBottom:     16,
    minHeight:         60,
  },
  shimmerContainer: {
    paddingTop: 4,
  },
});
