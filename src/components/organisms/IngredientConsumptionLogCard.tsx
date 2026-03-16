/**
 * IngredientConsumptionLogCard
 *
 * Reusable card for a single ingredient consumption log event.
 * Renders a color-coded left accent bar (keyed to trigger type),
 * a collapsible detail section for notes / reference / performer,
 * and a quantity badge.
 *
 * All color decisions use the triggerColor helper so the visual
 * language is consistent between the log list and any future
 * usage (e.g. a per-ingredient detail screen).
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  LayoutAnimation,
} from 'react-native';
import {
  Clock,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Layers,
  RotateCcw,
  Wrench,
  Trash2,
  ArrowRightLeft,
} from 'lucide-react-native';
import { Text } from '../atoms/Text';
import { theme as staticTheme } from '@/core/theme';
import type { IngredientConsumptionLogDetail, IngredientConsumptionTrigger } from '@/types';

// ─── Dark-mode palette constants ──────────────────────────────────────────────

const DARK_ACCENT  = '#4F9EFF';
const DARK_GREEN   = '#3DD68C';
const DARK_AMBER   = '#FFB020';
const DARK_RED     = '#FF6B6B';
const DARK_CARD_BG = '#151A27';

// ─── Helpers (exported so the screen can stay in sync) ────────────────────────

export const TRIGGER_LABELS: Record<IngredientConsumptionTrigger, string> = {
  PRODUCTION:        'Production',
  MANUAL_ADJUSTMENT: 'Manual',
  WASTAGE:           'Wastage',
  RETURN:            'Return',
  TRANSFER:          'Transfer',
};

export function triggerColor(
  trigger: IngredientConsumptionTrigger,
  isDark:  boolean,
): string {
  switch (trigger) {
    case 'PRODUCTION':        return isDark ? DARK_ACCENT : staticTheme.colors.primary[500];
    case 'MANUAL_ADJUSTMENT': return isDark ? DARK_AMBER  : staticTheme.colors.warning[500];
    case 'WASTAGE':           return isDark ? DARK_RED    : staticTheme.colors.error[500];
    case 'RETURN':            return isDark ? DARK_GREEN  : staticTheme.colors.success[500];
    case 'TRANSFER':          return isDark ? '#A78BFA'   : staticTheme.colors.info[500];
  }
}

function formatCurrency(value: number): string {
  return `₱${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  let h    = d.getHours();
  const m  = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

// ─── TriggerIcon ──────────────────────────────────────────────────────────────

export function TriggerIcon({
  trigger,
  color,
  size,
}: {
  trigger: IngredientConsumptionTrigger;
  color:   string;
  size:    number;
}): React.ReactElement {
  switch (trigger) {
    case 'PRODUCTION':        return <Layers        size={size} color={color} />;
    case 'MANUAL_ADJUSTMENT': return <Wrench        size={size} color={color} />;
    case 'WASTAGE':           return <Trash2        size={size} color={color} />;
    case 'RETURN':            return <RotateCcw     size={size} color={color} />;
    case 'TRANSFER':          return <ArrowRightLeft size={size} color={color} />;
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface IngredientConsumptionLogCardProps {
  item:     IngredientConsumptionLogDetail;
  isDark:   boolean;
  /** Called when the user taps the card body to select this entry */
  onPress?: () => void;
  /** When true renders a selection highlight ring around the card */
  selected?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const IngredientConsumptionLogCard = React.memo<IngredientConsumptionLogCardProps>(
  ({ item, isDark, onPress, selected = false }) => {
    const [expanded, setExpanded] = useState(false);

    const accent    = triggerColor(item.triggerType, isDark);
    const cardBg    = isDark ? DARK_CARD_BG : '#FFFFFF';
    const textMain  = isDark ? '#FFFFFF' : staticTheme.colors.gray[800];
    const textMuted = isDark ? 'rgba(255,255,255,0.45)' : staticTheme.colors.gray[500];
    const divider   = isDark ? 'rgba(255,255,255,0.07)' : staticTheme.colors.gray[100];

    // Selection highlight: thicker border + slightly lighter background tint
    const selectionBorderColor = selected
      ? accent
      : isDark ? `${accent}22` : `${accent}28`;
    const selectionBorderWidth = selected ? 2 : 1;
    const selectionBg = selected
      ? isDark ? `${accent}14` : `${accent}08`
      : cardBg;

    const toggle = useCallback(() => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setExpanded((p) => !p);
    }, []);

    const isCancelled = item.cancelledAt !== undefined;

    const hasDetails =
      item.notes !== undefined ||
      item.referenceId !== undefined ||
      item.performedBy !== undefined;

    const cardContent = (
      <View
        style={[
          cardStyles.card,
          {
            backgroundColor: selectionBg,
            borderColor:     selectionBorderColor,
            borderWidth:     selectionBorderWidth,
            opacity:         isCancelled ? 0.5 : 1,
          },
        ]}
      >
        {/* Color-coded left accent bar */}
        <View style={[cardStyles.accentBar, { backgroundColor: accent }]} />

        <View style={cardStyles.body}>
          {/* ── Header row ── */}
          <View style={cardStyles.headerRow}>
            {/* Trigger icon circle */}
            <View style={[cardStyles.iconCircle, { backgroundColor: `${accent}18` }]}>
              <TriggerIcon trigger={item.triggerType} color={accent} size={15} />
            </View>

            {/* Ingredient name + trigger pill */}
            <View style={cardStyles.nameWrap}>
              <Text
                variant="body"
                weight="semibold"
                style={{ color: textMain }}
                numberOfLines={1}
              >
                {item.ingredientName}
              </Text>
              <View
                style={[
                  cardStyles.triggerPill,
                  {
                    backgroundColor: `${accent}12`,
                    borderColor:     `${accent}22`,
                  },
                ]}
              >
                <Text variant="body-xs" weight="medium" style={{ color: accent }}>
                  {TRIGGER_LABELS[item.triggerType]}
                </Text>
                {isCancelled && (
                  <Text variant="body-xs" weight="medium" style={{ color: textMuted }}>
                    {' '}· Cancelled
                  </Text>
                )}
              </View>
            </View>

            {/* Quantity badge */}
            <View
              style={[
                cardStyles.qtyBadge,
                {
                  backgroundColor: `${accent}15`,
                  borderColor:     `${accent}30`,
                },
              ]}
            >
              <Text
                weight="bold"
                style={{ color: accent, fontSize: 16, lineHeight: 20 }}
              >
                {item.quantityConsumed < 0
                  ? `-${Math.abs(item.quantityConsumed)}`
                  : String(item.quantityConsumed)}
              </Text>
              <Text variant="body-xs" style={{ color: textMuted }}>
                {item.unit}
              </Text>
            </View>
          </View>

          {/* ── Meta row ── */}
          <View style={cardStyles.metaRow}>
            {item.totalCost > 0 && (
              <>
                <DollarSign size={11} color={accent} />
                <Text variant="body-sm" weight="semibold" style={{ color: accent }}>
                  {formatCurrency(item.totalCost)}
                </Text>
                <View
                  style={[
                    cardStyles.metaDot,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255,255,255,0.12)'
                        : staticTheme.colors.gray[300],
                    },
                  ]}
                />
              </>
            )}
            <Clock size={11} color={textMuted} />
            <Text variant="body-xs" style={{ color: textMuted }}>
              {formatDate(item.consumedAt)} {formatTime(item.consumedAt)}
            </Text>
          </View>

          {/* ── Expandable details ── */}
          {hasDetails && (
            <>
              <View style={[cardStyles.divider, { backgroundColor: divider }]} />

              <Pressable
                style={({ pressed }) => [
                  cardStyles.expandBtn,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
                onPress={toggle}
                accessibilityRole="button"
                accessibilityLabel={expanded ? 'Collapse details' : 'Expand details'}
              >
                <Text
                  variant="body-xs"
                  weight="medium"
                  style={{ color: textMuted, flex: 1 }}
                >
                  Details
                </Text>
                {expanded
                  ? <ChevronUp   size={13} color={textMuted} />
                  : <ChevronDown size={13} color={textMuted} />
                }
              </Pressable>

              {expanded && (
                <View
                  style={[
                    cardStyles.detailsBlock,
                    { borderTopColor: divider },
                  ]}
                >
                  {item.notes !== undefined && (
                    <Text variant="body-xs" style={{ color: textMuted }}>
                      Note: {item.notes}
                    </Text>
                  )}
                  {item.referenceId !== undefined && (
                    <Text variant="body-xs" style={{ color: textMuted }}>
                      Ref ({item.referenceType ?? 'doc'}): {item.referenceId.slice(0, 8)}…
                    </Text>
                  )}
                  {item.performedBy !== undefined && (
                    <Text variant="body-xs" style={{ color: textMuted }}>
                      By: {item.performedBy}
                    </Text>
                  )}
                </View>
              )}
            </>
          )}
        </View>
      </View>
    );

    // If onPress is provided wrap the card in a Pressable for card-level selection.
    // The inner "Details" Pressable is unaffected — React Native Pressable events do
    // not bubble, so the inner toggle press does NOT fire the outer onPress.
    if (onPress !== undefined) {
      return (
        <Pressable
          style={({ pressed }) => [
            cardStyles.cardWrapper,
            { opacity: pressed ? 0.88 : 1 },
          ]}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`Select ${item.ingredientName} log entry`}
          accessibilityState={{ selected }}
        >
          {cardContent}
        </Pressable>
      );
    }

    return <View style={cardStyles.cardWrapper}>{cardContent}</View>;
  },
);

