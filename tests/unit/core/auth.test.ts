/**
 * @fileoverview Auth abstraction unit tests
 * Tests the authentication layer with different scenarios
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  MemoryAuth, 
  MockAuth,
  setAuth, 
  getAuth,
  getAccessToken,
  isAuthenticated,
  login 
} from '../../core/auth-abstraction';
import { setupAuthMocks, setupAuthSuccess, setupAuthFailure } from '../../setup/auth-mocks';

describe('Auth Abstraction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('MemoryAuth', () => {
    it('should start with no authentication', () => {
      const auth = new MemoryAuth();
      expect(auth.isAuthenticated()).toBe(false);
      expect(auth.getAccessToken()).toBe(null);
    });

    it('should store and retrieve tokens', () => {
      const auth = new MemoryAuth();
      const token = 'test_token_123';
      
      auth.setAccessToken(token);
      
      expect(auth.getAccessToken()).toBe(token);
      expect(auth.isAuthenticated()).toBe(true);
    });

    it('should clear tokens', () => {
      const auth = new MemoryAuth();
      
      auth.setAccessToken('test_token');
      expect(auth.isAuthenticated()).toBe(true);
      
      auth.clearTokens();
      expect(auth.isAuthenticated()).toBe(false);
      expect(auth.getAccessToken()).toBe(null);
    });

    it('should perform mock login', async () => {
      const auth = new MemoryAuth();
      
      const response = await auth.login({ pat: 'test_pat' });
      
      expect(response).toMatchObject({
        access_token: expect.stringContaining('mock_token_'),
        refresh_token: expect.stringContaining('mock_refresh_'),
        expires_in: 3600
      });
      expect(auth.isAuthenticated()).toBe(true);
    });

    it('should prevent login when already authenticated', async () => {
      const auth = new MemoryAuth();
      
      await auth.login({ pat: 'first_login' });
      
      await expect(auth.login({ pat: 'second_login' }))
        .rejects.toThrow('Already authenticated. Use logout first.');
    });
  });

  describe('Global Auth Interface', () => {
    it('should use memory auth for testing', () => {
      const mockAuth = setupAuthMocks();
      
      expect(getAuth()).toBe(mockAuth);
      expect(isAuthenticated()).toBe(false);
    });

    it('should handle successful authentication', async () => {
      setupAuthSuccess();
      
      expect(isAuthenticated()).toBe(false);
      
      const response = await login({ pat: 'valid_pat' });
      
      expect(response.access_token).toBe('mock_success_token');
      expect(isAuthenticated()).toBe(true);
      expect(getAccessToken()).toBe('mock_success_token');
    });

    it('should handle failed authentication', async () => {
      setupAuthFailure();
      
      await expect(login({ pat: 'invalid_pat' }))
        .rejects.toThrow('Authentication failed');
      
      expect(isAuthenticated()).toBe(false);
    });

    it('should swap auth implementations', () => {
      const customAuth = new MemoryAuth();
      customAuth.setAccessToken('custom_token');
      
      setAuth(customAuth);
      
      expect(getAccessToken()).toBe('custom_token');
      expect(isAuthenticated()).toBe(true);
    });
  });

  describe('Auth Scenarios', () => {
    it('should handle PAT authentication', async () => {
      const mockAuth = setupAuthSuccess();
      
      const response = await login({ pat: 'valid_pat_token' });
      
      expect(response).toMatchObject({
        access_token: 'mock_success_token',
        refresh_token: 'mock_refresh_token'
      });
    });

    it('should handle API key authentication', async () => {
      const mockAuth = setupAuthSuccess();
      
      const response = await login({
        apiKey: 'valid_api_key',
        username: 'test@example.com'
      });
      
      expect(response.access_token).toBeTruthy();
    });

    it('should handle API key with organization', async () => {
      const mockAuth = setupAuthSuccess();
      
      const response = await login({
        apiKey: 'valid_api_key',
        username: 'test@example.com',
        organizationId: 'org_123'
      });
      
      expect(response.access_token).toBeTruthy();
    });

  });
});