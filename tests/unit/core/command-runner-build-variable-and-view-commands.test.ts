/**
 * Tests for the tail of handleBuildCommand: variable group upload/download, variable view/download/create,
 * active build list, build view and the unknown-command fallback.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';

const h = vi.hoisted(() => {
  const spinner: any = { text: '' };
  spinner.start = vi.fn(() => spinner);
  spinner.stop = vi.fn(() => spinner);
  spinner.succeed = vi.fn(() => spinner);
  spinner.fail = vi.fn(() => spinner);
  return { spinner, commands: { override: undefined as any } };
});

vi.mock('../../../src/utils/orahelper', () => ({ createOra: vi.fn(() => h.spinner) }));
vi.mock('../../../src/services');
vi.mock('../../../src/core/writer', () => ({ commandWriter: vi.fn(), configWriter: vi.fn() }));
vi.mock('enquirer', () => ({ default: { prompt: vi.fn() } }));
vi.mock('../../../src/core/commands', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    get Commands() {
      return h.commands.override ?? actual.Commands;
    },
  };
});

import { handleBuildCommand } from '../../../src/core/command-runner';
import * as services from '../../../src/services';
import { commandWriter } from '../../../src/core/writer';
import { CommandTypes } from '../../../src/core/commands';
import { AppcircleExitError } from '../../../src/core/AppcircleExitError';

const LONG = 'BUILD LONG DESCRIPTION';
const withDescription = () => {
  h.commands.override = [{ command: 'build', description: 'Build', longDescription: LONG, params: [] }];
};
const withoutDescription = () => {
  h.commands.override = [];
};

const cmd = (fullCommandName: string): any => ({
  fullCommandName,
  parent: null,
  name: () => fullCommandName.split('-').pop(),
  args: () => [],
  opts: () => ({}),
  isGroupCommand: (t: string) => fullCommandName.includes(`appcircle-${t}`),
});

describe('handleBuildCommand - variables, active list, view, fallback', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    Object.values(services).forEach((fn: any) => {
      if (vi.isMockFunction(fn)) fn.mockReset();
    });
    h.spinner.text = '';
    h.commands.override = undefined;
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    if (vi.isMockFunction(Date.now)) vi.mocked(Date.now).mockRestore();
    if (vi.isMockFunction(process.exit)) vi.mocked(process.exit).mockRestore();
  });

  describe('missing variable group parameter', () => {
    const names = [
      'appcircle-build-variable-group-upload',
      'appcircle-build-variable-group-download',
      'appcircle-build-variable-view',
      'appcircle-build-variable-download',
      'appcircle-build-variable-create',
    ];

    it.each(names)('%s prints the long description and exits with code 1', async (name) => {
      withDescription();
      const err = await handleBuildCommand(cmd(name), {}).catch((e) => e);
      expect(err).toBeInstanceOf(AppcircleExitError);
      expect(err.code).toBe(1);
      expect(errorSpy).toHaveBeenCalledWith(`\n${LONG}\n`);
    });

    it.each(names)('%s exits with code 1 without printing when no description exists', async (name) => {
      withoutDescription();
      const err = await handleBuildCommand(cmd(name), {}).catch((e) => e);
      expect(err).toBeInstanceOf(AppcircleExitError);
      expect(err.code).toBe(1);
      expect(errorSpy).not.toHaveBeenCalled();
    });
  });

  describe('build-variable-group-upload', () => {
    const name = 'appcircle-build-variable-group-upload';

    it('fails when the JSON file path is missing', async () => {
      await expect(handleBuildCommand(cmd(name), { variableGroupId: 'vg-1' })).rejects.toThrow(
        'JSON file path is required'
      );
      expect(h.spinner.fail).toHaveBeenCalledWith('JSON file path is required');
      expect(services.uploadEnvironmentVariablesFromFile).not.toHaveBeenCalled();
    });

    it('fails when the file does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      await expect(
        handleBuildCommand(cmd(name), { variableGroupId: 'vg-1', filePath: 'vars.json' })
      ).rejects.toThrow('File not found');
      expect(h.spinner.fail).toHaveBeenCalledWith('File not found');
      expect(h.spinner.fail).toHaveBeenCalledWith('Failed to upload Environment Variables');
    });

    it('fails when the file content is not valid JSON', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('not json');
      await expect(
        handleBuildCommand(cmd(name), { variableGroupId: 'vg-1', filePath: 'vars.json' })
      ).rejects.toThrow('Invalid file');
      expect(h.spinner.fail).toHaveBeenCalledWith('Invalid file');
      expect(services.uploadEnvironmentVariablesFromFile).not.toHaveBeenCalled();
    });

    it('extracts the ID from "Name (id)" and uploads the resolved file', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('[{"key":"A"}]');
      vi.mocked(services.uploadEnvironmentVariablesFromFile).mockResolvedValue({ uploaded: 1 } as any);

      await handleBuildCommand(cmd(name), { variableGroupId: 'My Group (vg-42)', filePath: 'vars.json' });

      expect(services.uploadEnvironmentVariablesFromFile).toHaveBeenCalledWith(
        expect.objectContaining({ variableGroupId: 'vg-42', filePath: '/mock/resolved/vars.json' })
      );
      expect(h.spinner.succeed).toHaveBeenCalledWith('Environment Variables uploaded successfully');
      expect(commandWriter).toHaveBeenCalledWith(CommandTypes.BUILD, {
        fullCommandName: name,
        data: { uploaded: 1 },
      });
    });

    it('keeps an ID that has no "(id)" suffix', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('{}');
      vi.mocked(services.uploadEnvironmentVariablesFromFile).mockResolvedValue({} as any);

      await handleBuildCommand(cmd(name), { variableGroupId: 'vg-plain', filePath: 'vars.json' });

      expect(services.uploadEnvironmentVariablesFromFile).toHaveBeenCalledWith(
        expect.objectContaining({ variableGroupId: 'vg-plain' })
      );
    });
  });

  describe.each(['appcircle-build-variable-group-download', 'appcircle-build-variable-download'])(
    '%s',
    (name) => {
      beforeEach(() => {
        vi.spyOn(Date, 'now').mockReturnValue(1700000000000);
      });

      it('fails when the variable group does not exist', async () => {
        vi.mocked(services.getEnvironmentVariableGroups).mockResolvedValue([{ id: 'other', name: 'X' }] as any);
        await expect(handleBuildCommand(cmd(name), { variableGroupId: 'vg-1' })).rejects.toThrow(
          'Variable Group not found'
        );
        expect(h.spinner.fail).toHaveBeenCalledWith('Variable Group with ID vg-1 not found');
        expect(h.spinner.fail).toHaveBeenCalledWith('Failed to download Environment Variables');
        expect(services.getEnvironmentVariables).not.toHaveBeenCalled();
      });

      it('writes sorted variables into a new directory under the expanded "~" path', async () => {
        vi.mocked(services.getEnvironmentVariableGroups).mockResolvedValue([{ id: 'vg-1', name: 'VG' }] as any);
        vi.mocked(services.getEnvironmentVariables).mockResolvedValue([
          { key: 'A', value: '1', isSecret: false },
          { key: 'C', value: '3', isSecret: true, isFile: true },
          { key: 'B', value: '2', isSecret: false },
        ] as any);
        vi.mocked(fs.existsSync).mockReturnValue(false);
        vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as any);

        await handleBuildCommand(cmd(name), { variableGroupId: 'vg-1', path: '~/out' });

        const dir = '/mock/resolved//mock/home/user/out';
        expect(fs.mkdirSync).toHaveBeenCalledWith(dir, { recursive: true });
        const expectedFile = `${dir}/VG_1700000000000.json`;
        expect(fs.writeFileSync).toHaveBeenCalledWith(
          expectedFile,
          JSON.stringify([
            { key: 'C', value: '3', isSecret: true, isFile: true, id: 'C' },
            { key: 'B', value: '2', isSecret: false, isFile: false, id: 'B' },
            { key: 'A', value: '1', isSecret: false, isFile: false, id: 'A' },
          ])
        );
        expect(h.spinner.succeed).toHaveBeenCalledWith(
          `Environment Variables downloaded successfully to ${expectedFile}`
        );
      });

      it('uses the default Downloads path and writes to it as a file path when it is not a directory', async () => {
        vi.mocked(services.getEnvironmentVariableGroups).mockResolvedValue([{ id: 'vg-1', name: 'VG' }] as any);
        vi.mocked(services.getEnvironmentVariables).mockResolvedValue([] as any);
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => false } as any);

        await handleBuildCommand(cmd(name), { variableGroupId: 'vg-1' });

        const target = '/mock/resolved//mock/home/user/Downloads';
        expect(fs.mkdirSync).not.toHaveBeenCalled();
        expect(fs.writeFileSync).toHaveBeenCalledWith(target, '[]');
        expect(h.spinner.succeed).toHaveBeenCalledWith(`Environment Variables downloaded successfully to ${target}`);
      });
    }
  );

  describe('build-variable-view', () => {
    it('lists the variables of the group', async () => {
      vi.mocked(services.getEnvironmentVariables).mockResolvedValue([{ key: 'K' }] as any);
      const params = { variableGroupId: 'vg-1' };
      await handleBuildCommand(cmd('appcircle-build-variable-view'), params);
      expect(services.getEnvironmentVariables).toHaveBeenCalledWith(params);
      expect(h.spinner.stop).toHaveBeenCalled();
      expect(commandWriter).toHaveBeenCalledWith(CommandTypes.BUILD, {
        fullCommandName: 'appcircle-build-variable-view',
        data: [{ key: 'K' }],
      });
    });
  });

  describe('build-variable-create', () => {
    const name = 'appcircle-build-variable-create';
    let exitSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code: number) => {
        throw new Error(`process.exit(${code})`);
      }) as any);
    });

    it('exits when a file variable has no file path', async () => {
      await expect(handleBuildCommand(cmd(name), { variableGroupId: 'vg-1', type: 'file' })).rejects.toThrow(
        'process.exit(1)'
      );
      expect(h.spinner.fail).toHaveBeenCalledWith('File path is required for file type variables');
      expect(h.spinner.fail).toHaveBeenCalledWith('Failed to create Environment Variable');
      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(services.createEnvironmentVariable).not.toHaveBeenCalled();
    });

    it('exits when the file of a file variable does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      await expect(
        handleBuildCommand(cmd(name), { variableGroupId: 'vg-1', type: 'file', filePath: 'a.txt' })
      ).rejects.toThrow('process.exit(1)');
      expect(h.spinner.fail).toHaveBeenCalledWith('File not exists');
      expect(services.createEnvironmentVariable).not.toHaveBeenCalled();
    });

    it('creates a file variable with the resolved path', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(services.createEnvironmentVariable).mockResolvedValue({ id: 'v1' } as any);

      await handleBuildCommand(cmd(name), { variableGroupId: 'vg-1', type: 'file', filePath: 'a.txt', key: 'F' });

      expect(services.createEnvironmentVariable).toHaveBeenCalledWith(
        expect.objectContaining({ filePath: '/mock/resolved/a.txt', key: 'F' })
      );
      expect(h.spinner.succeed).toHaveBeenCalledWith('Environment Variable created successfully');
      expect(commandWriter).toHaveBeenCalledWith(CommandTypes.BUILD, {
        fullCommandName: name,
        data: { id: 'v1', key: 'F' },
      });
      expect(exitSpy).not.toHaveBeenCalled();
    });

    it('creates a text variable without touching the file system', async () => {
      vi.mocked(services.createEnvironmentVariable).mockResolvedValue({ id: 'v2' } as any);

      await handleBuildCommand(cmd(name), { variableGroupId: 'vg-1', type: 'text', key: 'T', value: 'x' });

      expect(fs.existsSync).not.toHaveBeenCalled();
      expect(commandWriter).toHaveBeenCalledWith(CommandTypes.BUILD, {
        fullCommandName: name,
        data: { id: 'v2', key: 'T' },
      });
    });

    it('reports and rethrows a service failure', async () => {
      vi.mocked(services.createEnvironmentVariable).mockRejectedValue(new Error('boom'));
      await expect(
        handleBuildCommand(cmd(name), { variableGroupId: 'vg-1', type: 'text', key: 'T' })
      ).rejects.toThrow('boom');
      expect(h.spinner.fail).toHaveBeenCalledWith('Failed to create Environment Variable');
    });
  });

  describe('build-active-list', () => {
    it('writes the active builds', async () => {
      vi.mocked(services.getActiveBuilds).mockResolvedValue([{ id: 'q1' }] as any);
      await handleBuildCommand(cmd('appcircle-build-active-list'), {});
      expect(services.getActiveBuilds).toHaveBeenCalledWith();
      expect(commandWriter).toHaveBeenCalledWith(CommandTypes.BUILD, {
        fullCommandName: 'appcircle-build-active-list',
        data: [{ id: 'q1' }],
      });
    });
  });

  describe('build-view', () => {
    const name = 'appcircle-build-view';
    const full = { profileId: 'p1', branchId: 'b1', commitId: 'c1', buildId: 'bld-1' };
    const missing: Array<[string, Record<string, string>]> = [
      ['profile', { branchId: 'b1', commitId: 'c1', buildId: 'bld-1' }],
      ['branch', { profileId: 'p1', commitId: 'c1', buildId: 'bld-1' }],
      ['commit', { profileId: 'p1', branchId: 'b1', buildId: 'bld-1' }],
      ['build', { profileId: 'p1', branchId: 'b1', commitId: 'c1' }],
    ];

    it.each(missing)('without the %s parameter prints the long description and exits', async (_label, params) => {
      withDescription();
      const err = await handleBuildCommand(cmd(name), { ...params }).catch((e) => e);
      expect(err).toBeInstanceOf(AppcircleExitError);
      expect(err.code).toBe(1);
      expect(errorSpy).toHaveBeenCalledWith(`\n${LONG}\n`);
      expect(services.getBuildsOfCommit).not.toHaveBeenCalled();
    });

    it.each(missing)('without the %s parameter exits silently when no description exists', async (_label, params) => {
      withoutDescription();
      const err = await handleBuildCommand(cmd(name), { ...params }).catch((e) => e);
      expect(err).toBeInstanceOf(AppcircleExitError);
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('resolves the commit ID from a commit hash and writes the matching build', async () => {
      vi.mocked(services.getCommits).mockResolvedValue([
        { id: 'c-other', hash: 'zzz' },
        { id: 'c-9', hash: 'abc123' },
      ] as any);
      vi.mocked(services.getBuildsOfCommit).mockResolvedValue({
        builds: [{ id: 'x' }, { id: 'bld-1', status: 0 }],
      } as any);

      await handleBuildCommand(cmd(name), { profileId: 'p1', branchId: 'b1', commitHash: 'abc123', buildId: 'bld-1' });

      expect(services.getCommits).toHaveBeenCalledWith({ branchId: 'b1' });
      expect(services.getBuildsOfCommit).toHaveBeenCalledWith(expect.objectContaining({ commitId: 'c-9' }));
      expect(commandWriter).toHaveBeenCalledWith(CommandTypes.BUILD, {
        fullCommandName: name,
        data: { id: 'bld-1', status: 0 },
      });
      expect(h.spinner.fail).not.toHaveBeenCalled();
    });

    it('reports "No Builds available" when the commit hash is unknown', async () => {
      vi.mocked(services.getCommits).mockResolvedValue(undefined as any);
      await handleBuildCommand(cmd(name), { profileId: 'p1', branchId: 'b1', commitHash: 'nope', buildId: 'bld-1' });
      expect(services.getBuildsOfCommit).not.toHaveBeenCalled();
      expect(h.spinner.fail).toHaveBeenCalledWith('No Builds available');
      expect(commandWriter).not.toHaveBeenCalled();
    });

    it.each([
      ['no response', undefined],
      ['no builds field', {}],
      ['an empty build list', { builds: [] }],
    ])('reports "No Builds available" for %s', async (_label, response) => {
      vi.mocked(services.getBuildsOfCommit).mockResolvedValue(response as any);
      await handleBuildCommand(cmd(name), { ...full });
      expect(services.getCommits).not.toHaveBeenCalled();
      expect(h.spinner.fail).toHaveBeenCalledWith('No Builds available');
      expect(commandWriter).not.toHaveBeenCalled();
    });
  });

  describe('unknown build command', () => {
    it('prints the long description of the closest command', async () => {
      withDescription();
      await handleBuildCommand(cmd('appcircle-build-unknown'), {});
      expect(errorSpy).toHaveBeenCalledWith(`\n${LONG}\n`);
    });

    it('prints "command not found" when nothing matches', async () => {
      withoutDescription();
      await handleBuildCommand(cmd('appcircle-build-unknown-thing'), {});
      expect(errorSpy).toHaveBeenCalledWith('"appcircle build unknown thing ..." command not found.');
    });
  });
});