IngredientConsumptionLogCard.displayName = 'IngredientConsumptionLogCard';

// ─── Styles ───────────────────────────────────────────────────────────────────

const cardStyles = StyleSheet.create({
  // Outer wrapper owns the margin so that both the plain View and Pressable
  // variants share identical spacing without duplicating the values.
  cardWrapper: {
    marginHorizontal: staticTheme.spacing.md,
    marginVertical:   5,
    borderRadius:     staticTheme.borderRadius.xl,
    overflow:         'hidden',
  },
  card: {
    flexDirection: 'row',
    borderRadius:  staticTheme.borderRadius.xl,
    overflow:      'hidden',
    borderWidth:   1,
  },
  accentBar: {
    width:    3,
    flexShrink: 0,
  },
  body: {
    flex:              1,
    paddingHorizontal: staticTheme.spacing.md,
    paddingVertical:   12,
    gap:               8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           staticTheme.spacing.sm,
  },
  iconCircle: {
    width:           36,
    height:          36,
    borderRadius:    18,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  nameWrap: {
    flex:     1,
    gap:      3,
    minWidth: 0,
  },
  triggerPill: {
    flexDirection:  'row',
    alignItems:     'center',
    alignSelf:      'flex-start',
    borderWidth:    1,
    borderRadius:   staticTheme.borderRadius.sm,
    paddingHorizontal: 6,
    paddingVertical:   2,
  },
  qtyBadge: {
    alignItems:      'center',
    justifyContent:  'center',
    paddingHorizontal: 10,
    paddingVertical:   6,
    borderRadius:    staticTheme.borderRadius.lg,
    borderWidth:     1,
    flexShrink:      0,
    minWidth:        52,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
  },
  metaDot: {
    width:        3,
    height:       3,
    borderRadius: 2,
  },
  divider: {
    height: 1,
  },
  expandBtn: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
    paddingVertical: 4,
  },
  detailsBlock: {
    borderTopWidth: 1,
    paddingTop:     6,
    gap:            3,
  },
});
