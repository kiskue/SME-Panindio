/**
 * DatePickerField
 *
 * A hybrid date-input molecule that lets the user either type a date manually
 * (MM/DD/YYYY with auto-masking) or open the native OS date picker via a
 * calendar icon button.
 *
 * Platform behaviour:
 *   Android — opens the native date picker dialog (DateTimePickerAndroid).
 *             The text field stays fully editable in parallel.
 *   iOS     — renders an inline DateTimePicker directly below the text field
 *             when the calendar icon is tapped. A "Done" button dismisses it.
 *
 * Controlled API (standalone, no RHF):
 *   value        ISO 8601 date string  (YYYY-MM-DD) or ''
 *   onChange     (isoDate: string) => void
 *
 * RHF integration:
 *   Use the sibling <DatePickerFormField> which wraps this in a Controller.
 *
 * Design tokens follow the same INPUT_DARK / INPUT_LIGHT pattern as Input.tsx
 * so the field is visually consistent with the rest of the form system.
 *
 * TypeScript constraints honoured:
 *   exactOptionalPropertyTypes — no prop: undefined, conditional spread used
 *   noUncheckedIndexedAccess   — ?? fallback on all index access
 *   noUnusedLocals/Params      — unused params prefixed _
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  Modal,
  Text as RNText,
} from 'react-native';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { CalendarDays, X } from 'lucide-react-native';
import { theme as staticTheme } from '../../../core/theme';
import { useThemeStore, selectThemeMode } from '../../../store/theme.store';

// ── Design tokens ─────────────────────────────────────────────────────────────
// Mirrors the token structure in Input.tsx so forms look visually uniform.

const DARK = {
  bg:           '#1E2435',
  border:       'rgba(255,255,255,0.12)',
  borderFocus:  'rgba(255,255,255,0.30)',
  borderError:  staticTheme.colors.error[500],
  text:         'rgba(255,255,255,0.90)',
  textDisabled: 'rgba(255,255,255,0.35)',
  placeholder:  'rgba(255,255,255,0.35)',
  label:        'rgba(255,255,255,0.60)',
  helper:       'rgba(255,255,255,0.40)',
  icon:         'rgba(255,255,255,0.50)',
  // iOS picker overlay
  iosOverlay:   '#0F172A',
  iosSheet:     '#1C2333',
  iosDoneText:  '#4F9EFF',
  iosTitle:     'rgba(255,255,255,0.80)',
} as const;

const LIGHT = {
  bg:           '#F8F9FC',
  border:       '#E2E8F0',
  borderFocus:  staticTheme.colors.primary[500],
  borderError:  staticTheme.colors.error[500],
  text:         staticTheme.colors.gray[900],
  textDisabled: staticTheme.colors.gray[500],
  placeholder:  staticTheme.colors.gray[400],
  label:        staticTheme.colors.gray[700],
  helper:       staticTheme.colors.gray[500],
  icon:         staticTheme.colors.gray[400],
  iosOverlay:   'rgba(0,0,0,0.40)',
  iosSheet:     '#FFFFFF',
  iosDoneText:  staticTheme.colors.primary[500],
  iosTitle:     staticTheme.colors.gray[700],
} as const;

// ── Date helpers ──────────────────────────────────────────────────────────────

/**
 * Parse an ISO date string (YYYY-MM-DD) into a Date object, clamped to the
 * local timezone. Returns the current date when the string is empty or invalid.
 */
function isoToDate(iso: string): Date {
  if (!iso) return new Date();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return new Date();
  // Destructure with fallbacks to satisfy noUncheckedIndexedAccess
  const year  = parseInt(match[1] ?? '1970', 10);
  const month = parseInt(match[2] ?? '01',   10) - 1; // JS months 0-indexed
  const day   = parseInt(match[3] ?? '01',   10);
  const d = new Date(year, month, day);
  // Guard against invalid dates (e.g. Feb 30)
  if (isNaN(d.getTime())) return new Date();
  return d;
}

/**
 * Format a Date to ISO 8601 YYYY-MM-DD local-timezone string.
 */
