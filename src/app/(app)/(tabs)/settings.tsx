/**
 * SettingsScreen
 *
 * App preferences, VAT configuration, appearance, notifications, and support.
 * Grouped into labeled sections with consistent row layout.
 *
 * Sections:
 *   1. App Preferences — dark mode toggle
 *   2. VAT Settings    — vatEnabled + isVatInclusiv
 * reads throughout
 *   - noUncheckedIndexedAccess: ?? fallbacks on all index access
 *   - noUnusedLocals: unused vars prefixed with _
 */

import React, { useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Switch,
  Pressable,
  Linking,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Moon,
  Sun,
  Bell,
  BellOff,
  ChevronRight,
  Receipt,
  ShieldCheck,
  FileText,
  HelpCircle,
  Info,
  Percent,
  ToggleRight,
  Globe,
  ExternalLink,
} from 'lucide-react-native';
import {
  useVatStore,
  selectVatEnabled,
  selectIsVatInclusive,
  useThemeStore,
} from '@/store';
import { useAppTheme, useThemeMode } from '@/core/theme';
import { theme as staticTheme } from '@/core/theme';
import { Text } from '@/components/atoms/Text';

// ── Section header ─────────────────────────────────────────────────────────────

interface SectionHeaderProps {
  title: string;
  isDark: boolean;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ title, isDark }) => (
  <Text
    variant="body-sm"
    weight="semibold"
    style={{
      color: isDark ? 'rgba(255,255,255,0.40)' : '#9CA3AF',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 8,
      marginLeft: 4,
    }}
  >
    {title}
  </Text>
);

// ── Settings group card ────────────────────────────────────────────────────────

interface GroupCardProps {
  children: React.ReactNode;
  isDark: boolean;
}

const GroupCard: React.FC<GroupCardProps> = ({ children, isDark }) => {
  const bg     = isDark ? '#1A2235' : '#FFFFFF';
  const border = isDark ? 'rgba(255,255,255,0.08)' : '#E5EAF2';

  return (
    <View
      style={[
        groupCardStyles.card,
        { backgroundColor: bg, borderColor: border },
      ]}
    >
      {children}
    </View>
  );
};

const groupCardStyles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#1E4D8C',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
    }),
  },
});

// ── Toggle row ─────────────────────────────────────────────────────────────────

interface ToggleRowProps {
  iconBg: string;
  icon: React.ReactNode;
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  thumbColor: string;
  trackActiveColor: string;
  isDark: boolean;
  isLast?: boolean;
  disabled?: boolean;
}

const ToggleRow: React.FC<ToggleRowProps> = ({
  iconBg,
  icon,
  label,
  description,
  value,
  onValueChange,
  thumbColor,
  trackActiveColor,
  isDark,
  isLast,
  disabled = false,
}) => {
  const dividerColor = isDark ? 'rgba(255,255,255,0.07)' : '#F0F4F8';
  const labelCl      = isDark ? '#F1F5F9' : '#1A3A6B';
  const descCl       = isDark ? 'rgba(255,255,255,0.40)' : '#9CA3AF';
  const trackInactive = isDark ? '#2A3347' : staticTheme.colors.gray[300];

  return (
    <View>
      <View style={toggleRowStyles.row}>
        <View style={[toggleRowStyles.iconPill, { backgroundColor: iconBg }]}>
          {icon}
        </View>
        <View style={toggleRowStyles.textCol}>
          <Text
            variant="body"
            weight="medium"
            style={{ color: disabled ? (isDark ? 'rgba(255,255,255,0.30)' : staticTheme.colors.disabled) : labelCl }}
          >
            {label}
          </Text>
          {description !== undefined && (
            <Text variant="body-xs" style={{ color: descCl, marginTop: 1 }}>
              {description}
            </Text>
          )}
        </View>
        <Switch
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          trackColor={{ false: trackInactive, true: trackActiveColor }}
          thumbColor={value ? thumbColor : (isDark ? '#3A4460' : staticTheme.colors.gray[100])}
          ios_backgroundColor={trackInactive}
          accessibilityLabel={label}
        />
      </View>
      {!isLast && (
        <View style={[toggleRowStyles.divider, { backgroundColor: dividerColor }]} />
      )}
    </View>
  );
};

const toggleRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    gap: 12,
  },
  iconPill: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 48,
  },
});

// ── Link row ───────────────────────────────────────────────────────────────────

interface LinkRowProps {
  iconBg: string;
  icon: React.ReactNode;
  label: string;
  description?: string;
  onPress: () => void;
  isDark: boolean;
  isLast?: boolean;
  rightLabel?: string;
  external?: boolean;
}

const LinkRow: React.FC<LinkRowProps> = ({
  iconBg,
  icon,
  label,
  description,
  onPress,
  isDark,
  isLast,
  rightLabel,
  external = false,
}) => {
  const dividerColor = isDark ? 'rgba(255,255,255,0.07)' : '#F0F4F8';
  const labelCl      = isDark ? '#F1F5F9' : '#1A3A6B';
  const descCl       = isDark ? 'rgba(255,255,255,0.40)' : '#9CA3AF';
  const chevronCl    = isDark ? 'rgba(255,255,255,0.25)' : '#D1DAE8';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        linkRowStyles.row,
        pressed && { opacity: 0.7 },
      ]}
    >
      <View style={[linkRowStyles.iconPill, { backgroundColor: iconBg }]}>
        {icon}
      </View>
      <View style={linkRowStyles.textCol}>
        <Text variant="body" weight="medium" style={{ color: labelCl }}>
          {label}
        </Text>
        {description !== undefined && (
          <Text variant="body-xs" style={{ color: descCl, marginTop: 1 }}>
            {description}
          </Text>
        )}
      </View>
      {rightLabel !== undefined && (
        <Text variant="body-sm" style={{ color: descCl, marginRight: 4 }}>
          {rightLabel}
        </Text>
      )}
      {external
        ? <ExternalLink size={15} color={chevronCl} />
        : <ChevronRight size={16} color={chevronCl} />
      }
      {!isLast && (
        <View
          style={[
            linkRowStyles.divider,
            { backgroundColor: dividerColor },
          ]}
        />
      )}
    </Pressable>
  );
};

const linkRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    gap: 12,
    position: 'relative',
  },
  iconPill: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
  },
  divider: {
    position: 'absolute',
    bottom: 0,
    left: 48,
    right: 0,
    height: StyleSheet.hairlineWidth,
  },
});

// ── VAT info banner ────────────────────────────────────────────────────────────

interface VatBannerProps {
  isDark: boolean;
}

const VatBanner: React.FC<VatBannerProps> = ({ isDark }) => {
  const bg     = isDark ? 'rgba(245,166,35,0.08)' : '#FFFBEB';
  const border = isDark ? 'rgba(245,166,35,0.20)' : '#FDE68A';
  const textCl = isDark ? '#FFB020' : staticTheme.colors.highlight[600];

  return (
    <View style={[vatBannerStyles.wrap, { backgroundColor: bg, borderColor: border }]}>
      <Info size={13} color={textCl} />
      <Text variant="body-xs" style={{ color: textCl, flex: 1, marginLeft: 6 }}>
        Philippines TRAIN Law — Standard 12% VAT applies to registered businesses
        with annual gross sales over ₱3 million.
      </Text>
    </View>
  );
};

const vatBannerStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    marginBottom: 8,
    gap: 4,
  },
});

