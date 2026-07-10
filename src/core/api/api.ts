/**
 * API client — singleton axios instance for the SME-Panindio backend.
 *
 * Replaces the former Supabase client (`src/lib/supabase.ts`). The backend is the
 * NestJS + MySQL service in the `Sme-Server` project. All former Supabase calls
 * (Auth, RPCs, direct table queries, Edge Functions, Storage signed URLs) are now
 * plain REST calls under `${EXPO_PUBLIC_API_URL}` (default `/api/v1`).
 *
 * Token model:
 *   - Business owner: JWT access token (1h) + refresh token (30d). Stored in
 *     AsyncStorage and mirrored in an in-memory cache so the request interceptor
 *     can attach `Authorization: Bearer <token>` synchronously on every call.
 *   - Customer (Suki): a separate opaque session token kept in expo-secure-store
 *     and passed explicitly in request bodies (see customer.service.ts). Customer
 *     endpoints on the backend are public and ignore the JWT header.
 *
 * On a 401 for a protected call, the client transparently refreshes the access
 * token once via POST /auth/refresh and retries the original request.
 *
 * Configure the base URL in `.env`:
 *   EXPO_PUBLIC_API_URL=http://10.0.2.2:3000/api/v1   # Android emulator -> host
 *   EXPO_PUBLIC_API_URL=http://localhost:3000/api/v1  # iOS simulator
 *   EXPO_PUBLIC_API_URL=http://<LAN-IP>:3000/api/v1   # physical device
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import axios, {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig,
} from 'axios';

const API_PORT = 3000;
const API_PREFIX = '/api/v1';

/**
 * Dev-only: derive the backend base URL from the Metro packager host so a
 * changing LAN IP never goes stale. The device/emulator is already reaching
 * Metro on that exact host, so we reuse it and swap Metro's port (8081) for the
 * NestJS port + path. This is preferred over EXPO_PUBLIC_API_URL in development
 * precisely because a hardcoded LAN IP in .env breaks every time the dev
 * machine's IP changes.
 *
 * Returns null (→ fall back to EXPO_PUBLIC_API_URL) when:
 *   - not in development (hostUri is undefined in production builds), or
 *   - tunnel mode is active (host is a non-routable *.exp.direct domain).
 */
function devApiBaseUrl(): string | null {
  if (!__DEV__) return null;

  // `hostUri` is "<host>:<port>", e.g. "192.168.1.5:8081". `debuggerHost` is
  // the Expo Go fallback in the same format.
  const hostUri =
    Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost;

  // noUncheckedIndexedAccess: split(':')[0] is `string | undefined`.
  let host = hostUri?.split(':')[0];
  if (!host) return null;

  const isLanIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
  const isLocal = host === 'localhost' || host === '127.0.0.1';
  // A tunnel host (e.g. *.exp.direct) is not routable to the backend — let the
  // explicit EXPO_PUBLIC_API_URL win instead.
  if (!isLanIp && !isLocal) return null;

  // On the Android emulator, Metro is reached via localhost (adb reverse), but
  // `localhost` there is the emulator itself; the host machine is 10.0.2.2.
  if (isLocal && Platform.OS === 'android') host = '10.0.2.2';

  return `http://${host}:${API_PORT}${API_PREFIX}`;
}

const RAW_BASE =
  devApiBaseUrl() ??                            // dev: reuse the live Metro host
  process.env.EXPO_PUBLIC_API_URL ??            // explicit override / production
  `http://localhost:${API_PORT}${API_PREFIX}`;  // last-resort fallback

/** Normalized base URL (no trailing slash). */
export const API_BASE_URL = RAW_BASE.replace(/\/+$/, '');

if (__DEV__) {
  // Surface the resolved target so a wrong/stale host is obvious in the logs.
  console.log(`[API] base URL → ${API_BASE_URL}`);
}

const ACCESS_KEY = 'sme_access_token';
const REFRESH_KEY = 'sme_refresh_token';

// In-memory mirror of the persisted tokens (synchronous access for interceptors).
let accessToken: string | null = null;
let refreshToken: string | null = null;

/** Current access token (or null). Synchronous. */
export function getAccessToken(): string | null {
  return accessToken;
}