function dateToIso(d: Date): string {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/**
 * Convert a raw ISO string to a MM/DD/YYYY display string.
 * Returns '' when the iso string is empty.
 */
function isoToDisplay(iso: string): string {
  if (!iso) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso; // partial / non-conforming — pass through
  const m  = match[2] ?? '';
  const d  = match[3] ?? '';
  const y  = match[1] ?? '';
  return `${m}/${d}/${y}`;
}

/**
 * Apply a MM/DD/YYYY digit mask to raw input text.
 *
 * Rules:
 *   - Only digits allowed; all non-digit characters are stripped.
 *   - Auto-inserts '/' after MM (position 2) and DD (position 4).
 *   - Caps total length at 10 characters (MM/DD/YYYY).
 */
function applyDateMask(raw: string): string {
  // Strip all non-digit characters.
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/**
 * Parse a MM/DD/YYYY display string back to an ISO date string.
 * Returns '' when the display value is incomplete or invalid.
 */
function displayToIso(display: string): string {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display);
  if (!match) return '';
  const month = match[1] ?? '01';
  const day   = match[2] ?? '01';
  const year  = match[3] ?? '1970';
  // Validate calendar correctness before accepting
  const d = new Date(
    parseInt(year,  10),
    parseInt(month, 10) - 1,
    parseInt(day,   10),
  );
  if (
    isNaN(d.getTime())      ||
    d.getFullYear()  !== parseInt(year,  10) ||
    d.getMonth() + 1 !== parseInt(month, 10) ||
    d.getDate()      !== parseInt(day,   10)
  ) {
    return '';
  }
  return `${year}-${month}-${day}`;
}

// ── Component props ───────────────────────────────────────────────────────────

export interface DatePickerFieldProps {
  /**
   * Current value as an ISO 8601 date string (YYYY-MM-DD).
   * Pass '' when no date is selected.
   */
  value: string;
  /** Called with a YYYY-MM-DD ISO string on every valid change, or '' on clear. */
  onChange: (isoDate: string) => void;
  /** Field label displayed above the input. */
  label?: string;
  /** Placeholder shown in the text input. Defaults to "MM/DD/YYYY". */
  placeholder?: string;
  /** Validation error message shown below the field. */
  error?: string;
  /** Helper text shown below the field when there is no error. */
  helperText?: string;
  /** Disables the input and calendar icon. */
  disabled?: boolean;
  /** Earliest selectable date (inclusive). */
  minimumDate?: Date;
  /** Latest selectable date (inclusive). */
  maximumDate?: Date;
  /** accessibilityLabel forwarded to the text input. */
  accessibilityLabel?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const DatePickerField: React.FC<DatePickerFieldProps> = ({
  value,
  onChange,
  label,
  placeholder = 'MM/DD/YYYY',
  error,
  helperText,
  disabled = false,
  minimumDate,
  maximumDate,
  accessibilityLabel,
}) => {
  const mode   = useThemeStore(selectThemeMode);
  const isDark = mode === 'dark';
  const tok    = isDark ? DARK : LIGHT;

  // ── Local state ────────────────────────────────────────────────────────────

  // displayText is always what the TextInput shows — MM/DD/YYYY format.
  // We derive it from the external `value` prop on first render but let the
  // user edit it freely. When editing completes (blur), we push the ISO value
  // back up via onChange.
  const [displayText, setDisplayText] = useState<string>(() => isoToDisplay(value));
  const [isFocused,   setIsFocused]   = useState(false);
  // iOS inline picker visibility
  const [iosPickerOpen, setIosPickerOpen] = useState(false);

  // Keep displayText in sync when the external value changes from outside
  // (e.g. form reset) without overwriting what the user is actively typing.
  const prevValue = React.useRef(value);
  if (prevValue.current !== value && !isFocused) {
    prevValue.current = value;
    setDisplayText(isoToDisplay(value));
  }

  // ── Derived styles (memoised to avoid re-creation on every render) ─────────

  const borderColor: string = useMemo(() => {
    if (error)    return tok.borderError;
    if (isFocused) return tok.borderFocus;
    return tok.border;
  }, [error, isFocused, tok]);

  const selectedDate: Date = useMemo(() => isoToDate(value), [value]);

  // ── Text input change handler ──────────────────────────────────────────────

  const handleTextChange = useCallback((raw: string) => {
    const masked = applyDateMask(raw);
    setDisplayText(masked);
    // Only propagate when the full MM/DD/YYYY pattern is satisfied
    const iso = displayToIso(masked);
    if (iso !== '') {
      onChange(iso);
    } else if (masked === '') {
      onChange('');
    }
    // Partial input — don't fire onChange until complete
  }, [onChange]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    // On blur with a partial / invalid mask, clear the field and notify parent
    const iso = displayToIso(displayText);
    if (iso === '' && displayText !== '') {
      // Invalid partial — clear both display and value
      setDisplayText('');
      onChange('');
    }
  }, [displayText, onChange]);

  // ── Native picker handlers ─────────────────────────────────────────────────

  const handleCalendarPress = useCallback(() => {
    if (disabled) return;
    if (Platform.OS === 'android') {
      // Dynamic import avoids the module being required on iOS paths before
      // the DateTimePickerAndroid API is available.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { DateTimePickerAndroid } = require('@react-native-community/datetimepicker') as {
        DateTimePickerAndroid: {
          open: (options: {
            value: Date;
            onChange: (event: DateTimePickerEvent, date?: Date) => void;
            mode: 'date';
            display?: 'default' | 'spinner' | 'calendar';
            minimumDate?: Date;
            maximumDate?: Date;
          }) => void;
        };
      };
      DateTimePickerAndroid.open({
        value:    selectedDate,
        onChange: (_event: DateTimePickerEvent, date?: Date) => {
          if (date !== undefined) {
            const iso = dateToIso(date);
            onChange(iso);
            setDisplayText(isoToDisplay(iso));
          }
        },
        mode:    'date',
        display: 'calendar',
        ...(minimumDate !== undefined ? { minimumDate } : {}),
        ...(maximumDate !== undefined ? { maximumDate } : {}),
      });
    } else {
      setIosPickerOpen(true);
    }
  }, [disabled, selectedDate, onChange, minimumDate, maximumDate]);

  const handleIosChange = useCallback(
    (_event: DateTimePickerEvent, date?: Date) => {
      if (date !== undefined) {
        const iso = dateToIso(date);
        onChange(iso);
        setDisplayText(isoToDisplay(iso));
      }
    },
    [onChange],
  );

  const handleIosDone = useCallback(() => {
    setIosPickerOpen(false);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

  // Derived style values as plain strings (satisfies TypeScript strict mode on
  // StyleSheet.create / inline style assignments).
  const labelColor: string  = error ? tok.borderError : tok.label;
  const helperColor: string = error ? tok.borderError : tok.helper;
  const textColor: string   = disabled ? tok.textDisabled : tok.text;
  const iconColor: string   = disabled ? tok.textDisabled : tok.icon;

  return (
    <View style={styles.wrapper}>
      {/* ── Label ────────────────────────────────────────────────────── */}
      {label !== undefined && label !== '' && (
        <RNText style={[styles.label, { color: labelColor }]}>
          {label}
        </RNText>
      )}

      {/* ── Input row ────────────────────────────────────────────────── */}
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: tok.bg,
            borderColor,
          },
          disabled && styles.disabled,
        ]}
        accessibilityRole="none"
      >
        {/* Left calendar icon (tap target for opening the picker) */}
        <Pressable
          onPress={handleCalendarPress}
          style={styles.calendarBtn}
          accessibilityRole="button"
          accessibilityLabel="Open date picker"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
          {...(disabled ? { accessibilityState: { disabled: true } } : {})}
        >
          <CalendarDays size={18} color={iconColor} />
        </Pressable>

        {/* Text input for manual entry */}
        <TextInput
          style={[styles.input, { color: textColor }]}
          value={displayText}
          onChangeText={handleTextChange}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
          placeholder={placeholder}
          placeholderTextColor={tok.placeholder}
          keyboardType="number-pad"
          maxLength={10}
          editable={!disabled}
          accessibilityRole="text"
          {...(accessibilityLabel !== undefined
            ? { accessibilityLabel }
            : { accessibilityLabel: label ?? 'Date field' }
          )}
          accessibilityHint="Type MM/DD/YYYY or tap the calendar icon to pick a date"
        />

        {/* Clear button — shown only when there is a value */}
        {value !== '' && !disabled && (
          <Pressable
            onPress={() => {
              setDisplayText('');
              onChange('');
            }}
            style={styles.clearBtn}
            accessibilityRole="button"
            accessibilityLabel="Clear date"
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
          >
            <X size={14} color={tok.icon} />
          </Pressable>
        )}
      </View>

      {/* ── Helper / error text ───────────────────────────────────────── */}
      {(error !== undefined || helperText !== undefined) && (
        <RNText style={[styles.helperText, { color: helperColor }]}>
          {error ?? helperText}
        </RNText>
      )}

      {/* ── iOS inline picker sheet ───────────────────────────────────── */}
      {Platform.OS === 'ios' && iosPickerOpen && (
        <Modal
          transparent
          animationType="slide"
          visible={iosPickerOpen}
          onRequestClose={handleIosDone}
          statusBarTranslucent
        >
          {/* Backdrop */}
          <Pressable
            style={[styles.iosBackdrop, { backgroundColor: tok.iosOverlay }]}
            onPress={handleIosDone}
            accessibilityRole="button"
            accessibilityLabel="Close date picker"
          />

          {/* Sheet */}
          <View style={[styles.iosSheet, { backgroundColor: tok.iosSheet }]}>
            {/* Sheet toolbar */}
            <View style={styles.iosToolbar}>
              <RNText style={[styles.iosTitle, { color: tok.iosTitle }]}>
                {label ?? 'Select Date'}
              </RNText>
              <Pressable
                onPress={handleIosDone}
                style={styles.iosDoneBtn}
                accessibilityRole="button"
                accessibilityLabel="Done"
                hitSlop={{ top: 8, bottom: 8, left: 16, right: 8 }}
              >
                <RNText style={[styles.iosDoneText, { color: tok.iosDoneText }]}>
                  Done
                </RNText>
              </Pressable>
            </View>

            {/* Native picker */}
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display="inline"
              onChange={handleIosChange}
              textColor={isDark ? '#FFFFFF' : staticTheme.colors.gray[900]}
              accentColor={isDark ? '#4F9EFF' : staticTheme.colors.primary[500]}
              themeVariant={isDark ? 'dark' : 'light'}
              {...(minimumDate !== undefined ? { minimumDate } : {})}
              {...(maximumDate !== undefined ? { maximumDate } : {})}
            />
          </View>
        </Modal>
      )}
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: staticTheme.spacing.md,
  },
  label: {
    fontSize:     staticTheme.typography.sizes.sm,
    fontWeight:   staticTheme.typography.weights.medium,
    marginBottom: staticTheme.spacing.xs,
  },
  inputContainer: {
    flexDirection:  'row',
    alignItems:     'center',
    borderWidth:    1,
    borderRadius:   staticTheme.borderRadius.md,
    // min height enforces the 44pt touch target on the row itself
    minHeight:      48,
    paddingHorizontal: 4,
  },
  calendarBtn: {
    width:           40,
    height:          44,
    alignItems:      'center',
    justifyContent:  'center',
  },
  input: {
    flex:            1,
    height:          44,
    fontSize:        staticTheme.typography.sizes.base,
    fontFamily:      staticTheme.typography.fontFamily,
    paddingVertical: 0, // let height control vertical centering
  },
  clearBtn: {
    width:           36,
    height:          44,
    alignItems:      'center',
    justifyContent:  'center',
  },
  helperText: {
    fontSize:  staticTheme.typography.sizes.xs,
    marginTop: staticTheme.spacing.xs,
  },
  disabled: {
    opacity: 0.55,
  },
  // ── iOS picker styles ─────────────────────────────────────────────────────
  iosBackdrop: {
    flex: 1,
  },
  iosSheet: {
    borderTopLeftRadius:  16,
    borderTopRightRadius: 16,
    // shadow
    shadowColor:   '#000000',
    shadowOffset:  { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius:  12,
    elevation:     16,
    overflow:      'hidden',
  },
  iosToolbar: {
    flexDirection:    'row',
    alignItems:       'center',
    justifyContent:   'space-between',
    paddingHorizontal: staticTheme.spacing.md,
    paddingVertical:   staticTheme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.25)',
  },
  iosTitle: {
    fontSize:   staticTheme.typography.sizes.base,
    fontWeight: staticTheme.typography.weights.semibold,
  },
  iosDoneBtn: {
    paddingVertical:   staticTheme.spacing.xs,
    paddingHorizontal: staticTheme.spacing.sm,
    minWidth:          44,
    minHeight:         44,
    alignItems:        'center',
    justifyContent:    'center',
  },
  iosDoneText: {
    fontSize:   staticTheme.typography.sizes.base,
    fontWeight: staticTheme.typography.weights.semibold,
  },
});
