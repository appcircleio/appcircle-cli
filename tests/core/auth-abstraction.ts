/**
 * @fileoverview Test-only authentication abstraction layer
 * Provides unified auth interface without modifying src files
 */

export interface AuthCredentials {
  pat?: string;
  personalAccessKey?: string;
  apiKey?: string;
  username?: string;
  organizationId?: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface AuthInterface {
  getAccessToken(): string | null;
  setAccessToken(token: string): void;
  clearTokens(): void;
  login(credentials: AuthCredentials): Promise<AuthResponse>;
  isAuthenticated(): boolean;
}

/**
 * Mock auth implementation for testing
 */
export class MockAuth implements AuthInterface {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private shouldFail: boolean = false;
  private failureMessage: string = 'Authentication failed';

  constructor(shouldFail = false, failureMessage = 'Authentication failed') {
    this.shouldFail = shouldFail;
    this.failureMessage = failureMessage;
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;
  }

  async login(credentials: AuthCredentials): Promise<AuthResponse> {
    if (this.isAuthenticated()) {
      throw new Error('Already authenticated. Use logout first.');
    }

    if (this.shouldFail) {
      throw new Error(this.failureMessage);
    }

    // Validate credentials
    if (!this.validateCredentials(credentials)) {
      throw new Error('Invalid credentials');
    }

    // Simulate successful login
    const response: AuthResponse = {
      access_token: this.shouldFail ? 'invalid_token' : 'mock_success_token',
      refresh_token: 'mock_refresh_token',
      expires_in: 3600,
      token_type: 'Bearer'
    };

    this.accessToken = response.access_token;
    this.refreshToken = response.refresh_token;

    return response;
  }

  isAuthenticated(): boolean {
    return this.accessToken !== null && this.accessToken !== '';
  }

  private validateCredentials(credentials: AuthCredentials): boolean {
    if (credentials.pat) return true;
    if (credentials.personalAccessKey) return true;
    if (credentials.apiKey && credentials.username) return true;
    return false;
  }

  // Test helper methods
  setFailureMode(shouldFail: boolean, message?: string): void {
    this.shouldFail = shouldFail;
    if (message) this.failureMessage = message;
  }
}

/**
 * In-memory auth implementation for testing
 */
export class MemoryAuth implements AuthInterface {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  getAccessToken(): string | null {
    return this.accessToken;
  }

  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;
  }

  async login(credentials: AuthCredentials): Promise<AuthResponse> {
    if (this.isAuthenticated()) {
      throw new Error('Already authenticated. Use logout first.');
    }

    // Validate credentials
    if (!this.validateCredentials(credentials)) {
      throw new Error('Invalid credentials');
    }

    // Simulate successful login
    const response: AuthResponse = {
      access_token: `mock_token_${Date.now()}`,
      refresh_token: `mock_refresh_${Date.now()}`,
      expires_in: 3600,
      token_type: 'Bearer'
    };

    this.accessToken = response.access_token;
    this.refreshToken = response.refresh_token;

    return response;
  }

  isAuthenticated(): boolean {
    return this.accessToken !== null && this.accessToken !== '';
  }

  private validateCredentials(credentials: AuthCredentials): boolean {
    if (credentials.pat) return true;
    if (credentials.personalAccessKey) return true;
    if (credentials.apiKey && credentials.username) return true;
    return false;
  }
}

// Global test auth instance
let testAuthInstance: AuthInterface = new MemoryAuth();

/**
 * Get current auth instance (for testing)
 */
export function getAuth(): AuthInterface {
  return testAuthInstance;
}

/**
 * Set auth instance (for testing)
 */
export function setAuth(auth: AuthInterface): void {
  testAuthInstance = auth;
}

/**
 * Convenience functions using the test auth instance
 */
export function getAccessToken(): string | null {
  return testAuthInstance.getAccessToken();
}

export function isAuthenticated(): boolean {
  return testAuthInstance.isAuthenticated();
}

export function login(credentials: AuthCredentials): Promise<AuthResponse> {
  return testAuthInstance.login(credentials);
}

export function clearTokens(): void {
  testAuthInstance.clearTokens();
}