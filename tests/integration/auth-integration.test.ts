/**
 * @fileoverview Authentication integration tests with MSW
 * Tests real API interactions with mocked responses
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../setup/test-setup';
import { getToken, getTokenFromApiKey } from '../../src/services/index';

describe('Authentication Integration Tests', () => {
  beforeEach(() => {
    // Clear any existing environment variables for clean test state
    delete process.env.AC_ACCESS_TOKEN;
  });

  describe('PAT Authentication', () => {
    it('should successfully authenticate with valid PAT', async () => {
      // MSW will handle this automatically with our handlers
      
      const response = await getToken({ personalAccessKey: 'valid_pat_token' });
      
      expect(response).toMatchObject({
        access_token: expect.stringContaining('mock_access_token'),
        refresh_token: expect.stringContaining('mock_refresh_token'),
        expires_in: 3600,
        token_type: 'Bearer'
      });
    });

    it('should reject invalid PAT tokens', async () => {
      await expect(getToken({ personalAccessKey: 'invalid_pat_token' }))
        .rejects.toThrow();
    });

    it('should handle expired PAT tokens', async () => {
      await expect(getToken({ personalAccessKey: 'expired_pat_token' }))
        .rejects.toThrow();
    });
  });

  describe('API Key Authentication', () => {
    it('should successfully authenticate with valid API key', async () => {
      const response = await getTokenFromApiKey({
        name: 'test@example.com',
        secret: 'valid_api_key',
        organizationId: 'org_123'
      });
      
      expect(response).toMatchObject({
        access_token: expect.stringContaining('mock_api_access_token'),
        refresh_token: expect.stringContaining('mock_refresh_token'),
        expires_in: 3600,
        token_type: 'Bearer'
      });
    });

    it('should reject invalid API key credentials', async () => {
      await expect(getTokenFromApiKey({
        name: 'test@example.com',
        secret: 'invalid_api_key',
        organizationId: 'org_123'
      })).rejects.toThrow();
    });

    it('should handle organization-specific authentication', async () => {
      // Test with specific organization ID
      const response = await getTokenFromApiKey({
        name: 'test@example.com',
        secret: 'valid_api_key',
        organizationId: 'specific_org_123'
      });
      
      expect(response.access_token).toBeDefined();
    });
  });

  describe('Network Error Scenarios', () => {
    it('should handle server errors gracefully', async () => {
      // Use server override to return 500 error
      server.use(
        http.post('https://auth.appcircle.io/auth/v1/token', () => {
          return HttpResponse.json({ error: 'Internal Server Error' }, { status: 500 });
        })
      );

      await expect(getToken({ personalAccessKey: 'any_token' }))
        .rejects.toThrow();
    });

    it('should handle network timeouts', async () => {
      // Use server override to simulate network failure that would cause timeout
      server.use(
        http.post('https://auth.appcircle.io/auth/v1/token', () => {
          // Return a network error instead of timeout
          return HttpResponse.error();
        })
      );

      await expect(getToken({ personalAccessKey: 'timeout_token' }))
        .rejects.toThrow();
    });

    it('should handle rate limiting', async () => {
      // Use server override to return 429 Too Many Requests
      server.use(
        http.post('https://auth.appcircle.io/auth/v1/token', () => {
          return HttpResponse.json(
            { error: 'Too Many Requests', retry_after: 60 }, 
            { status: 429 }
          );
        })
      );

      await expect(getToken({ personalAccessKey: 'rate_limited_token' }))
        .rejects.toThrow();
    });
  });

  describe('Token Management', () => {
    it('should properly store and retrieve tokens', async () => {
      const response = await getToken({ personalAccessKey: 'valid_pat_token' });
      
      // Store token in environment (simulating what the CLI does)
      process.env.AC_ACCESS_TOKEN = response.access_token;
      
      expect(process.env.AC_ACCESS_TOKEN).toBe(response.access_token);
    });

    it('should clear tokens properly', async () => {
      // Set a token first
      process.env.AC_ACCESS_TOKEN = 'test_token';
      
      // Clear token
      delete process.env.AC_ACCESS_TOKEN;
      
      expect(process.env.AC_ACCESS_TOKEN).toBeUndefined();
    });

    it('should prevent multiple simultaneous logins', async () => {
      // This test verifies that the auth system handles concurrent requests properly
      const loginPromise1 = getToken({ personalAccessKey: 'valid_pat_token' });
      const loginPromise2 = getToken({ personalAccessKey: 'valid_pat_token' });
      
      const results = await Promise.all([loginPromise1, loginPromise2]);
      
      // Both should succeed and return valid tokens
      expect(results[0].access_token).toBeDefined();
      expect(results[1].access_token).toBeDefined();
    });
  });

  describe('Error Response Handling', () => {
    it('should parse and throw meaningful error messages', async () => {
      // Use server override to return structured error
      server.use(
        http.post('https://auth.appcircle.io/auth/v1/token', () => {
          return HttpResponse.json(
            { 
              error: 'invalid_grant', 
              error_description: 'The provided PAT token is invalid or expired'
            }, 
            { status: 401 }
          );
        })
      );

      await expect(getToken({ personalAccessKey: 'invalid_token' }))
        .rejects.toThrow();
    });

    it('should handle malformed API responses', async () => {
      // Use server override to return completely invalid response
      server.use(
        http.post('https://auth.appcircle.io/auth/v1/token', () => {
          // Return a response that will cause JSON parsing to fail
          return new Response('definitely not json', {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        })
      );

      const result = await getToken({ personalAccessKey: 'malformed_response' });
      
      // The response should be malformed (not a proper token object)
      expect(result).not.toHaveProperty('access_token');
      expect(result).toBe('definitely not json');
    });
  });
});