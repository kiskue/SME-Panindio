import { Platform } from 'react-native';

// ─── Responsive breakpoints ─────────────────────────────────────────────────────
export {
  BREAKPOINTS,
  TABLET_MIN_WIDTH,
  INVENTORY_GRID_COLUMNS,
  type Breakpoint,
} from './breakpoints';

// ─── App Constants ────────────────────────────────────────────────────────────

export const APP_CONSTANTS = {
  API_BASE_URL: process.env.EXPO_PUBLIC_API_URL ?? 'https://api.example.com',
  API_TIMEOUT: 30_000,

  TOKEN_KEY: 'auth_token',
  USER_KEY: 'user_data',

  ONBOARDING_COMPLETED_KEY: 'onboarding_completed',
  PUSH_TOKEN_KEY: 'push_token',

  // Biometric login — keys for the secrets held in expo-secure-store (one per
  // auth system). Enrollment flags live in the biometric store, not here.
  BIOMETRIC_BUSINESS_SECRET_KEY: 'sme_biometric_business',
  BIOMETRIC_CUSTOMER_SECRET_KEY: 'sme_biometric_customer',

  NOTIFICATION_SOUND:
    process.env.EXPO_PUBLIC_NOTIFICATION_SOUND ?? 'new_product.wav',

  DEFAULT_PAGE_SIZE: 20,
  MAX_RETRY_ATTEMPTS: 3,

  IS_IOS: Platform.OS === 'ios',
  IS_ANDROID: Platform.OS === 'android',

  DATE_FORMAT: 'YYYY-MM-DD',
  TIME_FORMAT: 'HH:mm',
  DATETIME_FORMAT: 'YYYY-MM-DD HH:mm:ss',

  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE_REGEX: /^\+?[\d\s\-()]+$/,

  NETWORK_TIMEOUT: 10_000,
  MAX_CONCURRENT_REQUESTS: 5,

  CACHE_TTL: 5 * 60 * 1_000,
  STALE_WHILE_REVALIDATE: 30 * 1_000,

  ANIMATION_DURATION: 300,
  PAGE_TRANSITION_DURATION: 250,

  STORYBOOK_ENABLED: process.env.EXPO_PUBLIC_STORYBOOK_ENABLED === 'true',
} as const;

// ─── Validation Constants ─────────────────────────────────────────────────────

export const VALIDATION_CONSTANTS = {
  MIN_PASSWORD_LENGTH: 8,
  MAX_PASSWORD_LENGTH: 128,
  MAX_EMAIL_LENGTH: 254,
  MIN_NAME_LENGTH: 2,
  MAX_NAME_LENGTH: 50,
  MAX_INPUT_LENGTH: 255,
  MAX_TEXTAREA_LENGTH: 1_000,
  MAX_FILE_SIZE: 10 * 1_024 * 1_024,
  ALLOWED_FILE_TYPES: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
  ],
} as const;

// ─── Navigation Constants ─────────────────────────────────────────────────────

export const NAVIGATION_CONSTANTS = {
  ONBOARDING: '/onboarding' as const,
  LOGIN: '/(auth)/login' as const,
  HOME: '/(app)/(tabs)' as const,
  PROFILE: '/(app)/(tabs)/profile' as const,
  NOTIFICATIONS: '/(app)/(tabs)/notifications' as const,
} as const;

// ─── Notification Constants ───────────────────────────────────────────────────

export const NOTIFICATION_CONSTANTS = {
  CHAT_MESSAGE: 'CHAT_MESSAGE' as const,
  ALERT: 'ALERT' as const,
  INFO: 'INFO' as const,
  WARNING: 'WARNING' as const,

  DEFAULT_CHANNEL_ID: 'default' as const,
  // Bumped from 'high-priority' when the channel sound changed to new_product.wav:
  // Android channels are immutable after creation, so a new id forces the OS to
  // recreate the channel with the new sound instead of keeping the cached one.
  // Must stay in sync with the server's HIGH_PRIORITY_CHANNEL_ID (Sme-Server).
  HIGH_PRIORITY_CHANNEL_ID: 'high-priority-v2' as const,

  MARK_AS_READ: 'MARK_AS_READ' as const,
  DELETE: 'DELETE' as const,
  REPLY: 'REPLY' as const,
} as const;

// ─── Error Constants ──────────────────────────────────────────────────────────

export const ERROR_CONSTANTS = {
  NETWORK_ERROR: 'Network error. Please check your connection.',
  SERVER_ERROR: 'Server error. Please try again later.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  AUTHENTICATION_ERROR: 'Authentication failed. Please login again.',
  AUTHORIZATION_ERROR: 'You are not authorized to perform this action.',
  NOT_FOUND_ERROR: 'The requested resource was not found.',
  TIMEOUT_ERROR: 'Request timed out. Please try again.',

  ERROR_CODES: {
    NETWORK_ERROR: 'NETWORK_ERROR',  
    SERVER_ERROR: 'SERVER_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
    AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
    NOT_FOUND_ERROR: 'NOT_FOUND_ERROR',
    TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  } as const,
} as const;
