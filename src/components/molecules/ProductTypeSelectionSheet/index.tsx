/**
 * ProductTypeSelectionSheet
 *
 * A bottom-sheet modal that presents two large, descriptive option cards so
 * the operator can choose what kind of product they are adding before the main
 * add-product form appears.
 *
 * Two options:
 *   'manufactured'   — product assembled/cooked from ingredients and raw
 *                      materials. Shows the BOM section in the add form.
 *   'ready_to_sell'  — purchased finished good, resold as-is. No BOM.
 *
 * Design:
 *   - Full dark / light mode following the project's dark-mode-first pattern.
 *   - Large tap targets (min-height 80 pt per card) suitable for warehouse staff.
 *   - Selected card gets an accent-coloured left border + tinted background.
 *   - Confirm button is disabled until a type is chosen.
 *
 * Usage:
 *   <ProductTypeSelectionSheet
 *     visible={showSheet}
 *     onClose={() => setShowSheet(false)}
 *     onConfirm={(type) => router.push({ pathname: 'add', params: { productType: type } })}
 *   />
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Modal,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  X,
  ChefHat,
  ShoppingBag,
  Check,
  FlaskConical,
  Tag,
} from 'lucide-react-native';
import { Text } from '@/components/atoms/Text';
import { Button } from '@/components/atoms/Button';
import { theme as staticTheme } from '@/core/theme';
import { useAppTheme, useThemeMode } from '@/core/theme';
import type { ProductType } from '@/types';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ProductTypeSelectionSheetProps {
  visible:    boolean;
  onClose:    () => void;
  /** Called when the user taps "Continue" with the chosen type. */
  onConfirm:  (productType: ProductType) => void;
}

// ─── Option config ────────────────────────────────────────────────────────────

interface TypeOption {
  type:        ProductType;
  label:       string;
  subtitle:    string;
  description: string;
  examples:    string;
  darkAccent:  string;
  lightAccent: string;
  PrimaryIcon: React.ComponentType<{ size: number; color: string }>;
  SecondaryIcon: React.ComponentType<{ size: number; color: string }>;
}

const TYPE_OPTIONS: TypeOption[] = [
  {
    type:          'manufactured',
    label:         'Manufactured / Recipe-based',
    subtitle:      'Has a Bill of Materials (BOM)',
    description:   'This product is assembled, cooked, or made from ingredients and raw materials. You will define a recipe that drives automatic stock deductions when production runs are recorded.',
    examples:      'e.g. Pandesal, Lechon, Bottled Sauce, Assembled Kit',
    darkAccent:    '#3DD68C',
    lightAccent:   staticTheme.colors.success[500],
    PrimaryIcon:   ChefHat,
    SecondaryIcon: FlaskConical,
  },
  {
    type:          'ready_to_sell',
    label:         'Ready-to-Sell',
    subtitle:      'No recipe required',
    description:   'This product is purchased from a supplier and sold as-is without any production step. Stock is managed by receiving deliveries.',
    examples:      'e.g. Bottled Water, Shampoo, Canned Goods, Packaged Snacks',
    darkAccent:    '#4F9EFF',
    lightAccent:   staticTheme.colors.primary[500],
    PrimaryIcon:   ShoppingBag,
    SecondaryIcon: Tag,
  },
];

// ─── Type option card ──────────────────────────────────────────────────────────

interface TypeOptionCardProps {
  option:     TypeOption;
  isSelected: boolean;
  isDark:     boolean;
  onSelect:   (type: ProductType) => void;
}

