// Application constants

export const APP_CONSTANTS = {
  // API Configuration
  API_BASE_URL: process.env.EXPO_PUBLIC_API_URL || 'https://api.example.com',
  API_TIMEOUT: 30000,
  
  // Authentication
  TOKEN_KEY: 'auth_token',
  USER_KEY: 'user_data',
  
  // Storage Keys
  ONBOARDING_COMPLETED_KEY: 'onboarding_completed',
  PUSH_TOKEN_KEY: 'push_token',
  
  // Notifications
  NOTIFICATION_SOUND: process.env.EXPO_PUBLIC_NOTIFICATION_SOUND || 'notification.wav',
  
  // UI Configuration
  DEFAULT_PAGE_SIZE: 20,
  MAX_RETRY_ATTEMPTS: 3,
  
  // Platform specific
  IS_IOS: Platform.OS === 'ios',
  IS_ANDROID: Platform.OS === 'android',
  
  // Date/Time formats
  DATE_FORMAT: 'YYYY-MM-DD',
  TIME_FORMAT: 'HH:mm',
  DATETIME_FORMAT: 'YYYY-MM-DD HH:mm:ss',
  
  // Validation
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE_REGEX: /^\+?[\d\s\-\(\)]+$/,
  
  // Network
  NETWORK_TIMEOUT: 10000,
  MAX_CONCURRENT_REQUESTS: 5,
  
  // Cache
  CACHE_TTL: 5 * 60 * 1000, // 5 minutes
  STALE_WHILE_REVALIDATE: 30 * 1000, // 30 seconds
  
  // Animation
  ANIMATION_DURATION: 300,
  PAGE_TRANSITION_DURATION: 250,
  
  // Storybook
  STORYBOOK_ENABLED: process.env.EXPO_PUBLIC_STORYBOOK_ENABLED === 'true',
} as const;

export const NAVIGATION_CONSTANTS = {
  // Route names
  ONBOARDING: '/onboarding' as const,
  LOGIN: '/auth/login' as const,
  HOME: '/app/(tabs)/home' as const,
  PROFILE: '/app/(tabs)/profile' as const,
  NOTIFICATIONS: '/app/(tabs)/notifications' as const,
  
  // Tab names
  HOME_TAB: 'home' as const,
  PROFILE_TAB: 'profile' as const,
  NOTIFICATIONS_TAB: 'notifications' as const,
} as const;

export const NOTIFICATION_CONSTANTS = {
  // Notification types
  CHAT_MESSAGE: 'CHAT_MESSAGE' as const,
  ALERT: 'ALERT' as const,
  INFO: 'INFO' as const,
  WARNING: 'WARNING' as const,
  
  // Notification channels
  DEFAULT_CHANNEL_ID: 'default' as const,
  HIGH_PRIORITY_CHANNEL_ID: 'high-priority' as const,
  
  // Notification actions
  MARK_AS_READ: 'MARK_AS_READ' as const,
  DELETE: 'DELETE' as const,
  REPLY: 'REPLY' as const,
} as const;

export const ERROR_CONSTANTS = {
  // Common error messages
  NETWORK_ERROR: 'Network error. Please check your connection.',
  SERVER_ERROR: 'Server error. Please try again later.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  AUTHENTICATION_ERROR: 'Authentication failed. Please login again.',
  AUTHORIZATION_ERROR: 'You are not authorized to perform this action.',
  NOT_FOUND_ERROR: 'The requested resource was not found.',
  TIMEOUT_ERROR: 'Request timed out. Please try again.',
  
  // Error codes
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

export const VALIDATION_CONSTANTS = {
  // Password requirements
  MIN_PASSWORD_LENGTH: 8,
  MAX_PASSWORD_LENGTH: 128,
  
  // Email requirements
  MAX_EMAIL_LENGTH: 254,
  
  // Name requirements
  MIN_NAME_LENGTH: 2,
  MAX_NAME_LENGTH: 50,
  
  // Input limits
  MAX_INPUT_LENGTH: 255,
  MAX_TEXTAREA_LENGTH: 1000,
  
  // File upload limits
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_FILE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
} as const;

import { Platform } from 'react-native';