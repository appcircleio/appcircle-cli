import { describe, it, expect } from 'vitest';

describe('parse-coverage.js helper functions', () => {
  // We'll import and test only the exported helper functions
  // parseCoverageReport requires file system access, so we skip it
  const { getBadgeColor, getStatusEmoji, generateBadges, generatePRComment } = require('../../../scripts/parse-coverage.js');

  const mockCoverage = {
    statements: {
      pct: 75.85,
      covered: 10237,
      total: 13495
    },
    branches: {
      pct: 89.12,
      covered: 2376,
      total: 2666
    },
    functions: {
      pct: 89.81,
      covered: 520,
      total: 579
    },
    lines: {
      pct: 75.85,
      covered: 10237,
      total: 13495
    }
  };

  describe('getBadgeColor', () => {
    it('should return brightgreen for coverage >= 80%', () => {
      expect(getBadgeColor(80)).toBe('brightgreen');
      expect(getBadgeColor(90)).toBe('brightgreen');
      expect(getBadgeColor(100)).toBe('brightgreen');
    });

    it('should return yellow for coverage between 60-79%', () => {
      expect(getBadgeColor(60)).toBe('yellow');
      expect(getBadgeColor(70)).toBe('yellow');
      expect(getBadgeColor(79.99)).toBe('yellow');
    });

    it('should return red for coverage < 60%', () => {
      expect(getBadgeColor(0)).toBe('red');
      expect(getBadgeColor(30)).toBe('red');
      expect(getBadgeColor(59.99)).toBe('red');
    });

    it('should handle edge case of exactly 80%', () => {
      expect(getBadgeColor(80)).toBe('brightgreen');
    });

    it('should handle edge case of exactly 60%', () => {
      expect(getBadgeColor(60)).toBe('yellow');
    });
  });

  describe('getStatusEmoji', () => {
    it('should return 🟢 for coverage >= 80%', () => {
      expect(getStatusEmoji(80)).toBe('🟢');
      expect(getStatusEmoji(90)).toBe('🟢');
      expect(getStatusEmoji(100)).toBe('🟢');
    });

    it('should return 🟡 for coverage between 60-79%', () => {
      expect(getStatusEmoji(60)).toBe('🟡');
      expect(getStatusEmoji(70)).toBe('🟡');
      expect(getStatusEmoji(79.99)).toBe('🟡');
    });

    it('should return 🔴 for coverage < 60%', () => {
      expect(getStatusEmoji(0)).toBe('🔴');
      expect(getStatusEmoji(30)).toBe('🔴');
      expect(getStatusEmoji(59.99)).toBe('🔴');
    });

    it('should handle edge case of exactly 80%', () => {
      expect(getStatusEmoji(80)).toBe('🟢');
    });

    it('should handle edge case of exactly 60%', () => {
      expect(getStatusEmoji(60)).toBe('🟡');
    });
  });

  describe('generateBadges', () => {
    it('should generate three badge lines', () => {
      const badges = generateBadges(mockCoverage);
      const lines = badges.split('\n');

      expect(lines).toHaveLength(3);
      expect(lines[0]).toMatch(/^!\[Coverage\]/);
      expect(lines[1]).toMatch(/^!\[Branches\]/);
      expect(lines[2]).toMatch(/^!\[Functions\]/);
    });

    it('should include correct percentages and colors', () => {
      const badges = generateBadges(mockCoverage);

      expect(badges).toContain('coverage-75.85%25-yellow');
      expect(badges).toContain('branches-89.12%25-brightgreen');
      expect(badges).toContain('functions-89.81%25-brightgreen');
    });

    it('should use correct URL encoding for percentages', () => {
      const badges = generateBadges(mockCoverage);

      // % should be encoded as %25
      expect(badges).toMatch(/%25/);
      expect(badges).not.toContain('coverage-75.85%-yellow');
    });

    it('should handle 100% coverage', () => {
      const perfectCoverage = {
        ...mockCoverage,
        statements: { pct: 100, covered: 13495, total: 13495 }
      };
      const badges = generateBadges(perfectCoverage);

      expect(badges).toMatch(/coverage-100%25-brightgreen/);
    });

    it('should handle low coverage with red color', () => {
      const lowCoverage = {
        ...mockCoverage,
        statements: { pct: 45.5, covered: 5000, total: 11000 }
      };
      const badges = generateBadges(lowCoverage);

      expect(badges).toMatch(/coverage-45\.5%25-red/);
    });
  });

  describe('generatePRComment', () => {
    it('should include header', () => {
      const comment = generatePRComment(mockCoverage);

      expect(comment).toContain('## 📊 Coverage Report');
    });

    it('should include table with all metrics', () => {
      const comment = generatePRComment(mockCoverage);

      expect(comment).toContain('| Metric | Coverage | Status |');
      expect(comment).toContain('| Statements | 75.85% (10237/13495) | 🟡 |');
      expect(comment).toContain('| Branches | 89.12% (2376/2666) | 🟢 |');
      expect(comment).toContain('| Functions | 89.81% (520/579) | 🟢 |');
      expect(comment).toContain('| Lines | 75.85% (10237/13495) | 🟡 |');
    });

    it('should include thresholds legend', () => {
      const comment = generatePRComment(mockCoverage);

      expect(comment).toContain('### Coverage Thresholds');
      expect(comment).toContain('🟢 Excellent (≥80%)');
      expect(comment).toContain('🟡 Good (60-79%)');
      expect(comment).toContain('🔴 Needs Improvement (<60%)');
    });

    it('should include footer', () => {
      const comment = generatePRComment(mockCoverage);

      expect(comment).toContain('*Generated by Appcircle CLI Coverage Reporter*');
    });

    it('should use correct emoji status for each metric', () => {
      const comment = generatePRComment(mockCoverage);

      // Statements: 75.85% -> 🟡
      expect(comment).toMatch(/Statements.*75\.85%.*🟡/);

      // Branches: 89.12% -> 🟢
      expect(comment).toMatch(/Branches.*89\.12%.*🟢/);

      // Functions: 89.81% -> 🟢
      expect(comment).toMatch(/Functions.*89\.81%.*🟢/);
    });

    it('should handle low coverage with red status', () => {
      const lowCoverage = {
        statements: { pct: 45.5, covered: 5000, total: 11000 },
        branches: { pct: 50, covered: 1000, total: 2000 },
        functions: { pct: 55, covered: 300, total: 545 },
        lines: { pct: 45.5, covered: 5000, total: 11000 }
      };
      const comment = generatePRComment(lowCoverage);

      expect(comment).toMatch(/Statements.*45\.5%.*🔴/);
      expect(comment).toMatch(/Branches.*50%.*🔴/);
      expect(comment).toMatch(/Functions.*55%.*🔴/);
    });

    it('should handle perfect coverage', () => {
      const perfectCoverage = {
        statements: { pct: 100, covered: 10000, total: 10000 },
        branches: { pct: 100, covered: 2000, total: 2000 },
        functions: { pct: 100, covered: 500, total: 500 },
        lines: { pct: 100, covered: 10000, total: 10000 }
      };
      const comment = generatePRComment(perfectCoverage);

      expect(comment).toMatch(/Statements.*100%.*🟢/);
      expect(comment).toMatch(/Branches.*100%.*🟢/);
      expect(comment).toMatch(/Functions.*100%.*🟢/);
      expect(comment).toMatch(/Lines.*100%.*🟢/);
    });
  });
});
