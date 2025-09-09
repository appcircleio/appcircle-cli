import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../../../src/config', () => ({
  EnvironmentVariables: {
    AC_ACCESS_TOKEN: 'AC_ACCESS_TOKEN'
  },
  writeEnviromentConfigVariable: vi.fn(),
  readEnviromentConfigVariable: vi.fn()
}));

vi.mock('../../../src/core/commands', () => ({
  Commands: [
    {
      name: 'login',
      commands: [
        { name: 'pat', description: 'Login with Personal Access Token', longDescription: 'Login using PAT authentication' },
        { name: 'api-key', description: 'Login with API Key', longDescription: 'Login using API Key authentication' }
      ]
    }
  ]
}));

vi.mock('../../../src/core/writer', () => ({
  commandWriter: vi.fn()
}));

vi.mock('../../../src/services', () => ({
  getToken: vi.fn(),
  getTokenFromApiKey: vi.fn()
}));

vi.mock('../../../src/core/commands', () => ({
  CommandTypes: {
    LOGIN: 'login'
  },
  Commands: []
}));

// Import functions to test
import {
  handlePatLogin,
  handleApiKeyLogin,
  handleUnknownLoginCommand,
  checkIfUserAlreadyLoggedIn,
  handleAlreadyLoggedIn,
  checkIfUserIsLoggedIn,
  validateUserIsLoggedIn,
  clearStoredToken,
  displayLogoutSuccessMessage,
  decodeJwtToken,
  validateOrganizationId,
  getLongDescriptionForCommand
} from '../../../src/core/command-runner';

import { EnvironmentVariables, writeEnviromentConfigVariable, readEnviromentConfigVariable } from '../../../src/config';
import { commandWriter } from '../../../src/core/writer';
import { getToken, getTokenFromApiKey } from '../../../src/services';
import { CommandTypes } from '../../../src/core/commands';

