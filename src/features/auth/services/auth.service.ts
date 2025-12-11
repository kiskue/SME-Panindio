import { AuthResponse, LoginCredentials, ApiResponse } from '@/types';
import { APP_CONSTANTS, ERROR_CONSTANTS } from '@/core/constants';

class AuthService {
  private baseUrl = APP_CONSTANTS.API_BASE_URL;

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      // Validate input
      this.validateLoginCredentials(credentials);
      
      // Mock API call - replace with actual API call
      const response = await this.mockLogin(credentials);
      
      return response;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(ERROR_CONSTANTS.AUTHENTICATION_ERROR);
    }
  }

  async logout(): Promise<void> {
    try {
      // Mock API call - replace with actual API call
      await this.mockLogout();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Logout failed');
    }
  }

  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    try {
      // Mock API call - replace with actual API call
      const response = await this.mockRefreshToken(refreshToken);
      
      return response;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(ERROR_CONSTANTS.AUTHENTICATION_ERROR);
    }
  }

  async validateToken(token: string): Promise<boolean> {
    try {
      // Mock validation - replace with actual API call
      return await this.mockValidateToken(token);
    } catch (error) {
      return false;
    }
  }

  private validateLoginCredentials(credentials: LoginCredentials): void {
    if (!credentials.email || !credentials.password) {
      throw new Error('Email and password are required');
    }

    if (!APP_CONSTANTS.EMAIL_REGEX.test(credentials.email)) {
      throw new Error('Please enter a valid email address');
    }

    if (credentials.password.length < APP_CONSTANTS.VALIDATION_CONSTANTS.MIN_PASSWORD_LENGTH) {
      throw new Error(`Password must be at least ${APP_CONSTANTS.VALIDATION_CONSTANTS.MIN_PASSWORD_LENGTH} characters long`);
    }
  }

  // Mock API methods - replace with actual API calls
  private async mockLogin(credentials: LoginCredentials): Promise<AuthResponse> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Mock user data
    const mockUsers = [
      { email: 'user@example.com', password: 'password123', name: 'John Doe' },
      { email: 'demo@app.com', password: 'demo1234', name: 'Demo User' },
      { email: 'test@boilerplate.com', password: 'testpass', name: 'Test User' },
    ];

    const user = mockUsers.find(u => 
      u.email === credentials.email && u.password === credentials.password
    );

    if (!user) {
      throw new Error('Invalid email or password');
    }

    return {
      token: this.generateMockToken(),
      user: {
        id: Math.random().toString(36).substr(2, 9),
        email: user.email,
        name: user.name,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=007AFF&color=fff`,
      },
      expiresIn: 3600, // 1 hour
    };
  }

  private async mockLogout(): Promise<void> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Mock logout success
    return Promise.resolve();
  }

  private async mockRefreshToken(refreshToken: string): Promise<AuthResponse> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));

    // Mock refresh token
    return {
      token: this.generateMockToken(),
      user: {
        id: Math.random().toString(36).substr(2, 9),
        email: 'user@example.com',
        name: 'John Doe',
        avatar: 'https://ui-avatars.com/api/?name=John+Doe&background=007AFF&color=fff',
      },
      expiresIn: 3600, // 1 hour
    };
  }

  private async mockValidateToken(token: string): Promise<boolean> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Simple token validation (in real app, this would call your API)
    return token.length > 10 && token.includes('mock');
  }

  private generateMockToken(): string {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substr(2, 15);
    return `mock_token_${timestamp}_${randomString}`;
  }
}

export const authService = new AuthService();