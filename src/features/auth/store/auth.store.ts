/**
 * Auth Store
 *
 * Zustand slice for business-owner authentication state.
 *
 * Tokens are owned by `src/core/api/api.ts` (AsyncStorage + in-memory cache, with
 * transparent refresh). This store holds the user object and derived UI flags so
 * components stay reactive without reaching into the API client directly.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, AuthResponse, LoginCredentials, RegisterCredentials, ApiError } from '@/types';
import { ERROR_CONSTANTS } from '@/core/constants';
import { authService } from '@/features/auth/services/auth.service';
import { getAccessToken } from '@/core/api';

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  /** access_token mirrored here for callers that only need the raw token. */
  authToken: string | null;
  isLoading: boolean;
  error: ApiError | null;

  // ── Actions ────────────────────────────────────────────────────────────
  login: (credentials: LoginCredentials) => Promise<void>;
  /** Biometric login: restore the session from a stored refresh token. */
  restoreFromBiometric: (refreshToken: string) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (userData: Partial<User>) => void;
  clearError: () => void;
  setLoading: (loading: boolean) => void;
  setToken: (token: string) => void;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
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

      restoreFromBiometric: async (refreshToken: string) => {
        try {
          set({ isLoading: true, error: null });

          const response: AuthResponse = await authService.loginWithRefreshToken(refreshToken);

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
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Persist only the user object and derived flags. Tokens live in api.ts.
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
 * Called once on app start (from _layout.tsx via initializeStores).
 * Hydrates persisted tokens and refreshes the profile from GET /auth/me.
 */
export const initializeAuth = async (): Promise<void> => {
  try {
    const restored = await authService.restoreSession();
    if (restored) {
      useAuthStore.getState().setUser(restored.user);
      useAuthStore.setState({ authToken: getAccessToken(), isAuthenticated: true });
    } else {
      useAuthStore.setState({ user: null, isAuthenticated: false, authToken: null });
    }
  } catch (error) {
    console.error('[Auth] Failed to initialize auth:', error);
  }
};

/**
 * Kept for API compatibility with the previous Supabase implementation.
 * JWT auth has no realtime auth-state stream, so this is a no-op that returns
 * a cleanup function. Token refresh is handled inside the axios client.
 */
export const setupAuthListener = (): (() => void) => {
  return () => {
    /* no-op */
  };
};
