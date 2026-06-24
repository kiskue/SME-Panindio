/**
 * ProfileScreen
 *
 * User identity and account details screen.
 * Displays avatar, personal info, business info, account details, and logout.
 *
 * Design:
 *   - Hero section: gradient banner with floating avatar card
 *   - Identity card: name, role badge, email
 *   - Business info section: business name, type, operation mode
 *   - Account details section: user ID, role, joined date
 *   - Danger zone: sign out button
 *
 * TypeScript constraints:
 *   - exactOptionalPropertyTypes: conditional spreads throughout
 *   - noUncheckedIndexedAccess: ?? fallbacks on all index access
 *   - noUnusedLocals: unused vars prefixed with _
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  TouchableOpacity,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  User,
  Mail,
  Briefcase,
  Building2,
  Shield,
  LogOut,
  ChevronRight,
  Store,
  Hash,
  Calendar,
  BadgeCheck,
  Bell,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useAuthStore, selectCurrentUser } from '@/store';
import { useAppTheme, useThemeMode } from '@/core/theme';
import { theme as staticTheme } from '@/core/theme';
import { Text } from '@/components/atoms/Text';
import { Button } from '@/components/atoms/Button';
import { useAppDialog } from '@/hooks';

// ── Role badge config ──────────────────────────────────────────────────────────

interface RoleBadge { label: string; color: string; bg: string }

const DEFAULT_ROLE: RoleBadge = { label: 'User', color: '#27AE60', bg: '#E9F7EF' };
const DEFAULT_ROLE_DARK: RoleBadge = { label: 'User', color: '#3DD68C', bg: 'rgba(61,214,140,0.15)' };

const ROLE_CONFIG: Record<string, RoleBadge> = {
  admin:  { label: 'Admin',  color: '#1E4D8C', bg: '#EAF0FA' },
  user:   { label: 'User',   color: '#27AE60', bg: '#E9F7EF' },
  viewer: { label: 'Viewer', color: '#F5A623', bg: '#FEF7E8' },
};

const ROLE_CONFIG_DARK: Record<string, RoleBadge> = {
  admin:  { label: 'Admin',  color: '#4F9EFF', bg: 'rgba(79,158,255,0.15)'  },
  user:   { label: 'User',   color: '#3DD68C', bg: 'rgba(61,214,140,0.15)'  },
  viewer: { label: 'Viewer', color: '#FFB020', bg: 'rgba(255,176,32,0.15)'  },
};

// ── Stat row item ──────────────────────────────────────────────────────────────

interface StatItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  isDark: boolean;
}

const StatItem: React.FC<StatItemProps> = ({ icon, label, value, isDark }) => {
  const bg      = isDark ? '#1A2235' : '#FFFFFF';
  const border  = isDark ? 'rgba(255,255,255,0.08)' : '#E5EAF2';
  const labelCl = isDark ? 'rgba(255,255,255,0.45)' : '#6B7280';
  const valueCl = isDark ? '#F1F5F9' : '#1A3A6B';

  return (
    <View style={[
      statItemStyles.wrap,
      { backgroundColor: bg, borderColor: border },
    ]}>
      <View style={statItemStyles.iconWrap}>{icon}</View>
      <Text
        variant="body-xs"
        style={{ color: labelCl, marginTop: 4, textAlign: 'center' }}
      >
        {label}
      </Text>
      <Text
        variant="body-sm"
        weight="semibold"
        style={{ color: valueCl, textAlign: 'center' }}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
};

const statItemStyles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    gap: 2,
    ...Platform.select({
      ios: {
        shadowColor: '#1E4D8C',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
      },
      android: { elevation: 2 },
    }),
  },
  iconWrap: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ── Info row ──────────────────────────────────────────────────────────────────

interface InfoRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  isDark: boolean;
  isLast?: boolean;
}

const InfoRow: React.FC<InfoRowProps> = ({ icon, label, value, isDark, isLast }) => {
  const dividerColor = isDark ? 'rgba(255,255,255,0.07)' : '#F0F4F8';
  const labelCl      = isDark ? 'rgba(255,255,255,0.45)' : '#6B7280';
  const valueCl      = isDark ? '#F1F5F9' : '#1A3A6B';

  return (
    <View>
      <View style={infoRowStyles.row}>
        <View style={infoRowStyles.iconCol}>{icon}</View>
        <Text
          variant="body-sm"
          style={{ color: labelCl, width: 110 }}
        >
          {label}
        </Text>
        <Text
          variant="body-sm"
          weight="medium"
          style={{ color: valueCl, flex: 1 }}
          numberOfLines={1}
        >
          {value}
        </Text>
      </View>
      {!isLast && (
        <View style={[infoRowStyles.divider, { backgroundColor: dividerColor }]} />
      )}
    </View>
  );
};

const infoRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  iconCol: {
    width: 20,
    alignItems: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 44,
  },
});

// ── Section card ──────────────────────────────────────────────────────────────

interface SectionCardProps {
  children: React.ReactNode;
  isDark: boolean;
}

const SectionCard: React.FC<SectionCardProps> = ({ children, isDark }) => {
  const bg     = isDark ? '#1A2235' : '#FFFFFF';
  const border = isDark ? 'rgba(255,255,255,0.08)' : '#E5EAF2';

  return (
    <View style={[
      sectionCardStyles.card,
      { backgroundColor: bg, borderColor: border },
    ]}>
      {children}
    </View>
  );
};

const sectionCardStyles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
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

// ── Section header ────────────────────────────────────────────────────────────

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

// ── Menu row (for navigable items) ───────────────────────────────────────────

interface MenuRowProps {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  description?: string;
  onPress: () => void;
  isDark: boolean;
  isLast?: boolean;
}

const MenuRow: React.FC<MenuRowProps> = ({
  icon,
  iconBg,
  label,
  description,
  onPress,
  isDark,
  isLast,
}) => {
  const dividerColor = isDark ? 'rgba(255,255,255,0.07)' : '#F0F4F8';
  const labelCl      = isDark ? '#F1F5F9' : '#1A3A6B';
  const descCl       = isDark ? 'rgba(255,255,255,0.40)' : '#9CA3AF';
  const chevronCl    = isDark ? 'rgba(255,255,255,0.25)' : '#D1DAE8';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        menuRowStyles.row,
        pressed && { opacity: 0.7 },
      ]}
    >
      <View style={[menuRowStyles.iconPill, { backgroundColor: iconBg }]}>
        {icon}
      </View>
      <View style={menuRowStyles.textCol}>
        <Text variant="body" weight="medium" style={{ color: labelCl }}>
          {label}
        </Text>
        {description !== undefined && (
          <Text variant="body-xs" style={{ color: descCl, marginTop: 1 }}>
            {description}
          </Text>
        )}
      </View>
      <ChevronRight size={16} color={chevronCl} />
      {!isLast && (
        <View
          style={[
            menuRowStyles.divider,
            { backgroundColor: dividerColor },
          ]}
        />
      )}
    </Pressable>
  );
};

const menuRowStyles = StyleSheet.create({
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

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { t }       = useTranslation();
  const user        = useAuthStore(selectCurrentUser);
  const { logout }  = useAuthStore();
  const theme       = useAppTheme();
  const mode        = useThemeMode();
  const isDark      = mode === 'dark';
  const insets      = useSafeAreaInsets();
  const dialog      = useAppDialog();

  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    dialog.confirm({
      title:       t('profile.signOut'),
      message:     t('profile.signOutConfirm'),
      confirmText: t('profile.signOut'),
      cancelText:  t('common.cancel'),
      onConfirm: async () => {
        setIsLoggingOut(true);
        try {
          await logout();
        } catch (_error) {
          dialog.show({
            variant: 'error',
            title:   t('common.error'),
            message: t('common.tryAgain'),
          });
        } finally {
          setIsLoggingOut(false);
        }
      },
    });
  };

  // Derived display values
  const displayName  = user?.name ?? 'User';
  const initials     = displayName.split(' ').map(w => w[0] ?? '').join('').slice(0, 2).toUpperCase();
  const displayEmail = user?.email ?? '';
  const roleKey      = user?.role ?? 'user';
  const roleConfig: RoleBadge = isDark
    ? (ROLE_CONFIG_DARK[roleKey] ?? DEFAULT_ROLE_DARK)
    : (ROLE_CONFIG[roleKey] ?? DEFAULT_ROLE);

  // ── Dynamic colors ──────────────────────────────────────────────────────────
  const rootBg      = isDark ? '#0F1117' : '#F5F7FA';
  const heroBg      = isDark ? '#151A27' : '#FFFFFF';
  const heroBorder  = isDark ? 'rgba(255,255,255,0.08)' : '#E5EAF2';
  const avatarBg    = isDark ? '#1E2D50' : theme.colors.primary[500];
  const avatarBorder = isDark ? 'rgba(79,158,255,0.30)' : theme.colors.primary[100];
  const primaryColor = isDark ? '#4F9EFF' : theme.colors.primary[500];
  const subtleCl    = isDark ? 'rgba(255,255,255,0.50)' : theme.colors.textSecondary;
  const dangerBg    = isDark ? 'rgba(239,68,68,0.08)' : '#FFF5F5';
  const dangerBorder = isDark ? 'rgba(239,68,68,0.25)' : '#FFD6D6';

  const iconColor = useMemo(
    () => isDark ? 'rgba(255,255,255,0.50)' : staticTheme.colors.gray[400],
    [isDark],
  );

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
        {/* ── Hero card ─────────────────────────────────────────────────── */}
        <View style={[
          styles.heroCard,
          { backgroundColor: heroBg, borderColor: heroBorder },
        ]}>
          {/* Top accent bar */}
          <View style={[
            styles.heroAccentBar,
            { backgroundColor: primaryColor },
          ]} />

          {/* Avatar */}
          <View style={styles.avatarWrapper}>
            <View style={[
              styles.avatarOuter,
              { borderColor: avatarBorder },
            ]}>
              <View style={[
                styles.avatarInner,
                { backgroundColor: avatarBg },
              ]}>
                <Text style={[styles.avatarText, { color: '#FFFFFF' }]}>
                  {initials}
                </Text>
              </View>
            </View>
          </View>

          {/* Identity */}
          <View style={styles.identityBlock}>
            <Text
              variant="h4"
              weight="bold"
              style={{ color: isDark ? '#F1F5F9' : staticTheme.colors.text, textAlign: 'center' }}
            >
              {displayName}
            </Text>

            {/* Role badge */}
            <View style={[
              styles.roleBadge,
              { backgroundColor: roleConfig.bg },
            ]}>
              <BadgeCheck size={12} color={roleConfig.color} />
              <Text
                variant="body-xs"
                weight="semibold"
                style={{ color: roleConfig.color, marginLeft: 4 }}
              >
                {roleConfig.label}
              </Text>
            </View>

            <Text
              variant="body-sm"
              style={{ color: subtleCl, marginTop: 4, textAlign: 'center' }}
            >
              {displayEmail}
            </Text>
          </View>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <StatItem
              isDark={isDark}
              icon={<Building2 size={16} color={primaryColor} />}
              label={t('profile.business')}
              value={user?.businessName ?? '—'}
            />
            <StatItem
              isDark={isDark}
              icon={<Briefcase size={16} color={isDark ? '#3DD68C' : staticTheme.colors.accent[500]} />}
              label={t('profile.jobRole')}
              value={user?.jobRoleName ?? '—'}
            />
            <StatItem
              isDark={isDark}
              icon={<Store size={16} color={isDark ? '#FFB020' : staticTheme.colors.highlight[400]} />}
              label={t('profile.mode')}
              value={user?.businessOperationMode === 'production' ? t('profile.production') : t('profile.reseller')}
            />
          </View>
        </View>

        {/* ── Account Details ────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader title={t('profile.accountDetails')} isDark={isDark} />
          <SectionCard isDark={isDark}>
            {/* Business ID — tappable to copy */}
            {user?.id !== undefined && (
              <TouchableOpacity
                onPress={async () => {
                  await Clipboard.setStringAsync(user.id);
                  dialog.show({ variant: 'success', title: 'Copied', message: 'Business ID copied to clipboard.' });
                }}
                activeOpacity={0.7}
              >
                <View style={infoRowStyles.row}>
                  <View style={infoRowStyles.iconCol}>
                    <Hash size={16} color={iconColor} />
                  </View>
                  <Text variant="body-sm" style={{ color: isDark ? 'rgba(255,255,255,0.45)' : '#6B7280', width: 110 }}>
                    Business ID
                  </Text>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text
                      variant="body-sm"
                      weight="medium"
                      style={{ color: isDark ? '#F1F5F9' : '#1A3A6B', fontFamily: 'monospace', fontSize: 11 }}
                      numberOfLines={1}
                    >
                      {user.id}
                    </Text>
                    <View style={[styles.copyChip, { backgroundColor: isDark ? 'rgba(79,158,255,0.15)' : '#EAF0FA' }]}>
                      <Text variant="body-xs" style={{ color: isDark ? '#4F9EFF' : '#1E4D8C', fontWeight: '700' }}>
                        Copy
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={[infoRowStyles.divider, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#F0F4F8' }]} />
              </TouchableOpacity>
            )}
            <InfoRow
              isDark={isDark}
              icon={<Hash size={16} color={iconColor} />}
              label={t('profile.userId')}
              value={user?.id ? `#${user.id.slice(0, 8)}...` : '—'}
            />
            <InfoRow
              isDark={isDark}
              icon={<Mail size={16} color={iconColor} />}
              label={t('profile.email')}
              value={displayEmail || '—'}
            />
            <InfoRow
              isDark={isDark}
              icon={<User size={16} color={iconColor} />}
              label={t('profile.fullName')}
              value={displayName}
            />
            <InfoRow
              isDark={isDark}
              icon={<Shield size={16} color={iconColor} />}
              label={t('profile.role')}
              value={roleConfig.label}
            />
            <InfoRow
              isDark={isDark}
              icon={<Calendar size={16} color={iconColor} />}
              label={t('profile.businessType')}
              value={user?.businessTypeName ?? '—'}
              isLast
            />
          </SectionCard>
        </View>

        {/* ── Business Info ──────────────────────────────────────────────── */}
        {(user?.businessName !== undefined || user?.businessTypeName !== undefined) && (
          <View style={styles.section}>
            <SectionHeader title={t('profile.businessInfo')} isDark={isDark} />
            <SectionCard isDark={isDark}>
              <InfoRow
                isDark={isDark}
                icon={<Store size={16} color={iconColor} />}
                label={t('profile.business')}
                value={user?.businessName ?? '—'}
              />
              <InfoRow
                isDark={isDark}
                icon={<Building2 size={16} color={iconColor} />}
                label={t('profile.businessType')}
                value={user?.businessTypeName ?? '—'}
              />
              <InfoRow
                isDark={isDark}
                icon={<Briefcase size={16} color={iconColor} />}
                label={t('profile.operation')}
                value={user?.businessOperationMode === 'production' ? t('profile.production') : t('profile.reseller')}
                isLast
              />
            </SectionCard>
          </View>
        )}

        {/* ── Quick actions ──────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader title={t('profile.accountActions')} isDark={isDark} />
          <SectionCard isDark={isDark}>
            <MenuRow
              isDark={isDark}
              icon={<Shield size={18} color={isDark ? '#4F9EFF' : staticTheme.colors.primary[500]} />}
              iconBg={isDark ? 'rgba(79,158,255,0.12)' : '#EAF0FA'}
              label={t('profile.privacySec')}
              description={t('profile.privacyDesc')}
              onPress={() => {}}
            />
            <MenuRow
              isDark={isDark}
              icon={<Bell size={18} color={isDark ? '#3DD68C' : staticTheme.colors.accent[500]} />}
              iconBg={isDark ? 'rgba(61,214,140,0.12)' : '#E9F7EF'}
              label={t('profile.notifications')}
              description={t('profile.notifDesc')}
              onPress={() => {}}
              isLast
            />
          </SectionCard>
        </View>

        {/* ── Sign out danger zone ───────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={[
            styles.dangerZone,
            { backgroundColor: dangerBg, borderColor: dangerBorder },
          ]}>
            <View style={styles.dangerHeader}>
              <LogOut size={16} color={staticTheme.colors.error[500]} />
              <Text
                variant="body-sm"
                weight="semibold"
                style={{ color: staticTheme.colors.error[500], marginLeft: 6 }}
              >
                {t('profile.signOut')}
              </Text>
            </View>
            <Text
              variant="body-xs"
              style={{
                color: isDark ? 'rgba(255,255,255,0.40)' : staticTheme.colors.textSecondary,
                marginBottom: 16,
              }}
            >
              {t('profile.signOutNote')}
            </Text>
            <Button
              title={isLoggingOut ? t('profile.signingOut') : t('profile.signOut')}
              variant="outline"
              onPress={handleLogout}
              loading={isLoggingOut}
              fullWidth
              style={[
                styles.logoutBtn,
                { borderColor: staticTheme.colors.error[500] },
              ]}
            />
          </View>
        </View>

        {/* ── Version footer ─────────────────────────────────────────────── */}
        <View style={styles.versionFooter}>
          <Text variant="caption" style={{ color: subtleCl, textAlign: 'center' }}>
            {t('profile.version')}
          </Text>
        </View>
      </ScrollView>

      {dialog.Dialog}
    </View>
  );
}

// ── Static styles (layout only — no colors) ───────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  heroCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 24,
    paddingBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#1E4D8C',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.10,
        shadowRadius: 16,
      },
      android: { elevation: 6 },
    }),
  },
  heroAccentBar: {
    height: 4,
    width: '100%',
  },
  avatarWrapper: {
    alignItems: 'center',
    marginTop: 28,
    marginBottom: 16,
  },
  avatarOuter: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInner: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 34,
    fontWeight: '700',
  },
  identityBlock: {
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 6,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 20,
    paddingHorizontal: 16,
  },
  section: {
    marginBottom: 20,
  },
  dangerZone: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  dangerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  logoutBtn: {
    backgroundColor: 'transparent',
  },
  versionFooter: {
    marginTop: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  copyChip: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexShrink: 0,
  },
});

