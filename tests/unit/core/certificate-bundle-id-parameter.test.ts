import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleCertificateBundleIdParameter } from '../../../src/core/interactive-runner.ts';

const mockOraSpinner = {
  start: vi.fn().mockReturnThis(),
  stop: vi.fn().mockReturnThis(),
  fail: vi.fn().mockReturnThis(),
  text: ''
};

const mockCreatePrompt = vi.fn();

describe('handleCertificateBundleIdParameter', () => {
  const mockParam = { name: 'certificateBundleId', type: 'SELECT' };
  const mockParams = {};

  beforeEach(() => {
    vi.clearAllMocks();
    mockOraSpinner.text = '';
  });

  describe('Basic Functionality', () => {
    it('should successfully handle certificate bundle selection', async () => {
      const mockCertificates = [
        { id: 'cert-123', name: 'iOS Distribution', teamId: 'TEAM123', appleTeamId: 'APPLE456' },
        { id: 'cert-456', name: 'iOS Development', teamId: 'TEAM789' }
      ];
      const mockGetiOSP12Certificates = vi.fn().mockResolvedValue(mockCertificates);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('iOS Distribution: TEAM123 (APPLE456) (cert-123)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleCertificateBundleIdParameter(
        mockParam,
        mockParams,
        mockGetiOSP12Certificates,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result.value).toBe('cert-123');
      expect(mockOraSpinner.start).toHaveBeenCalledTimes(1);
      expect(mockOraSpinner.stop).toHaveBeenCalledTimes(1);
    });

    it('should format certificate params correctly', async () => {
      const mockCertificates = [
        { id: 'cert-123', name: 'iOS Distribution', teamId: 'TEAM123', appleTeamId: 'APPLE456' },
        { id: 'cert-456', name: 'iOS Development' }
      ];
      const mockGetiOSP12Certificates = vi.fn().mockResolvedValue(mockCertificates);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('iOS Distribution: TEAM123 (APPLE456) (cert-123)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleCertificateBundleIdParameter(
        mockParam,
        mockParams,
        mockGetiOSP12Certificates,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(mockParam.params).toEqual([
        { name: 'iOS Distribution: TEAM123 (APPLE456) (cert-123)', message: 'iOS Distribution: TEAM123 (APPLE456) (cert-123)' },
        { name: 'iOS Development (cert-456)', message: 'iOS Development (cert-456)' }
      ]);
    });

    it('should create prompt with correct parameters', async () => {
      const mockCertificates = [{ id: 'cert-123', name: 'Test Cert' }];
      const mockGetiOSP12Certificates = vi.fn().mockResolvedValue(mockCertificates);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Test Cert (cert-123)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleCertificateBundleIdParameter(
        mockParam,
        mockParams,
        mockGetiOSP12Certificates,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(mockCreatePrompt).toHaveBeenCalledWith(
        'certificateBundleId',
        'Certificate Bundle (1 options)',
        ['Test Cert (cert-123)'],
        10
      );
    });

    it('should use custom description when provided', async () => {
      const customParam = { name: 'certificateBundleId', type: 'SELECT', description: 'Distribution Certificate' };
      const mockCertificates = [{ id: 'cert-123', name: 'Test Cert' }];
      const mockGetiOSP12Certificates = vi.fn().mockResolvedValue(mockCertificates);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Test Cert (cert-123)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleCertificateBundleIdParameter(
        customParam,
        mockParams,
        mockGetiOSP12Certificates,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(mockCreatePrompt).toHaveBeenCalledWith(
        'certificateBundleId',
        'Distribution Certificate (1 options)',
        ['Test Cert (cert-123)'],
        10
      );
    });
  });

  describe('UUID Extraction', () => {
    it('should extract UUID from last parentheses', async () => {
      const mockCertificates = [{ id: 'cert-123', name: 'Test Cert' }];
      const mockGetiOSP12Certificates = vi.fn().mockResolvedValue(mockCertificates);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('iOS Distribution: TEAM123 (APPLE456) (cert-123-uuid)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleCertificateBundleIdParameter(
        mockParam,
        mockParams,
        mockGetiOSP12Certificates,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result.value).toBe('cert-123-uuid');
    });

    it('should trim extracted UUID', async () => {
      const mockCertificates = [{ id: 'cert-123', name: 'Test Cert' }];
      const mockGetiOSP12Certificates = vi.fn().mockResolvedValue(mockCertificates);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Test Cert ( cert-with-spaces )')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleCertificateBundleIdParameter(
        mockParam,
        mockParams,
        mockGetiOSP12Certificates,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result.value).toBe('cert-with-spaces');
    });

    it('should handle multiple parentheses and extract from last one', async () => {
      const mockCertificates = [{ id: 'cert-123', name: 'Test Cert' }];
      const mockGetiOSP12Certificates = vi.fn().mockResolvedValue(mockCertificates);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Certificate (Name) (TEAM123) (cert-final-uuid)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleCertificateBundleIdParameter(
        mockParam,
        mockParams,
        mockGetiOSP12Certificates,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result.value).toBe('cert-final-uuid');
    });
  });

  describe('Fallback Logic', () => {
    it('should use fallback to find certificate by ID when regex fails', async () => {
      const mockCertificates = [
        { id: 'cert-123', name: 'Test Cert 1' },
        { id: 'cert-456', name: 'Test Cert 2' }
      ];
      const mockGetiOSP12Certificates = vi.fn().mockResolvedValue(mockCertificates);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('cert-456 - no parentheses')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleCertificateBundleIdParameter(
        mockParam,
        mockParams,
        mockGetiOSP12Certificates,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result.value).toBe('cert-456');
    });

    it('should return selection as-is when no certificate found in fallback', async () => {
      const mockCertificates = [{ id: 'cert-123', name: 'Test Cert' }];
      const mockGetiOSP12Certificates = vi.fn().mockResolvedValue(mockCertificates);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('unknown-selection')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleCertificateBundleIdParameter(
        mockParam,
        mockParams,
        mockGetiOSP12Certificates,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result.value).toBe('unknown-selection');
    });
  });

  describe('Error Handling', () => {
    it('should return error when no certificates available', async () => {
      const mockGetiOSP12Certificates = vi.fn().mockResolvedValue([]);

      const result = await handleCertificateBundleIdParameter(
        mockParam,
        mockParams,
        mockGetiOSP12Certificates,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ isError: true });
      expect(mockOraSpinner.text).toBe('No certificate bundle available');
      expect(mockOraSpinner.fail).toHaveBeenCalledTimes(1);
    });

    it('should return error when certificates list is null', async () => {
      const mockGetiOSP12Certificates = vi.fn().mockResolvedValue(null);

      const result = await handleCertificateBundleIdParameter(
        mockParam,
        mockParams,
        mockGetiOSP12Certificates,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ isError: true });
      expect(mockOraSpinner.text).toBe('No certificate bundle available');
      expect(mockOraSpinner.fail).toHaveBeenCalledTimes(1);
    });

    it('should handle getiOSP12Certificates throwing an exception', async () => {
      const mockGetiOSP12Certificates = vi.fn().mockRejectedValue(new Error('API Error'));

      const result = await handleCertificateBundleIdParameter(
        mockParam,
        mockParams,
        mockGetiOSP12Certificates,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ isError: true });
      expect(mockOraSpinner.text).toBe('Fetching certificate bundles failed');
      expect(mockOraSpinner.fail).toHaveBeenCalledTimes(1);
    });
  });

  describe('Certificate Data Handling', () => {
    it('should handle certificates with missing name gracefully', async () => {
      const mockCertificates = [
        { id: 'cert-123', teamId: 'TEAM123' },
        { id: 'cert-456', name: 'Valid Cert' }
      ];
      const mockGetiOSP12Certificates = vi.fn().mockResolvedValue(mockCertificates);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Unknown: TEAM123 (cert-123)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleCertificateBundleIdParameter(
        mockParam,
        mockParams,
        mockGetiOSP12Certificates,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(mockParam.params[0].name).toBe('Unknown: TEAM123 (cert-123)');
      expect(mockParam.params[1].name).toBe('Valid Cert (cert-456)');
    });

    it('should handle certificates with missing teamId gracefully', async () => {
      const mockCertificates = [
        { id: 'cert-123', name: 'Test Cert', appleTeamId: 'APPLE456' },
        { id: 'cert-456', name: 'Another Cert' }
      ];
      const mockGetiOSP12Certificates = vi.fn().mockResolvedValue(mockCertificates);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Test Cert (APPLE456) (cert-123)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleCertificateBundleIdParameter(
        mockParam,
        mockParams,
        mockGetiOSP12Certificates,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(mockParam.params[0].name).toBe('Test Cert (APPLE456) (cert-123)');
      expect(mockParam.params[1].name).toBe('Another Cert (cert-456)');
    });

    it('should handle certificates with missing ID gracefully', async () => {
      const mockCertificates = [
        { name: 'Test Cert', teamId: 'TEAM123' }
      ];
      const mockGetiOSP12Certificates = vi.fn().mockResolvedValue(mockCertificates);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Test Cert: TEAM123 (undefined)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleCertificateBundleIdParameter(
        mockParam,
        mockParams,
        mockGetiOSP12Certificates,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(mockParam.params[0].name).toBe('Test Cert: TEAM123 (undefined)');
    });

    it('should handle certificates with all properties', async () => {
      const mockCertificates = [
        { 
          id: 'cert-123', 
          name: 'iOS Distribution Certificate', 
          teamId: 'TEAMABC123', 
          appleTeamId: 'APPLE789XYZ' 
        }
      ];
      const mockGetiOSP12Certificates = vi.fn().mockResolvedValue(mockCertificates);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('iOS Distribution Certificate: TEAMABC123 (APPLE789XYZ) (cert-123)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleCertificateBundleIdParameter(
        mockParam,
        mockParams,
        mockGetiOSP12Certificates,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(mockParam.params[0].name).toBe('iOS Distribution Certificate: TEAMABC123 (APPLE789XYZ) (cert-123)');
    });
  });

  describe('Edge Cases and Integration', () => {
    it('should handle large numbers of certificates', async () => {
      const mockCertificates = Array.from({ length: 50 }, (_, i) => ({
        id: `cert-${i}`,
        name: `Certificate ${i}`,
        teamId: `TEAM${i}`
      }));
      const mockGetiOSP12Certificates = vi.fn().mockResolvedValue(mockCertificates);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Certificate 25: TEAM25 (cert-25)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleCertificateBundleIdParameter(
        mockParam,
        mockParams,
        mockGetiOSP12Certificates,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result.value).toBe('cert-25');
      expect(mockParam.params).toHaveLength(50);
      expect(mockCreatePrompt).toHaveBeenCalledWith(
        'certificateBundleId',
        'Certificate Bundle (50 options)',
        expect.arrayContaining(['Certificate 25: TEAM25 (cert-25)']),
        10
      );
    });

    it('should handle complex certificate names with special characters', async () => {
      const mockCertificates = [
        { 
          id: 'cert-123', 
          name: 'iOS Distribution: Company Inc. (Dev)', 
          teamId: 'TEAM-123_ABC',
          appleTeamId: 'APPLE.456.XYZ'
        }
      ];
      const mockGetiOSP12Certificates = vi.fn().mockResolvedValue(mockCertificates);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('iOS Distribution: Company Inc. (Dev): TEAM-123_ABC (APPLE.456.XYZ) (cert-123)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleCertificateBundleIdParameter(
        mockParam,
        mockParams,
        mockGetiOSP12Certificates,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result.value).toBe('cert-123');
      expect(mockParam.params[0].name).toBe('iOS Distribution: Company Inc. (Dev): TEAM-123_ABC (APPLE.456.XYZ) (cert-123)');
    });
  });

  describe('Dependency Injection', () => {
    it('should use custom createPrompt when provided', async () => {
      const customCreatePrompt = vi.fn();
      const mockCertificates = [{ id: 'cert-123', name: 'Test Cert' }];
      const mockGetiOSP12Certificates = vi.fn().mockResolvedValue(mockCertificates);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Test Cert (cert-123)')
      };
      customCreatePrompt.mockReturnValue(mockPrompt);

      await handleCertificateBundleIdParameter(
        mockParam,
        mockParams,
        mockGetiOSP12Certificates,
        customCreatePrompt,
        () => mockOraSpinner
      );

      expect(customCreatePrompt).toHaveBeenCalledTimes(1);
      expect(mockCreatePrompt).not.toHaveBeenCalled();
    });

    it('should use custom spinner when provided', async () => {
      const customSpinner = {
        start: vi.fn().mockReturnThis(),
        stop: vi.fn().mockReturnThis(),
        fail: vi.fn().mockReturnThis(),
        text: ''
      };
      const mockCertificates = [{ id: 'cert-123', name: 'Test Cert' }];
      const mockGetiOSP12Certificates = vi.fn().mockResolvedValue(mockCertificates);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Test Cert (cert-123)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      await handleCertificateBundleIdParameter(
        mockParam,
        mockParams,
        mockGetiOSP12Certificates,
        mockCreatePrompt,
        () => customSpinner
      );

      expect(customSpinner.start).toHaveBeenCalledTimes(1);
      expect(customSpinner.stop).toHaveBeenCalledTimes(1);
      expect(mockOraSpinner.start).not.toHaveBeenCalled();
      expect(mockOraSpinner.stop).not.toHaveBeenCalled();
    });
  });

  describe('Async Error Handling', () => {
    it('should handle getiOSP12Certificates timeout', async () => {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), 100);
      });
      const mockGetiOSP12Certificates = vi.fn().mockReturnValue(timeoutPromise);

      const result = await handleCertificateBundleIdParameter(
        mockParam,
        mockParams,
        mockGetiOSP12Certificates,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result).toEqual({ isError: true });
      expect(mockOraSpinner.text).toBe('Fetching certificate bundles failed');
      expect(mockOraSpinner.fail).toHaveBeenCalledTimes(1);
    });

    it('should handle unexpected data format from API', async () => {
      const malformedData = [
        'string-certificate', // Not an object
        { id: 'valid-cert', name: 'Valid Certificate' },
        null, // Null certificate
        { name: 'No ID Certificate' }
      ];
      const mockGetiOSP12Certificates = vi.fn().mockResolvedValue(malformedData);

      const mockPrompt = {
        run: vi.fn().mockResolvedValue('Valid Certificate (valid-cert)')
      };
      mockCreatePrompt.mockReturnValue(mockPrompt);

      const result = await handleCertificateBundleIdParameter(
        mockParam,
        mockParams,
        mockGetiOSP12Certificates,
        mockCreatePrompt,
        () => mockOraSpinner
      );

      expect(result.value).toBe('valid-cert');
      expect(mockParam.params).toHaveLength(4);
      expect(mockOraSpinner.stop).toHaveBeenCalledTimes(1);
    });
  });
});