const TypeOptionCard: React.FC<TypeOptionCardProps> = React.memo(
  ({ option, isSelected, isDark, onSelect }) => {
    const accentColor = isDark ? option.darkAccent : option.lightAccent;

    const cardStyles = useMemo(() => {
      const baseBackground = isDark ? '#151A27' : '#FFFFFF';
      const selectedBackground = isDark
        ? `${accentColor}12`
        : `${accentColor}0A`;

      return StyleSheet.create({
        card: {
          borderRadius: staticTheme.borderRadius.xl,
          borderWidth: 1,
          borderLeftWidth: isSelected ? 4 : 1,
          borderColor: isSelected
            ? accentColor
            : isDark ? 'rgba(255,255,255,0.10)' : staticTheme.colors.gray[200],
          backgroundColor: isSelected ? selectedBackground : baseBackground,
          padding: staticTheme.spacing.md,
          gap: staticTheme.spacing.sm,
        },
        pressed: {
          backgroundColor: isDark
            ? 'rgba(255,255,255,0.04)'
            : staticTheme.colors.gray[50],
          transform: [{ scale: 0.99 }],
        },
      });
    }, [isDark, accentColor, isSelected]);

    return (
      <Pressable
        style={({ pressed }) => [
          cardStyles.card,
          pressed && !isSelected && cardStyles.pressed,
        ]}
        onPress={() => onSelect(option.type)}
        accessibilityRole="radio"
        accessibilityState={{ checked: isSelected }}
        accessibilityLabel={option.label}
        accessibilityHint={option.description}
      >
        {/* Header row: icon + label + check */}
        <View style={optionCardStyles.headerRow}>
          <View style={[
            optionCardStyles.iconWrap,
            { backgroundColor: `${accentColor}18` },
          ]}>
            <option.PrimaryIcon size={22} color={accentColor} />
          </View>

          <View style={optionCardStyles.labelGroup}>
            <Text
              variant="body"
              weight="semibold"
              style={{ color: isDark ? '#FFFFFF' : staticTheme.colors.gray[800] }}
            >
              {option.label}
            </Text>
            <View style={optionCardStyles.subtitleRow}>
              <option.SecondaryIcon
                size={12}
                color={isDark ? 'rgba(255,255,255,0.45)' : staticTheme.colors.gray[500]}
              />
              <Text
                variant="body-xs"
                style={{
                  color: isDark ? 'rgba(255,255,255,0.45)' : staticTheme.colors.gray[500],
                }}
              >
                {option.subtitle}
              </Text>
            </View>
          </View>

          {/* Selection indicator */}
          <View style={[
            optionCardStyles.checkCircle,
            isSelected
              ? { backgroundColor: accentColor, borderColor: accentColor }
              : {
                  backgroundColor: 'transparent',
                  borderColor: isDark ? 'rgba(255,255,255,0.25)' : staticTheme.colors.gray[300],
                },
          ]}>
            {isSelected && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
          </View>
        </View>

        {/* Description */}
        <Text
          variant="body-sm"
          style={{
            color: isDark ? 'rgba(255,255,255,0.60)' : staticTheme.colors.gray[600],
            lineHeight: 20,
          }}
        >
          {option.description}
        </Text>

        {/* Examples chip */}
        <View style={[
          optionCardStyles.examplesChip,
          {
            backgroundColor: `${accentColor}10`,
            borderColor: `${accentColor}25`,
          },
        ]}>
          <Text
            variant="body-xs"
            style={{ color: isDark ? accentColor : option.lightAccent }}
          >
            {option.examples}
          </Text>
        </View>
      </Pressable>
    );
  },
);
TypeOptionCard.displayName = 'TypeOptionCard';

const optionCardStyles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: staticTheme.spacing.sm,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: staticTheme.borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  labelGroup: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  examplesChip: {
    borderWidth: 1,
    borderRadius: staticTheme.borderRadius.md,
    paddingHorizontal: staticTheme.spacing.sm,
    paddingVertical: 5,
    alignSelf: 'flex-start',
  },
});

// ─── Main component ───────────────────────────────────────────────────────────

