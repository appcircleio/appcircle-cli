/**
 * @fileoverview E2E tests for critical command flows
 * Tests complete command execution paths from CLI input to output
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import { tmpdir } from 'os';
import * as path from 'path';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
// Generate a simple unique ID for testing
function generateTestId(): string {
  return `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
// Use source TypeScript file instead of built JavaScript
const CLI_PATH = process.cwd() + '/src/main.ts';
const TEST_TIMEOUT = 10000; // 10 seconds for E2E tests
interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}
function runCommand(args: string[], timeout = TEST_TIMEOUT): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['tsx', CLI_PATH, ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env // Pass current environment variables to child process
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });
    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });
    // Close stdin immediately to prevent hanging on interactive prompts
    child.stdin?.end();
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`Command timed out after ${timeout}ms`));
    }, timeout);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        exitCode: code || 0,
        stdout,
        stderr
      });
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}
describe('Critical Command E2E Tests', () => {
  let tempConfigFile: string;
  beforeEach(() => {
    // Create temporary config file for isolated testing
    tempConfigFile = (tmpdir() || '/tmp') + `/appcircle-test-${generateTestId()}.json`;
    process.env.AC_CONFIG_PATH = tempConfigFile;
  });
  afterEach(() => {
    // Clean up temporary config file
    if (existsSync(tempConfigFile)) {
      unlinkSync(tempConfigFile);
    }
    delete process.env.AC_CONFIG_PATH;
  });
  describe('🔐 Authentication Commands', () => {
    it('should handle login command without credentials', async () => {
      const result = await runCommand(['login', 'pat']);
      
      // Should prompt for missing credentials or show error
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('token');
    });
    it('should handle logout command when not authenticated', async () => {
      // Ensure we're testing with a clean config file by deleting it if it exists
      if (existsSync(tempConfigFile)) {
        unlinkSync(tempConfigFile);
      }
      
      // Force environment variable to be set correctly for this test
      process.env.AC_CONFIG_PATH = tempConfigFile;
      
      // Test logout without authentication (should fail gracefully)
      const result = await runCommand(['logout']);
      
      // Should fail with non-zero exit code
      expect(result.exitCode).toBeGreaterThan(0);
      expect(result.stderr).toContain('You are not currently logged in');
    });
    it('should handle invalid command gracefully', async () => {
      const result = await runCommand(['invalid-command-xyz']);
      
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('command');
    });
  });
  describe('⚙️ Configuration Commands', () => {
    it('should list empty configurations initially', async () => {
      const result = await runCommand(['config', 'list']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('default');
    });
    it('should add new configuration environment', async () => {
      const result = await runCommand(['config', 'add', 'test-env']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('test-env');
    });
    it('should set current configuration', async () => {
      // First add an environment
      await runCommand(['config', 'add', 'staging']);
      
      const result = await runCommand(['config', 'current', 'staging']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('staging');
    });
    it('should reset configurations', async () => {
      // Add some configurations first
      await runCommand(['config', 'add', 'test1']);
      await runCommand(['config', 'add', 'test2']);
      
      const result = await runCommand(['config', 'reset']);
      
      expect(result.exitCode).toBe(0);
      
      // Verify configurations are reset
      const listResult = await runCommand(['config', 'list']);
      expect(listResult.stdout).not.toContain('test1');
      expect(listResult.stdout).not.toContain('test2');
    });
  });
  describe('🛡️ Error Handling', () => {
    it('should handle subcommand errors', async () => {
      const result = await runCommand(['config', 'invalid-subcommand']);
      
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('command');
    });
  });
  describe('🌐 Cross-platform Compatibility', () => {
    it('should handle different line endings in output', async () => {
      const result = await runCommand(['--help']);
      
      expect(result.exitCode).toBe(0);
      
      // Should work with both Unix and Windows line endings
      const lines = result.stdout.split(/\r?\n/);
      expect(lines.length).toBeGreaterThan(5);
    });
    it('should handle unicode characters in config names', async () => {
      const unicodeName = 'тест-среда';
      const result = await runCommand(['config', 'add', unicodeName]);
      
      expect(result.exitCode).toBe(0);
      
      const listResult = await runCommand(['config', 'list']);
      expect(listResult.stdout).toContain(unicodeName);
    });
    it('should handle special characters in arguments', async () => {
      const specialName = 'test-env@2024!';
      const result = await runCommand(['config', 'add', specialName]);
      
      expect(result.exitCode).toBe(0);
      
      const listResult = await runCommand(['config', 'list']);
      expect(listResult.stdout).toContain(specialName);
    });
  });
  describe('🕐 Timeout and Performance', () => {
    it('should complete basic commands within reasonable time', async () => {
      const start = Date.now();
      const result = await runCommand(['--version']);
      const duration = Date.now() - start;
      
      expect(result.exitCode).toBe(0);
      expect(duration).toBeLessThan(3000); // Should complete within 3 seconds
    });
    it('should handle concurrent command executions', async () => {
      // Run multiple concurrent config commands to test system stability
      // Note: Due to shared config file access, some commands may succeed while others
      // conflict. This tests that the system handles concurrency gracefully.
      const commands = Array.from({ length: 3 }, (_, i) => 
        runCommand(['config', 'add', `concurrent-test-${Date.now()}-${i}`])
      );
      
      const start = Date.now();
      const results = await Promise.all(commands);
      const duration = Date.now() - start;
      
      // At least 2 out of 3 concurrent operations should succeed
      // (some may fail due to config file access conflicts, which is expected)
      const successfulResults = results.filter(result => result.exitCode === 0);
      expect(successfulResults.length).toBeGreaterThanOrEqual(2);
      
      // No command should timeout or crash catastrophically
      results.forEach((result) => {
        expect(result.exitCode).toBeLessThanOrEqual(1); // 0 = success, 1 = expected failure
        if (result.exitCode !== 0) {
          // Failed commands should have meaningful error messages
          expect(result.stderr.length).toBeGreaterThan(0);
        }
      });
      
      // Should complete within reasonable time even with concurrency
      expect(duration).toBeLessThan(10000);
      
      // Verify at least one successful command added a configuration
      const successfulOutputs = successfulResults.map(r => r.stdout).join('');
      expect(successfulOutputs.length).toBeGreaterThan(0);
    });
  });
});