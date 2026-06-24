import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  memo,
} from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  Platform,
  ListRenderItemInfo,
  KeyboardAvoidingView,
} from 'react-native';
import { Search, ChevronDown, X, Phone } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/atoms/Text';
import { useThemeMode } from '@/core/theme';
import { theme as staticTheme } from '@/core/theme';
import { COUNTRIES, DEFAULT_COUNTRY } from './countries';
import type { Country } from './countries';

// ── Re-export Country type so callers can import from this barrel ─────────────
export type { Country };

// ── Design tokens (mirrors customer-register.tsx + Input.tsx) ─────────────────
const PHONE_DARK = {
  bg:              '#1E2435',
  border:          'rgba(255,255,255,0.12)',
  borderFocus:     'rgba(255,255,255,0.30)',
  borderError:     '#EF4444',
  text:            'rgba(255,255,255,0.90)',
  placeholder:     'rgba(255,255,255,0.35)',
  label:           'rgba(255,255,255,0.60)',
  divider:         'rgba(255,255,255,0.10)',
  dialCode:        'rgba(255,255,255,0.70)',
  chevron:         'rgba(255,255,255,0.40)',
  errorText:       '#EF4444',
  // Modal
  modalBg:         '#141820',
  modalCard:       '#1A2235',
  modalBorder:     'rgba(255,255,255,0.08)',
  searchBg:        '#1E2435',
  searchBorder:    'rgba(255,255,255,0.12)',
  rowSep:          'rgba(255,255,255,0.06)',
  rowHover:        'rgba(255,255,255,0.04)',
  subtleText:      'rgba(255,255,255,0.45)',
} as const;

const PHONE_LIGHT = {
  bg:              '#FAFBFD',
  border:          '#DDE3EE',
  borderFocus:     '#1E4D8C',
  borderError:     '#EF4444',
  text:            staticTheme.colors.text,
  placeholder:     staticTheme.colors.placeholder,
  label:           '#1E4D8C',
  divider:         '#DDE3EE',
  dialCode:        '#4A5568',
  chevron:         '#9CA3AF',
  errorText:       '#EF4444',
  // Modal
  modalBg:         '#F0F4F8',
  modalCard:       '#FFFFFF',
  modalBorder:     'transparent',
  searchBg:        '#FAFBFD',
  searchBorder:    '#DDE3EE',
  rowSep:          '#F0F4F8',
  rowHover:        '#F8FAFC',
  subtleText:      '#6B7280',
} as const;

// ── Props ─────────────────────────────────────────────────────────────────────
export interface PhoneInputProps {
  /** Raw local number the user types (e.g. "09171234567") */
  value: string;
  onChangeText: (value: string) => void;
  /** Called when the user selects a different country */
  onChangeCountry?: (country: Country) => void;
  error?: string;
  label?: string;
  /** Override dark mode — if omitted the component reads from useThemeMode() */
  isDark?: boolean;
  /** Accent / label colour override (e.g. NAVY in customer-register) */
  primaryColor?: string;
  editable?: boolean;
}

// ── Country row (memoised to prevent FlatList re-renders) ─────────────────────
interface CountryRowProps {
  item: Country;
  isSelected: boolean;
  onPress: (country: Country) => void;
  tok: typeof PHONE_DARK | typeof PHONE_LIGHT;
  primaryColor: string;
}

const CountryRow = memo(function CountryRow({
  item,
  isSelected,
  onPress,
  tok,
  primaryColor,
}: CountryRowProps) {
  const handlePress = useCallback(() => onPress(item), [onPress, item]);

  const nameColor: string = isSelected ? primaryColor : tok.text;
  const codeColor: string = tok.subtleText;
  const rowBg = isSelected ? `${primaryColor}18` : tok.modalCard;

  return (
    <TouchableOpacity
      style={[rowStyles.row, { backgroundColor: rowBg }]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <Text style={rowStyles.flag}>{item.flag}</Text>
      <Text style={[rowStyles.name, { color: nameColor }]} numberOfLines={1}>
        {item.name}
      </Text>
      <Text style={[rowStyles.code, { color: codeColor }]}>+{item.dialCode}</Text>
      {isSelected && (
        <View style={[rowStyles.activeDot, { backgroundColor: primaryColor }]} />
      )}
    </TouchableOpacity>
  );
});

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  flag: {
    fontSize: 22,
    marginRight: 12,
    lineHeight: 26,
  },
  name: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  code: {
    fontSize: 13,
    marginLeft: 8,
    fontVariant: ['tabular-nums'],
  },
  activeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginLeft: 10,
  },
});

// ── Country picker Modal ──────────────────────────────────────────────────────
interface CountryPickerModalProps {
  visible: boolean;
  onClose: () => void;
  selected: Country;
  onSelect: (country: Country) => void;
  tok: typeof PHONE_DARK | typeof PHONE_LIGHT;
  primaryColor: string;
}

