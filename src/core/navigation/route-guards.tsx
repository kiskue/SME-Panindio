import { useEffect, useState } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { isAuthenticated, isOnboardingCompleted } from '@/store';

export enum RouteGroup {
  PUBLIC = 'public',
  AUTH = 'auth',
  APP = 'app',
}

export const useRouteGuards = () => {
  const segments = useSegments();
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        setIsChecking(true);
        
        const inAuthGroup = segments[0] === '(auth)';
        const inAppGroup = segments[0] === '(app)';
        const isOnboardingRoute = segments[0] === 'onboarding';
        
        const authenticated = isAuthenticated();
        const onboardingCompleted = isOnboardingCompleted();

        // If user is not authenticated and trying to access app routes
        if (!authenticated && inAppGroup) {
          // Redirect to login
          router.replace('/auth/login');
          return;
        }

        // If user is authenticated and trying to access auth routes
        if (authenticated && inAuthGroup) {
          // Redirect to app
          router.replace('/app/(tabs)/home');
          return;
        }

        // If onboarding is not completed and not on onboarding route
        if (!onboardingCompleted && !isOnboardingRoute && !inAuthGroup) {
          // Redirect to onboarding
          router.replace('/onboarding');
          return;
        }

        // If onboarding is completed and on onboarding route
        if (onboardingCompleted && isOnboardingRoute) {
          // Redirect to appropriate route
          if (authenticated) {
            router.replace('/app/(tabs)/home');
          } else {
            router.replace('/auth/login');
          }
          return;
        }

      } catch (error) {
        console.error('Route guard error:', error);
      } finally {
        setIsChecking(false);
      }
    };

    checkAuth();
  }, [segments, router]);

  return { isChecking };
};

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isChecking } = useRouteGuards();

  if (isChecking) {
    return null; // Or a loading component
  }

  return <>{children}</>;
};

export const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { isChecking } = useRouteGuards();

  if (isChecking) {
    return null; // Or a loading component
  }

  return <>{children}</>;
};

export const AuthRoute = ({ children }: { children: React.ReactNode }) => {
  const { isChecking } = useRouteGuards();

  if (isChecking) {
    return null; // Or a loading component
  }

  return <>{children}</>;
};