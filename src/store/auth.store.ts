/**
 * Auth Store
 *
 * Zustand slice for authentication state.
 *
 * Token lifecycle is fully delegated to the Supabase client (AsyncStorage
 * persistence, auto-refresh). This store holds the user object and derived
 * UI flags so components stay reactive without polling Supabase directly.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session } from '@supabase/supabase-js';
import { User, AuthResponse, LoginCredentials, RegisterCredentials, ApiError } from '@/types';
import { ERROR_CONSTANTS } from '@/core/constants';
import { authService } from '@/features/auth/services/auth.service';
import { supabase } from '@/lib/supabase';

export interface AuthState {
  user: User | null;
  /** Active Supabase session — null when logged out or before hydration. */
  session: Session | null;
  isAuthenticated: boolean;
  /** access_token mirrored here for callers that only need the raw token. */
  authToken: string | null;
  isLoading: boolean;
  error: ApiError | null;

  // ── Actions ────────────────────────────────────────────────────────────
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (userData: Partial<User>) => void;
  clearError: () => void;
  setLoading: (loading: boolean) => void;
  setToken: (token: string) => void;
  setUser: (user: User) => void;
  setSession: (session: Session | null) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      session: null,
      isAuthenticated: false,
      authToken: null,
      isLoading: false,
      error: null,

      login: async (credentials: LoginCredentials) => {
        try {
          set({ isLoading: true, error: null });

          const response: AuthResponse = await authService.login(credentials);

          set({
            user: response.user,
            authToken: response.token,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          const apiError: ApiError = {
            message:
              error instanceof Error ? error.message : ERROR_CONSTANTS.AUTHENTICATION_ERROR,
            code: ERROR_CONSTANTS.ERROR_CODES.AUTHENTICATION_ERROR,
            status: 401,
          };
          set({
            error: apiError,
            isLoading: false,
            isAuthenticated: false,
            user: null,
            authToken: null,
          });
          throw error;
        }
      },

      register: async (credentials: RegisterCredentials) => {
        try {
          set({ isLoading: true, error: null });

          const response: AuthResponse = await authService.register(credentials);

          // token is empty when Supabase requires email confirmation.
          if (!response.token) {
            set({ isLoading: false });
            return;
          }

          set({
            user: response.user,
            authToken: response.token,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          const apiError: ApiError = {
            message: error instanceof Error ? error.message : 'Registration failed',
            code: ERROR_CONSTANTS.ERROR_CODES.AUTHENTICATION_ERROR,
            status: 400,
          };
          set({ error: apiError, isLoading: false });
          throw error;
        }
      },

      logout: async () => {
        try {
          set({ isLoading: true });

          await authService.logout();
          await AsyncStorage.removeItem('auth-storage');

          set({
            user: null,
            session: null,
            authToken: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          const apiError: ApiError = {
            message: error instanceof Error ? error.message : 'Logout failed',
            code: 'LOGOUT_ERROR',
          };
          set({ error: apiError, isLoading: false });
          throw error;
        }
      },

      updateProfile: (userData: Partial<User>) => {
        const { user } = get();
        if (user) {
          set({ user: { ...user, ...userData } });
        }
      },

      clearError: () => set({ error: null }),
      setLoading: (loading: boolean) => set({ isLoading: loading }),
      setToken: (token: string) => set({ authToken: token }),
      setUser: (user: User) => set({ user, isAuthenticated: true }),

      setSession: (session: Session | null) =>
        set({
          session,
          authToken: session?.access_token ?? null,
          isAuthenticated: !!session,
        }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist the user object and derived flags.
      // The Supabase client manages its own session in AsyncStorage.
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        authToken: state.authToken,
      }),
    },
  ),
);

// ── Selectors ──────────────────────────────────────────────────────────────

export const selectAuth = (state: AuthState) => ({
  user: state.user,
  isAuthenticated: state.isAuthenticated,
  authToken: state.authToken,
});

export const selectAuthLoading = (state: AuthState) => state.isLoading;
export const selectAuthError = (state: AuthState) => state.error;
export const selectCurrentUser = (state: AuthState) => state.user;

// ── Store helpers ──────────────────────────────────────────────────────────

export const isAuthenticated = (): boolean => useAuthStore.getState().isAuthenticated;
export const getAuthToken = (): string | null => useAuthStore.getState().authToken;
export const getCurrentUser = (): User | null => useAuthStore.getState().user;

// ── Initialization ─────────────────────────────────────────────────────────

/**
 * Called once on app start (from _layout.tsx).
 * Restores the Supabase session from AsyncStorage and syncs Zustand state.
 */
export const initializeAuth = async (): Promise<void> => {
  try {
    const session = await authService.getCurrentSession();
    if (session) {
      useAuthStore.getState().setSession(session);
    }
  } catch (error) {
    console.error('[Auth] Failed to initialize auth:', error);
  }
};

/**
 * Subscribes to Supabase auth state changes so the Zustand store stays
 * in sync with token refreshes, sign-outs from other devices, etc.
 *
 * Returns the cleanup function — call it inside a `useEffect` cleanup
 * or when tearing down the app.
 */
export const setupAuthListener = (): (() => void) => {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    const store = useAuthStore.getState();

    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      store.setSession(session);
    } else if (event === 'SIGNED_OUT') {
      store.setSession(null);
      store.updateProfile({} as never); // clear stale user data
      // Full reset is handled by logout() — here we just mirror the event.
      useAuthStore.setState({ user: null, isAuthenticated: false, authToken: null });
    }
  });

  return () => subscription.unsubscribe();
};
