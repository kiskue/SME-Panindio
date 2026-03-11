/**
 * useAuth
 *
 * Convenience hook that exposes the auth slice of Zustand state plus
 * typed action wrappers so UI components never import the store directly.
 *
 * Usage:
 *   const { user, isAuthenticated, login, register, logout } = useAuth();
 */

import { useAuthStore } from '@/store/auth.store';
import { LoginCredentials, RegisterCredentials, User, ApiError } from '@/types';

export interface UseAuthReturn {
  // ── State ────────────────────────────────────────────────────────────────
  user: User | null;
  isAuthenticated: boolean;
  authToken: string | null;
  isLoading: boolean;
  error: ApiError | null;

  // ── Actions ──────────────────────────────────────────────────────────────
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (userData: Partial<User>) => void;
  clearError: () => void;
}

export const useAuth = (): UseAuthReturn => {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authToken = useAuthStore((s) => s.authToken);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const logout = useAuthStore((s) => s.logout);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const clearError = useAuthStore((s) => s.clearError);

  return {
    user,
    isAuthenticated,
    authToken,
    isLoading,
    error,
    login,
    register,
    logout,
    updateProfile,
    clearError,
  };
};
