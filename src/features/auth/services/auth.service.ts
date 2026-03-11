/**
 * AuthService
 *
 * Thin wrapper around Supabase Auth + the public.users table.
 * All Supabase-specific logic lives here so UI components and the
 * Zustand store stay framework-agnostic.
 *
 * Registration flow:
 *   1. supabase.auth.signUp()        — creates the auth.users row
 *   2. register_business_owner RPC   — atomically creates public.businesses
 *                                       and upserts public.users in one round-trip
 *
 * Passwords are hashed by Supabase Auth (bcrypt). Never store passwords in public.users.
 */

import { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import {
  AuthResponse,
  LoginCredentials,
  RegisterCredentials,
  UserProfile,
} from '@/types';
import { APP_CONSTANTS, ERROR_CONSTANTS, VALIDATION_CONSTANTS } from '@/core/constants';

// Shape returned by the register_business_owner RPC
interface RegisterRpcResult {
  businessId: string;
  userId: string;
}

class AuthService {
  // ── Public API ────────────────────────────────────────────────────────────

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    this.validateLoginCredentials(credentials);

    // Supabase Auth only accepts email+password. Resolve the email from the
    // username via a SECURITY DEFINER RPC (bypasses RLS without exposing the
    // full users table to anonymous callers).
    const { data: emailData, error: rpcError } = await supabase
      .rpc('get_email_by_username', {
        p_username: credentials.username.trim().toLowerCase(),
      });

    if (rpcError) throw new Error(rpcError.message);
    if (!emailData) throw new Error('No account found with that username.');

    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailData as string,
      password: credentials.password,
    });

    if (error) throw new Error(error.message);
    if (!data.session || !data.user) throw new Error(ERROR_CONSTANTS.AUTHENTICATION_ERROR);

    const profile = await this.fetchUserProfile(data.user.id);
    const displayName = profile
      ? `${profile.firstName} ${profile.lastName}`
      : (data.user.email ?? '');

    return {
      token: data.session.access_token,
      user: {
        id: data.user.id,
        email: data.user.email ?? '',
        name: displayName,
        ...(profile?.firstName !== undefined ? { firstName: profile.firstName } : {}),
        ...(profile?.lastName !== undefined ? { lastName: profile.lastName } : {}),
        ...(profile?.username !== undefined ? { username: profile.username } : {}),
        ...(profile?.business_id !== undefined && profile.business_id !== null
          ? { businessId: profile.business_id }
          : {}),
        ...(profile?.job_role_id !== undefined && profile.job_role_id !== null
          ? { jobRoleId: profile.job_role_id }
          : {}),
        ...(profile?.business?.name !== undefined
          ? { businessName: profile.business.name }
          : {}),
        ...(profile?.business?.business_type?.name !== undefined
          ? { businessTypeName: profile.business.business_type.name }
          : {}),
        ...(profile?.job_role?.name !== undefined
          ? { jobRoleName: profile.job_role.name }
          : {}),
        ...(profile?.business?.business_type?.pos_enabled !== undefined
          ? { posEnabled: profile.business.business_type.pos_enabled }
          : {}),
        role: profile?.role ?? 'user',
        avatar: this.buildAvatarUrl(displayName),
      },
      expiresIn: data.session.expires_in ?? 3600,
    };
  }

  /**
   * Register flow:
   * 1. Create Supabase Auth account (inserts into auth.users)
   * 2. Call register_business_owner RPC to atomically create:
   *    - public.businesses row
   *    - public.users upsert (with business_id and job_role_id)
   * 3. Return session / AuthResponse
   *
   * If email confirmation is required by Supabase settings, `token`
   * will be empty and `isAuthenticated` should NOT be set to true.
   */
  async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    this.validateRegisterCredentials(credentials);

    const { data, error } = await supabase.auth.signUp({
      email: credentials.email,
      password: credentials.password,
      options: {
        // Stored in auth.users.raw_user_meta_data — picked up by
        // the handle_new_user trigger for an initial minimal public.users row.
        data: {
          firstName: credentials.firstName,
          lastName:  credentials.lastName,
          username:  credentials.username,
        },
      },
    });

    if (error) throw new Error(error.message);
    if (!data.user) throw new Error('Registration failed. Please try again.');

    // Atomically create the business and complete the user profile.
    const { error: rpcError } = await supabase.rpc('register_business_owner', {
      p_user_id:          data.user.id,
      p_email:            credentials.email,
      p_first_name:       credentials.firstName,
      p_last_name:        credentials.lastName,
      p_username:         credentials.username,
      p_business_name:    credentials.businessName,
      p_business_type_id: credentials.businessTypeId,
      p_enterprise_type:  credentials.enterpriseType,
      p_job_role_id:      credentials.jobRoleId,
    });

    if (rpcError) {
      // Non-fatal when email confirmation is pending: the RPC may succeed later
      // once the user confirms. Log the error but do not abort registration.
      console.warn('[AuthService] register_business_owner RPC failed:', rpcError.message);
    }

    const displayName = `${credentials.firstName} ${credentials.lastName}`;

    // Email confirmation required — session is null until the user confirms.
    if (!data.session) {
      return {
        token: '',
        user: {
          id:              data.user.id,
          email:           credentials.email,
          name:            displayName,
          firstName:       credentials.firstName,
          lastName:        credentials.lastName,
          username:        credentials.username,
          businessName:    credentials.businessName,
          jobRoleId:       credentials.jobRoleId,
          role:            'admin',
        },
        expiresIn: 0,
      };
    }

    return {
      token: data.session.access_token,
      user: {
        id:              data.user.id,
        email:           credentials.email,
        name:            displayName,
        firstName:       credentials.firstName,
        lastName:        credentials.lastName,
        username:        credentials.username,
        businessName:    credentials.businessName,
        jobRoleId:       credentials.jobRoleId,
        role:            'admin',
        avatar:          this.buildAvatarUrl(displayName),
      },
      expiresIn: data.session.expires_in ?? 3600,
    };
  }

  async logout(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
  }

  /** Restore session from AsyncStorage (called on app start). */
  async getCurrentSession(): Promise<Session | null> {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.warn('[AuthService] getSession error:', error.message);
      return null;
    }
    return data.session;
  }

  async refreshToken(): Promise<AuthResponse | null> {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) throw new Error(error.message);
    if (!data.session || !data.user) return null;

    const profile = await this.fetchUserProfile(data.user.id);
    const displayName = profile
      ? `${profile.firstName} ${profile.lastName}`
      : (data.user.email ?? '');

    return {
      token: data.session.access_token,
      user: {
        id: data.user.id,
        email: data.user.email ?? '',
        name: displayName,
        ...(profile?.firstName !== undefined ? { firstName: profile.firstName } : {}),
        ...(profile?.lastName !== undefined ? { lastName: profile.lastName } : {}),
        ...(profile?.username !== undefined ? { username: profile.username } : {}),
        ...(profile?.business_id !== undefined && profile.business_id !== null
          ? { businessId: profile.business_id }
          : {}),
        ...(profile?.job_role_id !== undefined && profile.job_role_id !== null
          ? { jobRoleId: profile.job_role_id }
          : {}),
        ...(profile?.business?.name !== undefined
          ? { businessName: profile.business.name }
          : {}),
        ...(profile?.business?.business_type?.name !== undefined
          ? { businessTypeName: profile.business.business_type.name }
          : {}),
        ...(profile?.job_role?.name !== undefined
          ? { jobRoleName: profile.job_role.name }
          : {}),
        ...(profile?.business?.business_type?.pos_enabled !== undefined
          ? { posEnabled: profile.business.business_type.pos_enabled }
          : {}),
        role: profile?.role ?? 'user',
      },
      expiresIn: data.session.expires_in ?? 3600,
    };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async fetchUserProfile(userId: string): Promise<UserProfile | null> {
    const { data, error } = await supabase
      .from('users')
      .select(`
        *,
        business:businesses (
          name,
          enterprise_type,
          business_type:business_types (name, pos_enabled)
        ),
        job_role:job_roles (name)
      `)
      .eq('id', userId)
      .single();

    if (error) {
      console.warn('[AuthService] fetchUserProfile:', error.message);
      return null;
    }

    return data as UserProfile;
  }

  private buildAvatarUrl(name: string): string {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1E4D8C&color=fff`;
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
    // Validate email + password for signUp (register still uses email)
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
    if (!credentials.jobRoleId || credentials.jobRoleId < 1) {
      throw new Error('Please select your job role');
    }
    if (!credentials.enterpriseType) {
      throw new Error('Please select enterprise type');
    }
  }
}

export const authService = new AuthService();

// Re-export the RPC result type so callers can use it if needed.
export type { RegisterRpcResult };