/** Current refresh token (or null). Synchronous. Used to seed biometric enrollment. */
export function getRefreshToken(): string | null {
  return refreshToken;
}

/** Hydrate the in-memory token cache from AsyncStorage. Call once on app start. */
export async function loadAuthTokens(): Promise<void> {
  try {
    const [a, r] = await Promise.all([
      AsyncStorage.getItem(ACCESS_KEY),
      AsyncStorage.getItem(REFRESH_KEY),
    ]);
    accessToken = a;
    refreshToken = r;
  } catch {
    // Storage unavailable — leave tokens null; user will re-authenticate.
  }
}

/**
 * Persist the access token (and optionally the refresh token).
 * Pass `null` to clear a token. Omit `refresh` to leave it unchanged.
 */
export async function setAuthTokens(
  token: string | null,
  refresh?: string | null,
): Promise<void> {
  accessToken = token ?? null;
  if (refresh !== undefined) refreshToken = refresh;
  try {
    if (accessToken) await AsyncStorage.setItem(ACCESS_KEY, accessToken);
    else await AsyncStorage.removeItem(ACCESS_KEY);
    if (refresh !== undefined) {
      if (refreshToken) await AsyncStorage.setItem(REFRESH_KEY, refreshToken);
      else await AsyncStorage.removeItem(REFRESH_KEY);
    }
  } catch {
    // Non-fatal: the in-memory copy still works for this session.
  }
}

/** Clear both tokens from memory and storage (logout). */
export async function clearAuthTokens(): Promise<void> {
  accessToken = null;
  refreshToken = null;
  try {
    await AsyncStorage.multiRemove([ACCESS_KEY, REFRESH_KEY]);
  } catch {
    // ignore
  }
}

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request: attach the owner JWT when present ───────────────────────────────
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken && config.headers) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// ── Response: refresh-on-401 (single flight), then retry once ────────────────
let refreshing: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  if (!refreshToken) return null;
  try {
    // Use a bare axios call so this request itself is never intercepted/looped.
    const resp = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
    const data = resp.data as { token?: string; refreshToken?: string };
    if (data?.token) {
      await setAuthTokens(data.token, data.refreshToken ?? refreshToken);
      return data.token;
    }
  } catch {
    // fallthrough to clear
  }
  await clearAuthTokens();
  return null;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as
      | (InternalAxiosRequestConfig & { _retried?: boolean })
      | undefined;
    const status = error.response?.status;
    const url = original?.url ?? '';

    if (
      status === 401 &&
      original &&
      !original._retried &&
      refreshToken &&
      !url.includes('/auth/') // never refresh-loop the auth endpoints
    ) {
      original._retried = true;
      if (!refreshing) {
        refreshing = doRefresh().finally(() => {
          refreshing = null;
        });
      }
      const newToken = await refreshing;
      if (newToken) {
        original.headers = original.headers ?? {};
        (original.headers as Record<string, string>).Authorization = `Bearer ${newToken}`;
        return api(original);
      }
    }
    return Promise.reject(error);
  },
);

// ── Error envelope helper ────────────────────────────────────────────────────
// The backend returns `{ error: CODE, detail?: string }` on failures.
export interface ApiErrorShape {
  error?: string;
  detail?: string;
  message?: string;
}

export interface NormalizedApiError {
  code: string;
  detail?: string;
  status?: number;
}

/** Extract the backend error code/detail/status from any thrown axios error. */
export function extractApiError(err: unknown): NormalizedApiError {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as ApiErrorShape | undefined;
    return {
      code: data?.error ?? data?.message ?? err.message ?? 'NETWORK_ERROR',
      ...(data?.detail !== undefined ? { detail: data.detail } : {}),
      ...(err.response?.status !== undefined ? { status: err.response.status } : {}),
    };
  }
  if (err instanceof Error) return { code: err.message };
  return { code: 'UNKNOWN_ERROR' };
}

/** Throw a plain Error carrying the backend code as its message (legacy-friendly). */
export function throwApiError(err: unknown): never {
  const { code, detail } = extractApiError(err);
  throw new Error(detail ? `${code}: ${detail}` : code);
}
