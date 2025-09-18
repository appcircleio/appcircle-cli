import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as commandRunner from '../../../src/core/command-runner';

// Mock dependencies
vi.mock('fs');
vi.mock('os');
vi.mock('path');
vi.mock('@/services');
vi.mock('enquirer');
vi.mock('chalk', () => ({
  default: {
    red: vi.fn((text) => text),
    green: vi.fn((text) => text),
    yellow: vi.fn((text) => text),
    blue: vi.fn((text) => text),
    cyan: vi.fn((text) => text),
    gray: vi.fn((text) => text),
    hex: vi.fn(() => vi.fn((text) => text)),
  }
}));

describe('Command Runner - Simple Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('checkIfUserAlreadyLoggedIn', () => {
    it('should return boolean value', () => {
      const result = commandRunner.checkIfUserAlreadyLoggedIn();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('checkIfUserIsLoggedIn', () => {
    it('should return boolean value', () => {
      const result = commandRunner.checkIfUserIsLoggedIn();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('handleAlreadyLoggedIn', () => {
    it('should log error message', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      commandRunner.handleAlreadyLoggedIn();

      expect(consoleSpy).toHaveBeenCalledWith('You are already logged in. Use "logout" to logout first.');
      consoleSpy.mockRestore();
    });
  });

  describe('clearStoredToken', () => {
    it('should execute without throwing', () => {
      expect(() => commandRunner.clearStoredToken()).not.toThrow();
    });
  });

  describe('displayLogoutSuccessMessage', () => {
    it('should display logout message', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      commandRunner.displayLogoutSuccessMessage();

      expect(consoleSpy).toHaveBeenCalledWith('Successfully logged out from Appcircle.');
      consoleSpy.mockRestore();
    });
  });

  describe('decodeJwtToken', () => {
    it('should decode valid JWT token', () => {
      const validToken = 'header.' + Buffer.from('{"currentOrganizationId":"org-123"}').toString('base64') + '.signature';

      const result = commandRunner.decodeJwtToken(validToken);

      expect(result).toEqual({ currentOrganizationId: 'org-123' });
    });

    it('should return null for invalid token', () => {
      const invalidToken = 'invalid-token';

      const result = commandRunner.decodeJwtToken(invalidToken);

      expect(result).toBeNull();
    });

    it('should return null for malformed JSON', () => {
      const invalidToken = 'header.' + Buffer.from('invalid-json').toString('base64') + '.signature';

      const result = commandRunner.decodeJwtToken(invalidToken);

      expect(result).toBeNull();
    });
  });

  describe('validateOrganizationId', () => {
    it('should return true when no validation needed', () => {
      const params = {};
      const responseData = {};

      const result = commandRunner.validateOrganizationId(params, responseData);

      expect(result).toBe(true);
    });

    it('should return true when organization IDs match', () => {
      const params = { 'organization-id': 'org-123' };
      const responseData = {
        access_token: 'header.' + Buffer.from('{"currentOrganizationId":"org-123"}').toString('base64') + '.signature'
      };

      const result = commandRunner.validateOrganizationId(params, responseData);

      expect(result).toBe(true);
    });

    it('should return false when organization IDs do not match', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const params = { 'organization-id': 'org-123' };
      const responseData = {
        access_token: 'header.' + Buffer.from('{"currentOrganizationId":"org-456"}').toString('base64') + '.signature'
      };

      const result = commandRunner.validateOrganizationId(params, responseData);

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should return true when JWT decode fails', () => {
      const params = { 'organization-id': 'org-123' };
      const responseData = { access_token: 'invalid-token' };

      const result = commandRunner.validateOrganizationId(params, responseData);

      expect(result).toBe(true);
    });
  });

  describe('getLongDescriptionForCommand', () => {
    it('should return undefined for unknown command', () => {
      const result = commandRunner.getLongDescriptionForCommand('unknown-command');
      expect(result).toBeUndefined();
    });

    it('should handle command name normalization', () => {
      const result = commandRunner.getLongDescriptionForCommand('appcircle-build-start');
      // Should not throw and return string or undefined
      expect(typeof result === 'string' || result === undefined).toBe(true);
    });
  });
});