// ── Main screen ────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const theme  = useAppTheme();
  const mode   = useThemeMode();
  const isDark = mode === 'dark';
  const insets = useSafeAreaInsets();

  // VAT state — preserved logic from original profile.tsx
  const vatEnabled      = useVatStore(selectVatEnabled);
  const isVatInclusive  = useVatStore(selectIsVatInclusive);
  const setVatEnabled   = useVatStore((s) => s.setVatEnabled);
  const setIsVatIncl    = useVatStore((s) => s.setIsVatInclusive);

  // Theme toggle
  const toggleMode = useThemeStore((s) => s.toggleMode);

  // Notification toggle (local state — placeholder until push implementation)
  const [notificationsEnabled, setNotificationsEnabled] = React.useState(true);

  // Derived colors
  const rootBg      = isDark ? '#0F1117' : '#F5F7FA';
  const primaryColor = isDark ? '#4F9EFF' : theme.colors.primary[500];
  const accentColor  = isDark ? '#3DD68C' : theme.colors.accent[500];
  const amberColor   = isDark ? '#FFB020' : theme.colors.highlight[400];
  const warnColor    = isDark ? '#FFB020' : staticTheme.colors.warning[500];
  const subtleCl     = isDark ? 'rgba(255,255,255,0.40)' : staticTheme.colors.textSecondary;

  const iconColors = useMemo(() => ({
    moon:    isDark ? '#4F9EFF' : staticTheme.colors.primary[500],
    bell:    isDark ? '#3DD68C' : staticTheme.colors.accent[500],
    vat:     isDark ? '#FFB020' : staticTheme.colors.warning[500],
    vatIncl: isDark ? '#F5A623' : staticTheme.colors.highlight[400],
    help:    isDark ? '#4F9EFF' : staticTheme.colors.primary[400],
    privacy: isDark ? '#3DD68C' : staticTheme.colors.accent[500],
    terms:   isDark ? '#94A3B8' : staticTheme.colors.gray[500],
    about:   isDark ? '#FFB020' : staticTheme.colors.highlight[400],
    lang:    isDark ? '#A78BFA' : '#7C3AED',
  }), [isDark]);

  const iconBgs = useMemo(() => ({
    moon:    isDark ? 'rgba(79,158,255,0.12)'   : '#EAF0FA',
    bell:    isDark ? 'rgba(61,214,140,0.12)'   : '#E9F7EF',
    vat:     isDark ? 'rgba(255,176,32,0.12)'   : '#FFFBEB',
    vatIncl: isDark ? 'rgba(245,166,35,0.12)'   : '#FEF7E8',
    help:    isDark ? 'rgba(79,158,255,0.12)'   : '#EAF0FA',
    privacy: isDark ? 'rgba(61,214,140,0.12)'   : '#E9F7EF',
    terms:   isDark ? 'rgba(148,163,184,0.10)'  : '#F3F4F6',
    about:   isDark ? 'rgba(255,176,32,0.12)'   : '#FEF7E8',
    lang:    isDark ? 'rgba(167,139,250,0.12)'  : '#F0EEFF',
  }), [isDark]);

  return (
    <View style={[styles.root, { backgroundColor: rootBg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: Math.max(insets.bottom + 24, 40) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Appearance ─────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader title="Appearance" isDark={isDark} />
          <GroupCard isDark={isDark}>
            <ToggleRow
              isDark={isDark}
              iconBg={iconBgs.moon}
              icon={isDark
                ? <Moon size={18} color={iconColors.moon} />
                : <Sun  size={18} color={iconColors.moon} />
              }
              label="Dark Mode"
              description={isDark ? 'Currently using dark theme' : 'Currently using light theme'}
              value={isDark}
              onValueChange={toggleMode}
              thumbColor={primaryColor}
              trackActiveColor={primaryColor}
              isLast
            />
          </GroupCard>
        </View>

        {/* ── VAT Settings ───────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader title="VAT Settings" isDark={isDark} />
          <VatBanner isDark={isDark} />
          <GroupCard isDark={isDark}>
            <ToggleRow
              isDark={isDark}
              iconBg={iconBgs.vat}
              icon={<Percent size={18} color={iconColors.vat} />}
              label="Apply VAT (12%)"
              description="Standard Philippine VAT — TRAIN Law"
              value={vatEnabled}
              onValueChange={setVatEnabled}
              thumbColor={warnColor}
              trackActiveColor={warnColor}
              {...(!vatEnabled ? { isLast: true } : {})}
            />
            {vatEnabled && (
              <ToggleRow
                isDark={isDark}
                iconBg={iconBgs.vatIncl}
                icon={<Receipt size={18} color={iconColors.vatIncl} />}
                label="VAT-Inclusive Prices"
                description="Prices already include 12% VAT"
                value={isVatInclusive}
                onValueChange={setIsVatIncl}
                thumbColor={amberColor}
                trackActiveColor={amberColor}
                isLast
              />
            )}
          </GroupCard>
        </View>

        {/* ── Notifications ───────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader title="Notifications" isDark={isDark} />
          <GroupCard isDark={isDark}>
            <ToggleRow
              isDark={isDark}
              iconBg={iconBgs.bell}
              icon={notificationsEnabled
                ? <Bell    size={18} color={iconColors.bell} />
                : <BellOff size={18} color={iconColors.bell} />
              }
              label="Push Notifications"
              description="Low-stock alerts, daily summaries"
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              thumbColor={accentColor}
              trackActiveColor={accentColor}
              isLast
            />
          </GroupCard>
        </View>

        {/* ── Localization ───────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader title="Localization" isDark={isDark} />
          <GroupCard isDark={isDark}>
            <LinkRow
              isDark={isDark}
              iconBg={iconBgs.lang}
              icon={<Globe size={18} color={iconColors.lang} />}
              label="Language"
              description="App display language"
              rightLabel="English"
              onPress={() => {}}
              isLast
            />
          </GroupCard>
        </View>

        {/* ── Support & About ─────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader title="Support & About" isDark={isDark} />
          <GroupCard isDark={isDark}>
            <LinkRow
              isDark={isDark}
              iconBg={iconBgs.help}
              icon={<HelpCircle size={18} color={iconColors.help} />}
              label="Help & Support"
              description="FAQs, contact support"
              onPress={() => {}}
            />
            <LinkRow
              isDark={isDark}
              iconBg={iconBgs.privacy}
              icon={<ShieldCheck size={18} color={iconColors.privacy} />}
              label="Privacy Policy"
              onPress={() => Linking.openURL('https://panindio.app/privacy').catch(() => {})}
              external
            />
            <LinkRow
              isDark={isDark}
              iconBg={iconBgs.terms}
              icon={<FileText size={18} color={iconColors.terms} />}
              label="Terms of Service"
              onPress={() => Linking.openURL('https://panindio.app/terms').catch(() => {})}
              external
            />
            <LinkRow
              isDark={isDark}
              iconBg={iconBgs.about}
              icon={<Info size={18} color={iconColors.about} />}
              label="About"
              description="Version, build info"
              rightLabel="v1.0.0"
              onPress={() => {}}
              isLast
            />
          </GroupCard>
        </View>

        {/* ── App version footer ─────────────────────────────────────────── */}
        <View style={styles.footer}>
          <View style={[styles.footerPill, { backgroundColor: isDark ? '#1A2235' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E5EAF2' }]}>
            <ToggleRight size={14} color={isDark ? '#4F9EFF' : theme.colors.primary[400]} />
            <Text
              variant="body-xs"
              style={{ color: subtleCl, marginLeft: 6 }}
            >
              SME Panindio  •  Expo SDK 54  •  RN 0.81.5
            </Text>
          </View>
          <Text
            variant="caption"
            style={{ color: isDark ? 'rgba(255,255,255,0.20)' : staticTheme.colors.gray[400], marginTop: 8, textAlign: 'center' }}
          >
            Built with love for Filipino small businesses
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ── Static styles (layout only — no colors) ────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  section: {
    marginBottom: 20,
  },
  footer: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 8,
    gap: 0,
  },
  footerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
});
