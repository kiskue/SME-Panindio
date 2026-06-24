/**
 * AuthService
 *
 * Thin wrapper around the NestJS backend auth endpoints (replaces Supabase Auth).
 * All HTTP/token logic lives here so UI components and the Zustand store stay
 * framework-agnostic.
 *
 * Endpoints (base = EXPO_PUBLIC_API_URL):
 *   POST /auth/register  — creates the user + business + business code, returns tokens
 *   POST /auth/login     — username + password, returns tokens
 *   POST /auth/refresh   — exchanges a refresh token for a fresh token pair
 *   POST /auth/logout    — best-effort server-side revoke
 *   GET  /auth/me        — current user profile (session restore)
 *
 * Tokens are persisted by `src/core/api/api.ts` (AsyncStorage + in-memory cache); the
 * axios request interceptor attaches the Bearer token automatically.
 */

import { api, setAuthTokens, clearAuthTokens, loadAuthTokens, getAccessToken, extractApiError } from '@/core/api';
import {
  AuthResponse,
  LoginCredentials,
  RegisterCredentials,
  User,
  getBusinessOperationMode,
} from '@/types';
import { APP_CONSTANTS, ERROR_CONSTANTS, VALIDATION_CONSTANTS } from '@/core/constants';

// Shape the backend returns inside `{ user }` and from GET /auth/me.
interface BackendAuthResult {
  token: string;
  refreshToken: string;
  user: User;
  expiresIn: number;
}

/** Annotate the raw user with the derived operation mode used across the app. */
function toUser(raw: User): User {
  return {
    ...raw,
    ...(raw.businessTypeCategory
      ? { businessOperationMode: getBusinessOperationMode(raw.businessTypeCategory) }
      : {}),
  };
}

class AuthService {
  // ── Public API ────────────────────────────────────────────────────────────

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    this.validateLoginCredentials(credentials);

    try {
      const { data } = await api.post<BackendAuthResult>('/auth/login', {
        username: credentials.username.trim().toLowerCase(),
        password: credentials.password,
      });

      await setAuthTokens(data.token, data.refreshToken);

      return {
        token: data.token,
        user: toUser(data.user),
        expiresIn: data.expiresIn ?? 3600,
      };
    } catch (err) {
      throw this.toAuthError(err);
    }
  }

  /**
   * Register a business owner.
   * Creates the auth user + business + business code in one server-side
   * transaction and returns a token pair (no email-confirmation step).
   */
  async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    this.validateRegisterCredentials(credentials);

    try {
      const { data } = await api.post<BackendAuthResult>('/auth/register', {
        email: credentials.email.trim().toLowerCase(),
        password: credentials.password,
        firstName: credentials.firstName.trim(),
        lastName: credentials.lastName.trim(),
        username: credentials.username.trim().toLowerCase(),
        businessName: credentials.businessName.trim(),
        businessTypeId: credentials.businessTypeId,
        enterpriseType: credentials.enterpriseType,
      });

      await setAuthTokens(data.token, data.refreshToken);

      return {
        token: data.token,
        user: toUser(data.user),
        expiresIn: data.expiresIn ?? 3600,
      };
    } catch (err) {
      throw this.toAuthError(err);
    }
  }

  async logout(): Promise<void> {
    // Best-effort server revoke; always clear local tokens regardless of outcome.
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore — local clear below is what matters
    }
    await clearAuthTokens();
  }

  /**
   * Restore the session on app start: hydrate persisted tokens, then fetch the
   * current profile. Returns the user (or null if there is no valid session).
   */
  async restoreSession(): Promise<{ user: User } | null> {
    await loadAuthTokens();
    if (!getAccessToken()) return null;
    try {
      const { data } = await api.get<User>('/auth/me');
      return { user: toUser(data) };
    } catch {
      // Token invalid/expired and refresh failed — treat as logged out.
      await clearAuthTokens();
      return null;
    }
  }

  async refreshToken(): Promise<AuthResponse | null> {
    try {
      const { data } = await api.get<User>('/auth/me');
      return {
        token: getAccessToken() ?? '',
        user: toUser(data),
        expiresIn: 3600,
      };
    } catch {
      return null;
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /** Map backend error codes to user-facing messages. */
  private toAuthError(err: unknown): Error {
    const { code, detail } = extractApiError(err);
    const messages: Record<string, string> = {
      INVALID_CREDENTIALS: 'Invalid username or password.',
      USERNAME_TAKEN: 'That username is already taken.',
      EMAIL_TAKEN: 'An account with that email already exists.',
      DUPLICATE_ENTRY: 'An account with those details already exists.',
      REGISTRATION_FAILED: 'Registration failed. Please try again.',
      NETWORK_ERROR: 'Network error. Please check your connection.',
    };
    return new Error(messages[code] ?? detail ?? code ?? ERROR_CONSTANTS.AUTHENTICATION_ERROR);
  }

  private validateLoginCredentials(credentials: LoginCredentials): void {
    if (!credentials.username?.trim() || !credentials.password) {
      throw new Error('Username and password are required');
    }
    if (credentials.username.trim().length < 3) {
      throw new Error('Username must be at least 3 characters');
    }
    if (credentials.password.length < VALIDATION_CONSTANTS.MIN_PASSWORD_LENGTH) {
      throw new Error(
        `Password must be at least ${VALIDATION_CONSTANTS.MIN_PASSWORD_LENGTH} characters long`,
      );
    }
  }

  private validateRegisterCredentials(credentials: RegisterCredentials): void {
    if (!credentials.email || !credentials.password) {
      throw new Error('Email and password are required');
    }
    if (!APP_CONSTANTS.EMAIL_REGEX.test(credentials.email)) {
      throw new Error('Please enter a valid email address');
    }
    if (credentials.password.length < VALIDATION_CONSTANTS.MIN_PASSWORD_LENGTH) {
      throw new Error(
        `Password must be at least ${VALIDATION_CONSTANTS.MIN_PASSWORD_LENGTH} characters long`,
      );
    }
    if (!credentials.firstName.trim()) throw new Error('First name is required');
    if (!credentials.lastName.trim()) throw new Error('Last name is required');
    if (credentials.firstName.trim().length < VALIDATION_CONSTANTS.MIN_NAME_LENGTH) {
      throw new Error(
        `First name must be at least ${VALIDATION_CONSTANTS.MIN_NAME_LENGTH} characters`,
      );
    }
    if (credentials.lastName.trim().length < VALIDATION_CONSTANTS.MIN_NAME_LENGTH) {
      throw new Error(
        `Last name must be at least ${VALIDATION_CONSTANTS.MIN_NAME_LENGTH} characters`,
      );
    }
    const username = credentials.username.trim();
    if (!username) throw new Error('Username is required');
    if (username.length < 3) throw new Error('Username must be at least 3 characters');
    if (username.length > 30) throw new Error('Username cannot exceed 30 characters');
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      throw new Error('Only letters, numbers, and underscores allowed in username');
    }
    if (!credentials.businessName.trim() || credentials.businessName.trim().length < 2) {
      throw new Error('Business name must be at least 2 characters');
    }
    if (!credentials.businessTypeId || credentials.businessTypeId < 1) {
      throw new Error('Please select your business type');
    }
    if (!credentials.enterpriseType) {
      throw new Error('Please select enterprise type');
    }
  }
}

export const authService = new AuthService();
