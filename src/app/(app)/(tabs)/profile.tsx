import React, { useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore, selectCurrentUser } from '@/store';
import { useAppTheme } from '@/core/theme';
import { Text } from '@/components/atoms/Text';
import { Card } from '@/components/atoms/Card';
import { Button } from '@/components/atoms/Button/Button';

export default function ProfileScreen() {
  const user = useAuthStore(selectCurrentUser);
  const { logout } = useAuthStore();
  const theme = useAppTheme();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      // Navigation is handled by route guards
    } catch (error) {
      console.error('Logout failed:', error);
      Alert.alert('Logout Failed', 'Unable to log out. Please try again.');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const menuItems = [
    {
      title: 'Account Settings',
      description: 'Manage your account preferences',
      icon: '⚙️',
      onPress: () => console.log('Account settings'),
    },
    {
      title: 'Privacy & Security',
      description: 'Control your privacy settings',
      icon: '🔒',
      onPress: () => console.log('Privacy settings'),
    },
    {
      title: 'Notifications',
      description: 'Configure notification preferences',
      icon: '🔔',
      onPress: () => console.log('Notification settings'),
    },
    {
      title: 'Help & Support',
      description: 'Get help and contact support',
      icon: '❓',
      onPress: () => console.log('Help & Support'),
    },
    {
      title: 'About',
      description: 'App version and information',
      icon: 'ℹ️',
      onPress: () => console.log('About'),
    },
  ];

  const dynStyles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    avatarContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.colors.primary[500],
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: theme.spacing.md,
    },
    avatarText: {
      fontSize: 32,
      fontWeight: theme.typography.weights.bold,
      color: theme.colors.white,
    },
    userName: {
      color: theme.colors.text,
      marginBottom: theme.spacing.xs,
    },
    sectionTitle: {
      marginBottom: theme.spacing.md,
      color: theme.colors.text,
    },
    menuTitle: {
      color: theme.colors.text,
      marginBottom: theme.spacing.xs,
    },
    menuArrow: {
      fontSize: 20,
      color: theme.colors.textSecondary,
      marginLeft: theme.spacing.sm,
    },
  }), [theme]);

  return (
    <View style={dynStyles.container}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.scrollViewContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header */}
        <View style={styles.header}>
          <View style={dynStyles.avatarContainer}>
            <Text style={dynStyles.avatarText}>
              {user?.name?.charAt(0).toUpperCase() ?? 'U'}
            </Text>
          </View>
          <Text variant="h4" weight="bold" style={dynStyles.userName}>
            {user?.name ?? 'User'}
          </Text>
          <Text variant="body" color="gray" style={styles.userEmail}>
            {user?.email}
          </Text>
        </View>

        {/* Account Info */}
        <View style={styles.section}>
          <Text variant="h5" weight="semibold" style={dynStyles.sectionTitle}>
            Account Information
          </Text>
          <Card variant="elevated" padding="md" style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text variant="body-sm" color="gray">User ID</Text>
              <Text variant="body-sm" weight="medium">{user?.id}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text variant="body-sm" color="gray">Email</Text>
              <Text variant="body-sm" weight="medium">{user?.email}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text variant="body-sm" color="gray">Name</Text>
              <Text variant="body-sm" weight="medium">{user?.name ?? 'Not set'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text variant="body-sm" color="gray">Role</Text>
              <Text variant="body-sm" weight="medium">{user?.role ?? 'User'}</Text>
            </View>
          </Card>
        </View>

        {/* Menu Items */}
        <View style={styles.section}>
          <Text variant="h5" weight="semibold" style={dynStyles.sectionTitle}>
            Settings
          </Text>
          <View style={styles.menuList}>
            {menuItems.map((item, index) => (
              <Card
                key={index}
                variant="elevated"
                padding="md"
                style={styles.menuItem}
                onPress={item.onPress}
              >
                <View style={styles.menuItemContent}>
                  <Text style={styles.menuIcon}>{item.icon}</Text>
                  <View style={styles.menuTextContainer}>
                    <Text variant="body" weight="medium" style={dynStyles.menuTitle}>
                      {item.title}
                    </Text>
                    <Text variant="body-sm" color="gray" style={styles.menuDescription}>
                      {item.description}
                    </Text>
                  </View>
                  <Text style={dynStyles.menuArrow}>›</Text>
                </View>
              </Card>
            ))}
          </View>
        </View>

        {/* Logout Button */}
        <View style={styles.logoutSection}>
          <Button
            title="Sign Out"
            variant="outline"
            onPress={handleLogout}
            loading={isLoggingOut}
            style={styles.logoutButton}
          />
          <Text variant="caption" color="gray" style={styles.logoutHint}>
            You will be signed out of your account
          </Text>
        </View>

        {/* App Version */}
        <View style={styles.versionContainer}>
          <Text variant="caption" color="gray" style={styles.versionText}>
            Enterprise Expo RN Boilerplate v1.0.0
          </Text>
          <Text variant="caption" color="gray" style={styles.versionText}>
            Expo SDK 54 • React Native 0.81.5
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollViewContent: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    paddingVertical: 32,
  },
  userEmail: {
    // color handled by Text component's color="gray" prop
  },
  section: {
    marginBottom: 32,
  },
  infoCard: {
    gap: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  menuList: {
    gap: 8,
  },
  menuItem: {
    marginBottom: 8,
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIcon: {
    fontSize: 20,
    marginRight: 16,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuDescription: {
    lineHeight: 18,
  },
  logoutSection: {
    marginTop: 32,
    marginBottom: 32,
  },
  logoutButton: {
    marginBottom: 8,
  },
  logoutHint: {
    textAlign: 'center',
  },
  versionContainer: {
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 16,
  },
  versionText: {
    textAlign: 'center',
    marginBottom: 4,
  },
});
