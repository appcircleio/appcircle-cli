/**
 * Auth mocking utilities for tests
 */
import { vi } from 'vitest';
import { MemoryAuth, MockAuth, setAuth, type AuthInterface, type AuthCredentials, type AuthResponse } from '../core/auth-abstraction';

export class MockAuthSuccess extends MemoryAuth {
  async login(credentials: AuthCredentials): Promise<AuthResponse> {
    const response: AuthResponse = {
      access_token: 'mock_success_token',
      refresh_token: 'mock_refresh_token',
      expires_in: 3600,
      token_type: 'Bearer'
    };
    
    this.setAccessToken(response.access_token);
    return response;
  }
}

export class MockAuthFailure implements AuthInterface {
  getAccessToken(): string | null {
    return null;
  }

  setAccessToken(token: string): void {
    // Do nothing
  }

  clearTokens(): void {
    // Do nothing
  }

  async login(credentials: AuthCredentials): Promise<AuthResponse> {
    throw new Error('Authentication failed');
  }

  isAuthenticated(): boolean {
    return false;
  }
}

export class MockAuthExpired implements AuthInterface {
  private hasExpiredToken = true;

  getAccessToken(): string | null {
    return this.hasExpiredToken ? 'expired_token' : null;
  }

  setAccessToken(token: string): void {
    this.hasExpiredToken = false;
  }

  clearTokens(): void {
    this.hasExpiredToken = false;
  }

  async login(credentials: AuthCredentials): Promise<AuthResponse> {
    throw new Error('Token expired');
  }

  isAuthenticated(): boolean {
    return this.hasExpiredToken;
  }
}

/**
 * Sets up auth mocking for tests
 */
export const setupAuthMocks = () => {
  const mockAuth = new MemoryAuth();
  setAuth(mockAuth);
  return mockAuth;
};

/**
 * Sets up successful auth scenario
 */
export const setupAuthSuccess = () => {
  const mockAuth = new MockAuthSuccess();
  setAuth(mockAuth);
  return mockAuth;
};

/**
 * Sets up failed auth scenario
 */
export const setupAuthFailure = () => {
  const mockAuth = new MockAuthFailure();
  setAuth(mockAuth);
  return mockAuth;
};

/**
 * Sets up expired token scenario
 */
export const setupAuthExpired = () => {
  const mockAuth = new MockAuthExpired();
  setAuth(mockAuth);
  return mockAuth;
};

/**
 * Resets auth to default state
 */
export const resetAuth = () => {
  const memoryAuth = new MemoryAuth();
  setAuth(memoryAuth);
  return memoryAuth;
};