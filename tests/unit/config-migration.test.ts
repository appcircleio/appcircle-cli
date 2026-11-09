import { describe, it, expect, vi, afterEach } from 'vitest';

// Real conf, real files (test-setup.ts mocks fs/path/os, so the actual modules are used here): a
// config.json where conf <=10 kept it must be read by src/config.ts as is.
const fs = await vi.importActual<typeof import('fs')>('fs');
const path = await vi.importActual<typeof import('path')>('path');
const os = await vi.importActual<typeof import('os')>('os');

// Where conf 10 (env-paths 2, project "@appcircle/cli", suffix "nodejs") stored it.
const legacyConfigFile = (home: string) => {
  const dir = path.join('@appcircle', 'cli-nodejs');
  if (process.platform === 'darwin') {
    return path.join(home, 'Library', 'Preferences', dir, 'config.json');
  } else if (process.platform === 'win32') {
    return path.join(home, 'AppData', 'Roaming', dir, 'Config', 'config.json');
  } else {
    return path.join(home, '.config', dir, 'config.json');
  }
};

describe('config written by conf 10', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is read from the same file', async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ac-cli-config-'));
    vi.stubEnv('HOME', home);
    vi.stubEnv('USERPROFILE', home);
    vi.stubEnv('XDG_CONFIG_HOME', '');
    vi.stubEnv('APPDATA', '');
    const file = legacyConfigFile(home);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const legacy = JSON.stringify({
      current: 'migtest',
      envs: {
        default: { API_HOSTNAME: 'https://api.appcircle.io' },
        migtest: { API_HOSTNAME: 'https://old.example.test', AC_ACCESS_TOKEN: '' },
      },
    });
    fs.writeFileSync(file, legacy);
    try {
      vi.resetModules();
      vi.doUnmock('conf');
      const config = await import('../../src/config');

      expect(fs.realpathSync(config.getConfigFilePath())).toBe(fs.realpathSync(file));
      expect(config.getCurrentConfigVariable()).toBe('migtest');
      expect(config.readEnviromentConfigVariable(config.EnvironmentVariables.API_HOSTNAME)).toBe(
        'https://old.example.test',
      );
      expect(fs.readFileSync(file, 'utf8')).toBe(legacy);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });
});
