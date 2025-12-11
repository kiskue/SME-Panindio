// Core TypeScript type definitions for the enterprise boilerplate

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
  expiresIn: number;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: NotificationType;
  data?: Record<string, any>;
  isRead: boolean;
  createdAt: Date;
}

export type NotificationType = 'CHAT_MESSAGE' | 'ALERT' | 'INFO' | 'WARNING';

export interface LoginCredentials {
  email: string;
  password: string;
}

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

export type AppRoute = 
  | '/onboarding'
  | '/auth/login'
  | '/app/(tabs)/home'
  | '/app/(tabs)/profile'
  | '/app/(tabs)/notifications';

export interface NavigationItem {
  name: string;
  href: AppRoute;
  icon: string;
  label: string;
}

export interface ThemeColors {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  error: string;
  success: string;
  warning: string;
  info: string;
}

export interface ComponentProps {
  className?: string;
  style?: any;
  testID?: string;
}

export interface FormFieldProps extends ComponentProps {
  label: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  error?: string;
  disabled?: boolean;
}

export interface ButtonProps extends ComponentProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'small' | 'medium' | 'large';
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