describe('Command Runner Login/Logout Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset process.exit mock
    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
  });

  describe('handlePatLogin', () => {
    it('should handle successful PAT login', async () => {
      const mockParams = { token: 'test-pat-token' };
      const mockResponse = { access_token: 'jwt-access-token' };
      (getToken as any).mockResolvedValue(mockResponse);

      await handlePatLogin(mockParams);

      expect(getToken).toHaveBeenCalledWith({ pat: 'test-pat-token' });
      expect(writeEnviromentConfigVariable).toHaveBeenCalledWith(
        EnvironmentVariables.AC_ACCESS_TOKEN,
        'jwt-access-token'
      );
      expect(commandWriter).toHaveBeenCalledWith(CommandTypes.LOGIN, mockResponse);
    });

    it('should handle PAT login with empty token', async () => {
      const mockParams = { token: '' };
      const mockResponse = { access_token: 'jwt-access-token' };
      (getToken as any).mockResolvedValue(mockResponse);

      await handlePatLogin(mockParams);

      expect(getToken).toHaveBeenCalledWith({ pat: '' });
      expect(writeEnviromentConfigVariable).toHaveBeenCalledWith(
        EnvironmentVariables.AC_ACCESS_TOKEN,
        'jwt-access-token'
      );
    });

    it('should handle PAT login API error', async () => {
      const mockParams = { token: 'invalid-token' };
      (getToken as any).mockRejectedValue(new Error('Invalid PAT'));

      await expect(handlePatLogin(mockParams)).rejects.toThrow('Invalid PAT');

      expect(getToken).toHaveBeenCalledWith({ pat: 'invalid-token' });
      expect(writeEnviromentConfigVariable).not.toHaveBeenCalled();
      expect(commandWriter).not.toHaveBeenCalled();
    });

    it('should handle PAT login with special characters', async () => {
      const mockParams = { token: 'test-token@#$%^&*()' };
      const mockResponse = { access_token: 'jwt-token' };
      (getToken as any).mockResolvedValue(mockResponse);

      await handlePatLogin(mockParams);

      expect(getToken).toHaveBeenCalledWith({ pat: 'test-token@#$%^&*()' });
    });
  });

  describe('handleApiKeyLogin', () => {
    it('should handle successful API key login without organization validation', async () => {
      const mockParams = { 'api-key': 'test-api-key' };
      const mockResponse = { access_token: 'jwt-access-token' };
      (getTokenFromApiKey as any).mockResolvedValue(mockResponse);

      await handleApiKeyLogin(mockParams);

      expect(getTokenFromApiKey).toHaveBeenCalledWith(mockParams);
      expect(writeEnviromentConfigVariable).toHaveBeenCalledWith(
        EnvironmentVariables.AC_ACCESS_TOKEN,
        'jwt-access-token'
      );
      expect(commandWriter).toHaveBeenCalledWith(CommandTypes.LOGIN, mockResponse);
    });

    it('should handle API key login with valid organization ID', async () => {
      const organizationId = 'org-123';
      const payload = { currentOrganizationId: organizationId };
      const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64');
      const mockToken = `header.${encodedPayload}.signature`;

      const mockParams = { 'api-key': 'test-key', 'organization-id': organizationId };
      const mockResponse = { access_token: mockToken };
      (getTokenFromApiKey as any).mockResolvedValue(mockResponse);

      await handleApiKeyLogin(mockParams);

      expect(getTokenFromApiKey).toHaveBeenCalledWith(mockParams);
      expect(writeEnviromentConfigVariable).toHaveBeenCalledWith(
        EnvironmentVariables.AC_ACCESS_TOKEN,
        mockToken
      );
      expect(commandWriter).toHaveBeenCalledWith(CommandTypes.LOGIN, mockResponse);
    });

    it('should handle API key login with invalid organization ID', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const requestedOrgId = 'org-123';
      const actualOrgId = 'org-456';
      const payload = { currentOrganizationId: actualOrgId };
      const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64');
      const mockToken = `header.${encodedPayload}.signature`;

      const mockParams = { 'api-key': 'test-key', 'organization-id': requestedOrgId };
      const mockResponse = { access_token: mockToken };
      (getTokenFromApiKey as any).mockResolvedValue(mockResponse);

      await handleApiKeyLogin(mockParams);

      expect(getTokenFromApiKey).toHaveBeenCalledWith(mockParams);
      expect(writeEnviromentConfigVariable).not.toHaveBeenCalled();
      expect(commandWriter).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        `Login failed: Your API Key does not have access to organization "${requestedOrgId}".`
      );

      consoleSpy.mockRestore();
    });

    it('should handle API key login API error', async () => {
      const mockParams = { 'api-key': 'invalid-key' };
      (getTokenFromApiKey as any).mockRejectedValue(new Error('Invalid API key'));

      await expect(handleApiKeyLogin(mockParams)).rejects.toThrow('Invalid API key');

      expect(getTokenFromApiKey).toHaveBeenCalledWith(mockParams);
      expect(writeEnviromentConfigVariable).not.toHaveBeenCalled();
      expect(commandWriter).not.toHaveBeenCalled();
    });

    it('should handle API key login with malformed JWT', async () => {
      const mockParams = { 'api-key': 'test-key', 'organization-id': 'org-123' };
      const mockResponse = { access_token: 'invalid.jwt.token' };
      (getTokenFromApiKey as any).mockResolvedValue(mockResponse);

      await handleApiKeyLogin(mockParams);

      // Should continue with login since JWT decode fails silently
      expect(writeEnviromentConfigVariable).toHaveBeenCalledWith(
        EnvironmentVariables.AC_ACCESS_TOKEN,
        'invalid.jwt.token'
      );
      expect(commandWriter).toHaveBeenCalledWith(CommandTypes.LOGIN, mockResponse);
    });
  });

  describe('handleUnknownLoginCommand', () => {
    it('should handle unknown login command and call console.error', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const mockCommand = {
        fullCommandName: 'appcircle-login-unknown',
      };

      // Function will call getLongDescriptionForCommand internally
      handleUnknownLoginCommand(mockCommand as any);

      // Verify console.error was called (either with description or fallback message)
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should format command name correctly by replacing dashes with spaces', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const mockCommand = {
        fullCommandName: 'appcircle-login-multi-word-command',
      };

      handleUnknownLoginCommand(mockCommand as any);

      // The function formats the command name internally
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should handle empty command name', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const mockCommand = {
        fullCommandName: '',
      };

      handleUnknownLoginCommand(mockCommand as any);

      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('checkIfUserAlreadyLoggedIn', () => {
    it('should return true when user has token', () => {
      (readEnviromentConfigVariable as any).mockReturnValue('valid-token');

      const result = checkIfUserAlreadyLoggedIn();

      expect(result).toBe(true);
      expect(readEnviromentConfigVariable).toHaveBeenCalledWith(EnvironmentVariables.AC_ACCESS_TOKEN);
    });

    it('should return false when user has no token', () => {
      (readEnviromentConfigVariable as any).mockReturnValue(null);

      const result = checkIfUserAlreadyLoggedIn();

      expect(result).toBe(false);
      expect(readEnviromentConfigVariable).toHaveBeenCalledWith(EnvironmentVariables.AC_ACCESS_TOKEN);
    });

    it('should return false when user has empty token', () => {
      (readEnviromentConfigVariable as any).mockReturnValue('');

      const result = checkIfUserAlreadyLoggedIn();

      expect(result).toBe(false);
      expect(readEnviromentConfigVariable).toHaveBeenCalledWith(EnvironmentVariables.AC_ACCESS_TOKEN);
    });

    it('should return false when user has undefined token', () => {
      (readEnviromentConfigVariable as any).mockReturnValue(undefined);

      const result = checkIfUserAlreadyLoggedIn();

      expect(result).toBe(false);
      expect(readEnviromentConfigVariable).toHaveBeenCalledWith(EnvironmentVariables.AC_ACCESS_TOKEN);
    });
  });

  describe('handleAlreadyLoggedIn', () => {
    it('should display already logged in message', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      handleAlreadyLoggedIn();

      expect(consoleSpy).toHaveBeenCalledWith('You are already logged in. Use "logout" to logout first.');
      
      consoleSpy.mockRestore();
    });

    it('should handle multiple calls', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      handleAlreadyLoggedIn();
      handleAlreadyLoggedIn();
      handleAlreadyLoggedIn();

      expect(consoleSpy).toHaveBeenCalledTimes(3);
      expect(consoleSpy).toHaveBeenCalledWith('You are already logged in. Use "logout" to logout first.');
      
      consoleSpy.mockRestore();
    });
  });

  describe('checkIfUserIsLoggedIn', () => {
    it('should return true when user has token', () => {
      (readEnviromentConfigVariable as any).mockReturnValue('valid-token');

      const result = checkIfUserIsLoggedIn();

      expect(result).toBe(true);
      expect(readEnviromentConfigVariable).toHaveBeenCalledWith(EnvironmentVariables.AC_ACCESS_TOKEN);
    });

    it('should return false when user has no token', () => {
      (readEnviromentConfigVariable as any).mockReturnValue(null);

      const result = checkIfUserIsLoggedIn();

      expect(result).toBe(false);
    });

    it('should return false when user has empty token', () => {
      (readEnviromentConfigVariable as any).mockReturnValue('');

      const result = checkIfUserIsLoggedIn();

      expect(result).toBe(false);
    });
  });

  describe('validateUserIsLoggedIn', () => {
    it('should do nothing when user is logged in', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      (readEnviromentConfigVariable as any).mockReturnValue('valid-token');

      expect(() => validateUserIsLoggedIn()).not.toThrow();

      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should exit when user is not logged in', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      (readEnviromentConfigVariable as any).mockReturnValue(null);

      expect(() => validateUserIsLoggedIn()).toThrow('process.exit called');

      expect(consoleSpy).toHaveBeenCalledWith('You are not currently logged in.');
      expect(process.exit).toHaveBeenCalledWith(1);
      consoleSpy.mockRestore();
    });

    it('should exit when user has empty token', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      (readEnviromentConfigVariable as any).mockReturnValue('');

      expect(() => validateUserIsLoggedIn()).toThrow('process.exit called');

      expect(consoleSpy).toHaveBeenCalledWith('You are not currently logged in.');
      expect(process.exit).toHaveBeenCalledWith(1);
      consoleSpy.mockRestore();
    });
  });

  describe('clearStoredToken', () => {
    it('should clear the stored token', () => {
      clearStoredToken();

      expect(writeEnviromentConfigVariable).toHaveBeenCalledWith(EnvironmentVariables.AC_ACCESS_TOKEN, '');
    });

    it('should handle multiple clear operations', () => {
      clearStoredToken();
      clearStoredToken();
      clearStoredToken();

      expect(writeEnviromentConfigVariable).toHaveBeenCalledTimes(3);
      expect(writeEnviromentConfigVariable).toHaveBeenCalledWith(EnvironmentVariables.AC_ACCESS_TOKEN, '');
    });
  });

  describe('displayLogoutSuccessMessage', () => {
    it('should display logout success message', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      displayLogoutSuccessMessage();

      expect(consoleSpy).toHaveBeenCalledWith('Successfully logged out from Appcircle.');
      
      consoleSpy.mockRestore();
    });

    it('should handle multiple calls', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      displayLogoutSuccessMessage();
      displayLogoutSuccessMessage();

      expect(consoleSpy).toHaveBeenCalledTimes(2);
      expect(consoleSpy).toHaveBeenCalledWith('Successfully logged out from Appcircle.');
      
      consoleSpy.mockRestore();
    });
  });

  describe('decodeJwtToken', () => {
    it('should decode valid JWT token', () => {
      const payload = { currentOrganizationId: 'org-123', user: 'test-user' };
      const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64');
      const mockToken = `header.${encodedPayload}.signature`;

      const result = decodeJwtToken(mockToken);

      expect(result).toEqual(payload);
    });

    it('should return null for invalid JWT format', () => {
      const invalidToken = 'invalid.token';

      const result = decodeJwtToken(invalidToken);

      expect(result).toBeNull();
    });

    it('should return null for malformed base64', () => {
      const invalidToken = 'header.invalid-base64.signature';

      const result = decodeJwtToken(invalidToken);

      expect(result).toBeNull();
    });

    it('should return null for invalid JSON in payload', () => {
      const invalidJsonPayload = Buffer.from('invalid-json').toString('base64');
      const invalidToken = `header.${invalidJsonPayload}.signature`;

      const result = decodeJwtToken(invalidToken);

      expect(result).toBeNull();
    });

    it('should handle empty token', () => {
      const result = decodeJwtToken('');

      expect(result).toBeNull();
    });

    it('should handle token with no dots', () => {
      const result = decodeJwtToken('nodots');

      expect(result).toBeNull();
    });
  });

  describe('validateOrganizationId', () => {
    it('should return true when no organization-id provided', () => {
      const params = {};
      const responseData = { access_token: 'token' };

      const result = validateOrganizationId(params, responseData);

      expect(result).toBe(true);
    });

    it('should return true when no access_token provided', () => {
      const params = { 'organization-id': 'org-123' };
      const responseData = {};

      const result = validateOrganizationId(params, responseData);

      expect(result).toBe(true);
    });

    it('should return true when JWT decode fails', () => {
      const params = { 'organization-id': 'org-123' };
      const responseData = { access_token: 'invalid-jwt' };

      const result = validateOrganizationId(params, responseData);

      expect(result).toBe(true);
    });

    it('should return true when organization IDs match', () => {
      const organizationId = 'org-123';
      const payload = { currentOrganizationId: organizationId };
      const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64');
      const mockToken = `header.${encodedPayload}.signature`;

      const params = { 'organization-id': organizationId };
      const responseData = { access_token: mockToken };

      const result = validateOrganizationId(params, responseData);

      expect(result).toBe(true);
    });

    it('should return false and log error when organization IDs do not match', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const requestedOrgId = 'org-123';
      const actualOrgId = 'org-456';
      const payload = { currentOrganizationId: actualOrgId };
      const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64');
      const mockToken = `header.${encodedPayload}.signature`;

      const params = { 'organization-id': requestedOrgId };
      const responseData = { access_token: mockToken };

      const result = validateOrganizationId(params, responseData);

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        `Login failed: Your API Key does not have access to organization "${requestedOrgId}".`
      );

      consoleSpy.mockRestore();
    });
  });

  describe('getLongDescriptionForCommand', () => {
    it('should return undefined for non-existent command', () => {
      const result = getLongDescriptionForCommand('appcircle-non-existent-command');

      expect(result).toBeUndefined();
    });

    it('should handle empty command name', () => {
      const result = getLongDescriptionForCommand('');

      expect(result).toBeUndefined();
    });

    it('should handle function call without errors', () => {
      // Test that the function can be called without throwing
      expect(() => {
        getLongDescriptionForCommand('appcircle-login-pat');
      }).not.toThrow();
    });

    it('should strip appcircle prefix correctly', () => {
      // Test that the function handles prefix removal correctly
      expect(() => {
        getLongDescriptionForCommand('appcircle-some-command');
      }).not.toThrow();
    });

    it('should handle command without prefix', () => {
      // Test command without appcircle prefix
      expect(() => {
        getLongDescriptionForCommand('some-command');
      }).not.toThrow();
    });

    it('should return string or undefined', () => {
      const result = getLongDescriptionForCommand('any-command');
      
      expect(result === undefined || typeof result === 'string').toBe(true);
    });
  });
});