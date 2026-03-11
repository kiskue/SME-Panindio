import React from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore, selectCurrentUser } from '@/store';
import { theme } from '@/core/theme';
import { Text } from '@/components/atoms/Text';
import { Card } from '@/components/atoms/Card';
import { Button } from '@/components/atoms/Button/Button';


export default function HomeScreen() {
  const user = useAuthStore(selectCurrentUser);
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    // Simulate refresh
    setTimeout(() => {
      setRefreshing(false);
    }, 2000);
  }, []);

  const features = [
    {
      title: 'Authentication',
      description: 'Secure login with mock API and persistent sessions',
      icon: '🔐',
    },
    {
      title: 'Onboarding',
      description: 'Beautiful swipe-based onboarding flow',
      icon: '🎯',
    },
    {
      title: 'Notifications',
      description: 'Push notifications with custom routing',
      icon: '🔔',
    },
    {
      title: 'Modern UI',
      description: 'Atomic design components with theme system',
      icon: '🎨',
    },
    {
      title: 'TypeScript',
      description: 'Full TypeScript support with strict mode',
      icon: '🔷',
    },
    {
      title: 'Testing',
      description: 'Jest and React Testing Library setup',
      icon: '🧪',
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <ScrollView
        contentContainerStyle={styles.scrollViewContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome Section */}
        <View style={styles.header}>
          <Text variant="h3" weight="bold" style={styles.welcomeTitle}>
            Welcome back, {user?.name || 'User'}! 👋
          </Text>
          <Text variant="body" color="gray" style={styles.welcomeSubtitle}>
            This is your enterprise Expo React Native boilerplate
          </Text>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text variant="h5" weight="semibold" style={styles.sectionTitle}>
            Quick Actions
          </Text>
          <View style={styles.quickActions}>
            <Button
              title="View Profile"
              variant="outline"
              size="sm"
              onPress={() => {}}
              style={styles.quickActionButton}
            />
            <Button
              title="Notifications"
              variant="outline"
              size="sm"
              onPress={() => {}}
              style={styles.quickActionButton}
            />
          </View>
        </View>

        {/* Features */}
        <View style={styles.section}>
          <Text variant="h5" weight="semibold" style={styles.sectionTitle}>
            Features Included
          </Text>
          <View style={styles.featuresGrid}>
            {features.map((feature, index) => (
              <Card
                key={index}
                variant="elevated"
                padding="md"
                style={styles.featureCard}
                onPress={() => {}}
              >
                <Text style={styles.featureIcon}>{feature.icon}</Text>
                <Text variant="h6" weight="medium" style={styles.featureTitle}>
                  {feature.title}
                </Text>
                <Text variant="body-sm" color="gray" style={styles.featureDescription}>
                  {feature.description}
                </Text>
              </Card>
            ))}
          </View>
        </View>

        {/* Stats */}
        <View style={styles.section}>
          <Text variant="h5" weight="semibold" style={styles.sectionTitle}>
            App Statistics
          </Text>
          <Card variant="filled" padding="lg" style={styles.statsCard}>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text variant="h4" weight="bold" color="primary">
                  42
                </Text>
                <Text variant="body-sm" color="gray">
                  Components
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text variant="h4" weight="bold" color="primary">
                  100%
                </Text>
                <Text variant="body-sm" color="gray">
                  TypeScript
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text variant="h4" weight="bold" color="primary">
                  54
                </Text>
                <Text variant="body-sm" color="gray">
                  Expo SDK
                </Text>
              </View>
            </View>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollViewContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  header: {
    marginBottom: theme.spacing.xl,
  },
  welcomeTitle: {
    marginBottom: theme.spacing.sm,
    color: theme.colors.text,
  },
  welcomeSubtitle: {
    lineHeight: 24,
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    marginBottom: theme.spacing.md,
    color: theme.colors.text,
  },
  quickActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  quickActionButton: {
    flex: 1,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  featureCard: {
    width: '48%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureIcon: {
    fontSize: 32,
    marginBottom: theme.spacing.sm,
  },
  featureTitle: {
    marginBottom: theme.spacing.xs,
    textAlign: 'center',
    color: theme.colors.text,
  },
  featureDescription: {
    textAlign: 'center',
    lineHeight: 18,
  },
  statsCard: {
    marginTop: theme.spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
});