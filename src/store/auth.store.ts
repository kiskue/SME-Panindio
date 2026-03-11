import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { User, AuthResponse, LoginCredentials, ApiError } from '@/types';
import { APP_CONSTANTS, ERROR_CONSTANTS } from '@/core/constants';
import { authService } from '@/features/auth/services/auth.service';

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  authToken: string | null;
  isLoading: boolean;
  error: ApiError | null;
  
  // Actions
  login: (credentials: LoginCredentials) => Promise<void>;
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
          
          // Validate credentials
          if (!credentials.email || !credentials.password) {
            throw new Error('Email and password are required');
          }
          
          // Call authentication service
          const response: AuthResponse = await authService.login(credentials);
          
          // Store token securely
          await SecureStore.setItemAsync(APP_CONSTANTS.TOKEN_KEY, response.token);
          
          // Update state
          set({
            user: response.user,
            authToken: response.token,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
          
        } catch (error) {
          const apiError: ApiError = {
            message: error instanceof Error ? error.message : ERROR_CONSTANTS.AUTHENTICATION_ERROR,
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

      logout: async () => {
        try {
          set({ isLoading: true });
          
          // Clear secure storage
          await SecureStore.deleteItemAsync(APP_CONSTANTS.TOKEN_KEY);
          
          // Clear async storage
          await AsyncStorage.removeItem('auth-storage');
          
          // Reset state
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
          
          set({
            error: apiError,
            isLoading: false,
          });
          
          throw error;
        }
      },

      updateProfile: (userData: Partial<User>) => {
        const { user } = get();
        if (user) {
          set({
            user: { ...user, ...userData },
          });
        }
      },

      clearError: () => {
        set({ error: null });
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      setToken: (token: string) => {
        set({ authToken: token });
      },

      setUser: (user: User) => {
        set({ user, isAuthenticated: true });
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        authToken: state.authToken,
      }),
    }
  )
);

// Selectors
export const selectAuth = (state: AuthState) => ({
  user: state.user,
  isAuthenticated: state.isAuthenticated,
  authToken: state.authToken,
});

export const selectAuthLoading = (state: AuthState) => state.isLoading;
export const selectAuthError = (state: AuthState) => state.error;
export const selectCurrentUser = (state: AuthState) => state.user;

// Helper functions
export const isAuthenticated = (): boolean => {
  return useAuthStore.getState().isAuthenticated;
};

export const getAuthToken = (): string | null => {
  return useAuthStore.getState().authToken;
};

export const getCurrentUser = (): User | null => {
  return useAuthStore.getState().user;
};

// Initialize auth from secure storage
export const initializeAuth = async (): Promise<void> => {
  try {
    const token = await SecureStore.getItemAsync(APP_CONSTANTS.TOKEN_KEY);
    if (token) {
      useAuthStore.getState().setToken(token);
      // You might want to validate the token here
      // For now, we'll just set it
    }
  } catch (error) {
    console.error('Failed to initialize auth:', error);
  }
};