export const ProductTypeSelectionSheet: React.FC<ProductTypeSelectionSheetProps> = ({
  visible,
  onClose,
  onConfirm,
}) => {
  const insets  = useSafeAreaInsets();
  const isDark  = useThemeMode() === 'dark';
  const theme   = useAppTheme();

  const [selectedType, setSelectedType] = useState<ProductType | undefined>(undefined);

  const handleClose = useCallback(() => {
    setSelectedType(undefined);
    onClose();
  }, [onClose]);

  const handleConfirm = useCallback(() => {
    if (selectedType === undefined) return;
    const confirmed = selectedType;
    setSelectedType(undefined);
    onConfirm(confirmed);
  }, [selectedType, onConfirm]);

  const handleSelect = useCallback((type: ProductType) => {
    setSelectedType(type);
  }, []);

  const sheetBg = isDark ? '#1A1F2E' : theme.colors.surface;
  const accent  = isDark ? '#4F9EFF' : staticTheme.colors.primary[500];

  const dynStyles = useMemo(() => StyleSheet.create({
    sheet: {
      backgroundColor: sheetBg,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingBottom: Math.max(insets.bottom, staticTheme.spacing.lg),
      borderTopWidth: 1,
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : theme.colors.border,
      maxHeight: '88%',
      ...(isDark ? {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -6 },
        shadowOpacity: 0.50,
        shadowRadius: 24,
        elevation: 24,
      } : staticTheme.shadows.xl),
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : theme.colors.gray[300],
      alignSelf: 'center',
      marginTop: staticTheme.spacing.sm,
      marginBottom: staticTheme.spacing.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: staticTheme.spacing.md,
      marginBottom: staticTheme.spacing.xs,
    },
    titleGroup: { flex: 1, gap: 2 },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : staticTheme.colors.gray[100],
    },
    divider: {
      height: 1,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : theme.colors.borderSubtle,
      marginHorizontal: staticTheme.spacing.md,
      marginBottom: staticTheme.spacing.md,
    },
    content: {
      paddingHorizontal: staticTheme.spacing.md,
      gap: staticTheme.spacing.sm,
    },
    footer: {
      paddingHorizontal: staticTheme.spacing.md,
      paddingTop: staticTheme.spacing.md,
      gap: staticTheme.spacing.sm,
      borderTopWidth: 1,
      borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : theme.colors.borderSubtle,
      marginTop: staticTheme.spacing.md,
    },
    continueBtn: {
      opacity: selectedType !== undefined ? 1 : 0.45,
    },
    skipHint: {
      textAlign: 'center',
      color: isDark ? 'rgba(255,255,255,0.30)' : staticTheme.colors.gray[400],
    },
  }), [theme, sheetBg, isDark, insets.bottom, selectedType]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <Pressable style={sheetStyles.overlay} onPress={handleClose}>
        <Pressable style={dynStyles.sheet} onPress={(e) => e.stopPropagation()}>
          {/* Drag handle */}
          <View style={dynStyles.handle} />

          {/* Header */}
          <View style={dynStyles.header}>
            <View style={dynStyles.titleGroup}>
              <Text
                variant="h5"
                weight="bold"
                style={{ color: isDark ? '#FFFFFF' : theme.colors.text }}
              >
                Choose Product Type
              </Text>
              <Text
                variant="body-sm"
                style={{
                  color: isDark ? 'rgba(255,255,255,0.50)' : staticTheme.colors.gray[500],
                }}
              >
                This determines whether the product has a recipe or not
              </Text>
            </View>
            <Pressable
              style={({ pressed }) => [dynStyles.closeBtn, pressed && { opacity: 0.7 }]}
              onPress={handleClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={8}
            >
              <X
                size={18}
                color={isDark ? 'rgba(255,255,255,0.55)' : staticTheme.colors.gray[500]}
              />
            </Pressable>
          </View>

          <View style={dynStyles.divider} />

          {/* Option cards */}
          <ScrollView
            style={sheetStyles.scroll}
            contentContainerStyle={dynStyles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {TYPE_OPTIONS.map((option) => (
              <TypeOptionCard
                key={option.type}
                option={option}
                isSelected={selectedType === option.type}
                isDark={isDark}
                onSelect={handleSelect}
              />
            ))}

            {/* Informational note */}
            <View style={[
              sheetStyles.infoNote,
              {
                backgroundColor: isDark ? `${accent}0C` : `${accent}08`,
                borderColor: isDark ? `${accent}20` : `${accent}18`,
              },
            ]}>
              <Text
                variant="body-xs"
                style={{
                  color: isDark ? `${accent}CC` : staticTheme.colors.primary[600],
                  lineHeight: 18,
                }}
              >
                You can change the product type later from the product detail screen.
              </Text>
            </View>
          </ScrollView>

          {/* Footer actions */}
          <View style={dynStyles.footer}>
            <Button
              title="Continue"
              onPress={handleConfirm}
              variant="primary"
              size="lg"
              fullWidth
              disabled={selectedType === undefined}
              style={dynStyles.continueBtn}
            />
            <Text variant="body-xs" style={dynStyles.skipHint}>
              Select a type above to continue
            </Text>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

// ─── Static styles ────────────────────────────────────────────────────────────

const sheetStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.60)',
    justifyContent: 'flex-end',
  },
  scroll: {
    flexGrow: 0,
  },
  infoNote: {
    borderRadius: staticTheme.borderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: staticTheme.spacing.sm,
    paddingVertical: staticTheme.spacing.xs,
    marginTop: staticTheme.spacing.xs,
  },
});