const CountryPickerModal = memo(function CountryPickerModal({
  visible,
  onClose,
  selected,
  onSelect,
  tok,
  primaryColor,
}: CountryPickerModalProps) {
  const [query, setQuery] = useState('');
  const insets = useSafeAreaInsets();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length === 0) return COUNTRIES;
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.dialCode.includes(q) ||
        c.code.toLowerCase().includes(q),
    );
  }, [query]);

  const handleSelect = useCallback(
    (country: Country) => {
      onSelect(country);
      setQuery('');
      onClose();
    },
    [onSelect, onClose],
  );

  const keyExtractor = useCallback((item: Country) => item.code, []);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Country>) => (
      <CountryRow
        item={item}
        isSelected={item.code === selected.code}
        onPress={handleSelect}
        tok={tok}
        primaryColor={primaryColor}
      />
    ),
    [selected.code, handleSelect, tok, primaryColor],
  );

  const ItemSeparator = useCallback(
    () => <View style={[modalStyles.sep, { backgroundColor: tok.rowSep }]} />,
    [tok.rowSep],
  );

  const ListEmpty = useCallback(
    () => (
      <View style={modalStyles.emptyWrap}>
        <Text style={[modalStyles.emptyText, { color: tok.subtleText }]}>
          No countries match "{query}"
        </Text>
      </View>
    ),
    [query, tok.subtleText],
  );

  const clearIconColor: string = tok.chevron;
  const searchTextColor: string = tok.text;
  const searchPlaceholderColor: string = tok.placeholder;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={[modalStyles.root, { backgroundColor: tok.modalBg }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View
          style={[
            modalStyles.header,
            {
              paddingTop: insets.top + 16,
              borderBottomColor: tok.rowSep,
              backgroundColor: tok.modalCard,
            },
          ]}
        >
          <Text style={[modalStyles.headerTitle, { color: tok.text }]}>
            Select Country
          </Text>
          <TouchableOpacity
            style={modalStyles.closeBtn}
            onPress={onClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <X size={20} color={clearIconColor} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View
          style={[
            modalStyles.searchWrap,
            { backgroundColor: tok.modalCard },
          ]}
        >
          <View
            style={[
              modalStyles.searchRow,
              {
                backgroundColor: tok.searchBg,
                borderColor: tok.searchBorder,
              },
            ]}
          >
            <Search size={16} color={tok.chevron} strokeWidth={2} style={modalStyles.searchIcon} />
            <TextInput
              style={[modalStyles.searchInput, { color: searchTextColor }]}
              value={query}
              onChangeText={setQuery}
              placeholder="Search by country or code..."
              placeholderTextColor={searchPlaceholderColor}
              autoCorrect={false}
              autoCapitalize="none"
              clearButtonMode="while-editing"
            />
            {query.length > 0 && (
              <TouchableOpacity
                onPress={() => setQuery('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={modalStyles.clearBtn}
              >
                <X size={14} color={clearIconColor} strokeWidth={2.5} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Country list */}
        <FlatList
          data={filtered}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ItemSeparatorComponent={ItemSeparator}
          ListEmptyComponent={ListEmpty}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
          style={{ backgroundColor: tok.modalCard }}
          initialNumToRender={30}
          maxToRenderPerBatch={30}
          windowSize={10}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
});

const modalStyles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  searchWrap: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 2,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 9,
  },
  clearBtn: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  sep: {
    height: 1,
  },
  emptyWrap: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
});

// ── Main PhoneInput component ─────────────────────────────────────────────────
export function PhoneInput({
  value,
  onChangeText,
  onChangeCountry,
  error,
  label,
  isDark: isDarkProp,
  primaryColor,
  editable = true,
}: PhoneInputProps) {
  // Honour prop override; fall back to theme store
  const mode = useThemeMode();
  const isDark = isDarkProp !== undefined ? isDarkProp : mode === 'dark';

  const tok = isDark ? PHONE_DARK : PHONE_LIGHT;
  const accent = primaryColor ?? (isDark ? '#4F9EFF' : '#1E4D8C');

  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [blurError, setBlurError] = useState<string | undefined>(undefined);

  const inputRef = useRef<TextInput>(null);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      setBlurError(undefined);
      return;
    }
    if (!isValidPhoneNumber(trimmed, country)) {
      setBlurError(`Enter a valid ${country.name} phone number`);
    } else {
      setBlurError(undefined);
    }
  }, [value, country]);

  const handleCountrySelect = useCallback(
    (selected: Country) => {
      setCountry(selected);
      setBlurError(undefined);
      // Notify parent if callback provided
      if (onChangeCountry !== undefined) {
        onChangeCountry(selected);
      }
    },
    [onChangeCountry],
  );

  const handleChangeText = useCallback(
    (text: string) => {
      // Allow digits, spaces, hyphens, parentheses — strip everything else
      const cleaned = text.replace(/[^\d\s\-().]/g, '');
      onChangeText(cleaned);
      if (blurError !== undefined) setBlurError(undefined);
    },
    [onChangeText, blurError],
  );

  // Visible error: prop error takes priority over blur-time validation error
  const visibleError: string | undefined = error ?? blurError;

  // Max chars the user can type: E.164 cap (15 digits) minus the dial code length,
  // +1 to allow a leading 0 in local format.  PH is capped at 11 (09XXXXXXXXX).
  const inputMaxLength: number =
    country.code === 'PH'
      ? 11
      : Math.min(15 - country.dialCode.replace(/\D/g, '').length + 1, 15);

  // Derive border colour as a plain string before JSX (strict-mode TS requirement)
  const borderColor: string = visibleError
    ? tok.borderError
    : isFocused
    ? tok.borderFocus
    : tok.border;

  const textColor: string = editable ? tok.text : tok.placeholder;
  const labelColor: string = accent;
  const chevronColor: string = tok.chevron;
  const dialCodeColor: string = tok.dialCode;
  const dividerColor: string = tok.divider;
  const phoneIconColor: string = tok.subtleText;

  return (
    <View style={componentStyles.wrap}>
      {label !== undefined && (
        <Text style={[componentStyles.label, { color: labelColor }]}>{label}</Text>
      )}

      {/* Input row */}
      <View
        style={[
          componentStyles.inputRow,
          {
            backgroundColor: tok.bg,
            borderColor,
          },
          !editable && componentStyles.disabled,
        ]}
      >
        {/* Country picker trigger */}
        <TouchableOpacity
          style={componentStyles.pickerBtn}
          onPress={() => {
            if (editable) setPickerOpen(true);
          }}
          activeOpacity={editable ? 0.7 : 1}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        >
          <Text style={componentStyles.flagText}>{country.flag}</Text>
          <Text style={[componentStyles.dialCode, { color: dialCodeColor }]}>
            +{country.dialCode}
          </Text>
          <ChevronDown size={14} color={chevronColor} strokeWidth={2.5} style={componentStyles.chevron} />
        </TouchableOpacity>

        {/* Divider */}
        <View style={[componentStyles.divider, { backgroundColor: dividerColor }]} />

        {/* Phone icon */}
        <Phone size={15} color={phoneIconColor} strokeWidth={2} style={componentStyles.phoneIcon} />

        {/* Number input */}
        <TextInput
          ref={inputRef}
          style={[componentStyles.numberInput, { color: textColor }]}
          value={value}
          onChangeText={handleChangeText}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
          keyboardType="phone-pad"
          placeholder={country.code === 'PH' ? '09xxxxxxxxx' : 'Phone number'}
          placeholderTextColor={tok.placeholder}
          editable={editable}
          autoCorrect={false}
          autoComplete="tel"
          textContentType="telephoneNumber"
          maxLength={inputMaxLength}
        />
      </View>

      {/* Error message */}
      {visibleError !== undefined && (
        <Text style={[componentStyles.errorText, { color: tok.errorText }]}>
          {visibleError}
        </Text>
      )}

      {/* Country picker modal */}
      <CountryPickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        selected={country}
        onSelect={handleCountrySelect}
        tok={tok}
        primaryColor={accent}
      />
    </View>
  );
}

