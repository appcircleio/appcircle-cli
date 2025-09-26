import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import { platform } from 'os';
import { trustAppcircleCertificate } from '../../../src/security/trust-url-certificate';
import { readEnviromentConfigVariable } from '../../../src/config';

vi.mock('child_process');
vi.mock('os');
vi.mock('../../../src/config');

describe('trustAppcircleCertificate', () => {
  const mockSpawn = vi.mocked(spawn);
  const mockPlatform = vi.mocked(platform);
  const mockReadEnviromentConfigVariable = vi.mocked(readEnviromentConfigVariable);
  
  let mockChildProcess: any;
  let consoleErrorSpy: any;
  let consoleLogSpy: any;
  let processExitSpy: any;

  beforeEach(() => {
    mockChildProcess = {
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      stdin: { write: vi.fn(), end: vi.fn() },
      on: vi.fn()
    };
    
    mockSpawn.mockReturnValue(mockChildProcess);
    mockReadEnviromentConfigVariable.mockReturnValue('https://api.appcircle.io');
    
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  it('should work on macOS platform', async () => {
    mockPlatform.mockReturnValue('darwin');

    await trustAppcircleCertificate();

    expect(mockSpawn).toHaveBeenCalledWith('bash', [
      expect.stringContaining('install_cert.sh'),
      'https://api.appcircle.io'
    ]);
    expect(mockChildProcess.stdin.write).toHaveBeenCalledWith('\n');
    expect(mockChildProcess.stdin.end).toHaveBeenCalled();
  });

  it('should work on Linux platform', async () => {
    mockPlatform.mockReturnValue('linux');

    await trustAppcircleCertificate();

    expect(mockSpawn).toHaveBeenCalledWith('bash', [
      expect.stringContaining('install_cert.sh'),
      'https://api.appcircle.io'
    ]);
    expect(mockChildProcess.stdin.write).toHaveBeenCalledWith('\n');
    expect(mockChildProcess.stdin.end).toHaveBeenCalled();
  });

  it('should exit with error on Windows platform', async () => {
    mockPlatform.mockReturnValue('win32');

    await trustAppcircleCertificate();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error: This command is supported on macOS and Linux only.'
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should exit with error on unsupported platform', async () => {
    mockPlatform.mockReturnValue('freebsd');

    await trustAppcircleCertificate();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error: This command is supported on macOS and Linux only.'
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should handle stdout data', async () => {
    mockPlatform.mockReturnValue('darwin');

    await trustAppcircleCertificate();

    const stdoutCallback = mockChildProcess.stdout.on.mock.calls.find(call => call[0] === 'data')[1];
    stdoutCallback('Test output');

    expect(consoleLogSpy).toHaveBeenCalledWith('Test output');
  });

  it('should handle stderr data', async () => {
    mockPlatform.mockReturnValue('darwin');

    await trustAppcircleCertificate();

    const stderrCallback = mockChildProcess.stderr.on.mock.calls.find(call => call[0] === 'data')[1];
    stderrCallback('Test error');

    expect(consoleErrorSpy).toHaveBeenCalledWith('Test error');
  });

  it('should handle process exit with signal', async () => {
    mockPlatform.mockReturnValue('darwin');

    await trustAppcircleCertificate();

    const exitCallback = mockChildProcess.on.mock.calls.find(call => call[0] === 'exit')[1];
    exitCallback(0, 'SIGTERM');

    expect(consoleLogSpy).toHaveBeenCalledWith('Bash script process killed with signal SIGTERM');
  });

  it('should handle process exit without signal', async () => {
    mockPlatform.mockReturnValue('darwin');

    await trustAppcircleCertificate();

    const exitCallback = mockChildProcess.on.mock.calls.find(call => call[0] === 'exit')[1];
    exitCallback(0, null);

    expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('killed with signal'));
  });

  it('should use correct API hostname from config', async () => {
    mockPlatform.mockReturnValue('darwin');
    mockReadEnviromentConfigVariable.mockReturnValue('https://custom.appcircle.io');

    await trustAppcircleCertificate();

    expect(mockSpawn).toHaveBeenCalledWith('bash', [
      expect.stringContaining('install_cert.sh'),
      'https://custom.appcircle.io'
    ]);
  });
});