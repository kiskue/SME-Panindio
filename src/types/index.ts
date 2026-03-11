import { StyleProp, ViewStyle } from 'react-native';

// ─── Domain: Auth ────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role?: 'admin' | 'user' | 'viewer';
}

export interface AuthResponse {
  token: string;
  user: User;
  expiresIn: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

// ─── Domain: Notifications ───────────────────────────────────────────────────

export type NotificationType = 'CHAT_MESSAGE' | 'ALERT' | 'INFO' | 'WARNING';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: NotificationType;
  data?: Record<string, string | number | boolean>;
  isRead: boolean;
  createdAt: string; // ISO 8601
}

// ─── Domain: API ─────────────────────────────────────────────────────────────

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

export type Status = 'idle' | 'loading' | 'success' | 'error';

export interface AsyncState<T> {
  data: T | null;
  status: Status;
  error: ApiError | null;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

// ─── Navigation ──────────────────────────────────────────────────────────────

export type AppRoute =
  | '/onboarding'
  | '/(auth)/login'
  | '/(app)/(tabs)'
  | '/(app)/(tabs)/notifications'
  | '/(app)/(tabs)/profile';

export interface NavigationItem {
  name: string;
  href: AppRoute;
  icon: string;
  label: string;
}

// ─── UI Primitives ───────────────────────────────────────────────────────────

export interface ComponentProps {
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export interface ButtonProps extends ComponentProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
}

export interface CardProps extends ComponentProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  onPress?: () => void;
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

// ─── Theme ───────────────────────────────────────────────────────────────────

export interface ThemeColors {
  primary: Record<number, string>;
  secondary: Record<number, string>;
  gray: Record<number, string>;
  error: Record<number, string>;
  warning: Record<number, string>;
  success: Record<number, string>;
  info: Record<number, string>;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  disabled: string;
  placeholder: string;
  white: string;
  black: string;
}