const componentStyles = StyleSheet.create({
  wrap: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 10,
    overflow: 'hidden',
  },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 11,
    // minimum 44pt touch target height is covered by paddingVertical + text
  },
  flagText: {
    fontSize: 20,
    lineHeight: 24,
    marginRight: 5,
  },
  dialCode: {
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    marginRight: 2,
  },
  chevron: {
    marginLeft: 2,
  },
  divider: {
    width: 1,
    height: 28,
    marginHorizontal: 2,
  },
  phoneIcon: {
    marginLeft: 10,
    marginRight: 6,
  },
  numberInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 11,
    paddingRight: 14,
  },
  errorText: {
    fontSize: 11,
    marginTop: 3,
  },
  disabled: {
    opacity: 0.6,
  },
});

// ── Utility: build E.164 string from a country + local number ─────────────────
/**
 * Converts a local phone number and country to E.164 format.
 * Strips leading zeros and non-digits, prepends +dialCode.
 * Returns null if the result is outside the valid E.164 length range (7–15 digits).
 */
export function toE164(localNumber: string, country: Country): string | null {
  const digits = localNumber.trim().replace(/^0/, '').replace(/\D/g, '');
  const full = `+${country.dialCode}${digits}`;
  // E.164: + followed by 7–15 digits; subscriber portion must be at least 6 digits
  const minLen = country.dialCode.replace(/\D/g, '').length + 1 + 6; // + + dialCode + 6 subscriber
  if (full.length < minLen || !/^\+\d{7,15}$/.test(full)) return null;
  return full;
}

/**
 * Returns true if localNumber produces a syntactically valid E.164 number
 * when combined with the country's dial code.
 */
export function isValidPhoneNumber(localNumber: string, country: Country): boolean {
  return toE164(localNumber, country) !== null;
}
