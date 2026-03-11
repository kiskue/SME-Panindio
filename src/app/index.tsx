import { View, ActivityIndicator } from 'react-native';
import { theme } from '@/core/theme';
import { useRouteGuards } from '@/core/navigation/route-guards';

/**
 * Default entry route — visible briefly while Zustand stores hydrate from
 * AsyncStorage.  useRouteGuards runs here (inside the Stack, so the router is
 * ready) and immediately replaces this screen once the destination is known.
 */
export default function IndexScreen() {
  useRouteGuards();

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color={theme.colors.primary[500]} />
    </View>
  );
}
