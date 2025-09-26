import { describe, it, expect } from 'vitest';
import { GB, getMaxUploadBytes } from '../../../src/utils/size-limit';

describe('size-limit', () => {
  describe('GB constant', () => {
    it('should equal 1073741824 bytes (1 GB)', () => {
      expect(GB).toBe(1073741824);
      expect(GB).toBe(1024 ** 3);
    });
  });

  describe('getMaxUploadBytes', () => {
    it('should return 3 GB in bytes', () => {
      const expected = 3 * 1024 ** 3; // 3 GB
      const result = getMaxUploadBytes();
      
      expect(result).toBe(expected);
      expect(result).toBe(3221225472); // 3 * 1073741824
    });

    it('should return consistent value on multiple calls', () => {
      const firstCall = getMaxUploadBytes();
      const secondCall = getMaxUploadBytes();
      
      expect(firstCall).toBe(secondCall);
    });

    it('should return value equal to 3 times GB constant', () => {
      const result = getMaxUploadBytes();
      
      expect(result).toBe(3 * GB);
    });
  });
});