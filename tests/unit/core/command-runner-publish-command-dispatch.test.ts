/**
 * Tests for handlePublishCommand routing, the publish parameter validators' help output,
 * and the inline "publish variable-group download" flow.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const svc = vi.hoisted(() => ({
  getPublishProfiles: vi.fn(),
  getAppVersions: vi.fn(),
  getPublishVariableGroups: vi.fn(),
  getPublishVariableListByGroupId: vi.fn(),
  getPublishProfileDetailById: vi.fn(),
  deletePublishProfile: vi.fn(),
  renamePublishProfile: vi.fn(),
  getPublishFlows: vi.fn(),
  downloadPublishFlowYaml: vi.fn(),
  updatePublishFlowFromFile: vi.fn(),
  getPublishUploadInformation: vi.fn(),
  uploadArtifactWithSignedUrl: vi.fn(),
  commitPublishFileUpload: vi.fn(),
  getTaskStatus: vi.fn(),
  getAppVersionDetail: vi.fn(),
  deleteAppVersion: vi.fn(),
  getPublishByAppVersion: vi.fn(),
  startExistingPublishFlow: vi.fn(),
  getAppVersionDownloadLink: vi.fn(),
  downloadAppVersion: vi.fn(),
  setAppVersionReleaseCandidateStatus: vi.fn(),
  switchPublishProfileAutoPublishSettings: vi.fn(),
  uploadPublishEnvironmentVariablesFromFile: vi.fn(),
  setAppVersionReleaseNote: vi.fn(),
  getActivePublishes: vi.fn(),
  getPublisDetailById: vi.fn(),
  createPublishProfile: vi.fn(),
}));

const spinner = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  succeed: vi.fn(),
  fail: vi.fn(),
  text: '',
}));

vi.mock('../../../src/services', () => svc);
vi.mock('../../../src/core/writer', () => ({ commandWriter: vi.fn(), configWriter: vi.fn() }));
vi.mock('enquirer', () => ({ default: { prompt: vi.fn() } }));
vi.mock('../../../src/utils/orahelper', () => ({ createOra: vi.fn(() => spinner) }));
vi.mock('../../../src/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/config')>();
  return { ...actual, getConsoleOutputType: vi.fn(() => 'plain') };
});
// The publish validators look up help by joining the command parts with spaces ("publish start"),
// so register help entries under those keys to exercise the "help found" output.
vi.mock('../../../src/core/commands', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/core/commands')>();
  return {
    ...actual,
    Commands: [
      ...actual.Commands,
      { command: 'publish start', description: 'short', longDescription: 'HELP publish start', params: [] },
      { command: 'publish profile version view', description: 'HELP version view', params: [] },
      { command: 'publish variable group view', description: 'HELP variable group view', params: [] },
    ],
  };
});

import {
  handlePublishCommand,
  validatePublishProfileParams,
  validatePublishAppVersionParams,
  validatePublishVariableGroupParams,
} from '../../../src/core/command-runner';
import { commandWriter } from '../../../src/core/writer';
import enquirer from 'enquirer';
import { ProgramError } from '../../../src/core/ProgramError';
import { CommandTypes } from '../../../src/core/commands';

const mfs = vi.mocked(fs);
const mpath = vi.mocked(path);
const mos = vi.mocked(os);
const prompt = vi.mocked(enquirer.prompt);
const cmd = (name: string) => ({ fullCommandName: `appcircle-${name}` }) as any;

describe('publish validators help output', () => {
  beforeEach(() => vi.clearAllMocks());

  it('profile validator prints help when it exists and throws', async () => {
    await expect(validatePublishProfileParams(cmd('publish-start'), {})).rejects.toThrow(
      new ProgramError('Either --publishProfileId or --publishProfile parameter is required.')
    );
    expect(console.log).toHaveBeenCalledWith('\nHELP publish start');
  });

  it('app version validator prints help when it exists, and only throws when it does not', async () => {
    await expect(validatePublishAppVersionParams(cmd('publish-profile-version-view'), {})).rejects.toThrow(
      'Either --appVersionId or --appVersion parameter is required.'
    );
    expect(console.log).toHaveBeenCalledWith('\nHELP version view');

    vi.mocked(console.log).mockClear();
    await expect(validatePublishAppVersionParams(cmd('publish-profile-version-download'), {})).rejects.toThrow(
      'Either --appVersionId or --appVersion parameter is required.'
    );
    expect(console.log).not.toHaveBeenCalled();
  });

  it('variable group validator prints help when it exists, and only throws when it does not', async () => {
    await expect(validatePublishVariableGroupParams(cmd('publish-variable-group-view'), {})).rejects.toThrow(
      'Either --publishVariableGroupId or --variableGroup parameter is required.'
    );
    expect(console.log).toHaveBeenCalledWith('\nHELP variable group view');

    vi.mocked(console.log).mockClear();
    await expect(validatePublishVariableGroupParams(cmd('publish-variable-group-download'), {})).rejects.toThrow(
      'Either --publishVariableGroupId or --variableGroup parameter is required.'
    );
    expect(console.log).not.toHaveBeenCalled();
  });
});

describe('handlePublishCommand routing', () => {
  const base = { platform: 'ios', publishProfileId: 'p1', appVersionId: 'v1' };

  beforeEach(() => {
    vi.clearAllMocks();
    spinner.start.mockReturnValue(spinner);
    spinner.text = '';
    mos.homedir.mockReturnValue('/home/u');
    mpath.join.mockImplementation((...parts: string[]) => parts.join('/'));
    mpath.resolve.mockImplementation((p: string) => `/abs${p.startsWith('/') ? '' : '/'}${p}`);
    mpath.basename.mockImplementation((p: string) => p.split('/').pop() as string);
    mfs.existsSync.mockReturnValue(true);
    mfs.statSync.mockReturnValue({ isDirectory: () => true, isFile: () => true, size: 10 } as any);
  });

  it('routes profile-create and profile-rename', async () => {
    svc.createPublishProfile.mockResolvedValue({ id: 'new' });
    await handlePublishCommand(cmd('publish-profile-create'), { platform: 'android', name: 'Prof' });
    expect(svc.createPublishProfile).toHaveBeenCalledWith({ platform: 'android', name: 'Prof' });
    expect(commandWriter).toHaveBeenLastCalledWith(CommandTypes.PUBLISH, {
      fullCommandName: 'appcircle-publish-profile-create',
      data: { id: 'new' },
    });

    svc.renamePublishProfile.mockResolvedValue({ renamed: true });
    await handlePublishCommand(cmd('publish-profile-rename'), { ...base, name: 'New' });
    expect(svc.renamePublishProfile).toHaveBeenCalledWith(expect.objectContaining({ publishProfileId: 'p1', name: 'New' }));
    expect(commandWriter).toHaveBeenLastCalledWith(CommandTypes.PUBLISH, {
      fullCommandName: 'appcircle-publish-profile-rename',
      data: { renamed: true },
    });
  });

  it('routes version-upload', async () => {
    svc.getPublishUploadInformation.mockResolvedValue({ fileId: 'fid' });
    svc.commitPublishFileUpload.mockResolvedValue({ taskId: 'up-task' });
    svc.getTaskStatus.mockResolvedValue({ stateValue: 3 });
    await handlePublishCommand(cmd('publish-profile-version-upload'), { ...base, app: 'app.apk' });
    expect(svc.uploadArtifactWithSignedUrl).toHaveBeenCalledWith({ app: '/abs/app.apk', uploadInfo: { fileId: 'fid' } });
    expect(spinner.succeed).toHaveBeenCalled();
    expect(spinner.text).toContain('TaskId: up-task');
  });

  it('routes profile-delete', async () => {
    svc.getPublishProfileDetailById.mockResolvedValue({ name: 'Prof' });
    prompt.mockResolvedValue({ confirm: 'yes' } as any);
    svc.deletePublishProfile.mockResolvedValue({ deleted: true });
    await handlePublishCommand(cmd('publish-profile-delete'), { ...base });
    expect(svc.deletePublishProfile).toHaveBeenCalledWith(expect.objectContaining({ publishProfileId: 'p1' }));
    expect(commandWriter).toHaveBeenCalledWith(CommandTypes.PUBLISH, {
      fullCommandName: 'appcircle-publish-profile-delete',
      data: { deleted: true },
    });
  });

  it('routes publish-flow list, download and update', async () => {
    svc.getPublishFlows.mockResolvedValue([{ id: 'f1', flowName: 'Flow' }]);
    await handlePublishCommand(cmd('publish-profile-publish-flow-list'), { ...base });
    expect(commandWriter).toHaveBeenCalledWith(CommandTypes.PUBLISH, expect.objectContaining({ data: [{ id: 'f1', flowName: 'Flow' }] }));

    svc.downloadPublishFlowYaml.mockResolvedValue('y');
    await handlePublishCommand(cmd('publish-profile-publish-flow-download'), { ...base, publishFlowId: 'f1', path: '/d' });
    expect(svc.downloadPublishFlowYaml).toHaveBeenCalled();
    expect(mfs.writeFileSync).toHaveBeenCalledWith(expect.stringMatching(/^\/abs\/d\/Flow_\d+\.yaml$/), expect.any(Buffer));

    await handlePublishCommand(cmd('publish-profile-publish-flow-update'), { ...base, publishFlowId: 'f1', filePath: 'f.yaml' });
    expect(svc.updatePublishFlowFromFile).toHaveBeenCalledWith(expect.objectContaining({ filePath: '/abs/f.yaml' }));
  });

  it('routes version-delete', async () => {
    svc.getAppVersionDetail.mockResolvedValue({ version: '1' });
    prompt.mockResolvedValue({ confirm: 'yes' } as any);
    svc.deleteAppVersion.mockResolvedValue({ taskId: 't' });
    await handlePublishCommand(cmd('publish-profile-version-delete'), { ...base });
    expect(svc.deleteAppVersion).toHaveBeenCalledWith(expect.objectContaining({ appVersionId: 'v1' }));
  });

  it('routes publish start', async () => {
    svc.getPublishByAppVersion.mockResolvedValue({ steps: [{ publishId: 'pub' }] });
    svc.startExistingPublishFlow.mockResolvedValue('pub');
    // Drop platform so monitoring is skipped; profile/app version are already resolved.
    await handlePublishCommand(cmd('publish-start'), { publishProfileId: 'p1', appVersionId: 'v1' });
    expect(svc.startExistingPublishFlow).toHaveBeenCalledWith(expect.objectContaining({ publishId: 'pub' }));
    expect(spinner.succeed).toHaveBeenCalledWith('Publish flow started successfully.\n\nPublishId: pub');
  });

  it('routes version-download', async () => {
    svc.getAppVersionDownloadLink.mockResolvedValue('https://x.test/f');
    svc.getAppVersions.mockResolvedValue([{ id: 'v1', fileName: 'a.apk' }]);
    await handlePublishCommand(cmd('publish-profile-version-download'), { ...base, path: '/out' });
    expect(svc.downloadAppVersion).toHaveBeenCalledWith({ url: 'https://x.test/f', path: '/abs/out/a.apk' });
  });

  it('routes mark-as-rc and unmark-as-rc', async () => {
    svc.setAppVersionReleaseCandidateStatus.mockResolvedValue('ok');
    await handlePublishCommand(cmd('publish-profile-version-mark-as-rc'), { ...base });
    expect(svc.setAppVersionReleaseCandidateStatus).toHaveBeenLastCalledWith(expect.objectContaining({ releaseCandidate: true }));
    await handlePublishCommand(cmd('publish-profile-version-unmark-as-rc'), { ...base });
    expect(svc.setAppVersionReleaseCandidateStatus).toHaveBeenLastCalledWith(expect.objectContaining({ releaseCandidate: false }));
  });

  it('routes settings-autopublish and keeps a boolean enable value as-is', async () => {
    svc.getPublishProfileDetailById.mockResolvedValue({ profileSettings: { a: 1 } });
    svc.switchPublishProfileAutoPublishSettings.mockResolvedValue('switched');
    await handlePublishCommand(cmd('publish-profile-settings-autopublish'), { ...base, enable: false });
    expect(svc.switchPublishProfileAutoPublishSettings).toHaveBeenCalledWith(
      expect.objectContaining({ enable: false, currentProfileSettings: { a: 1 } })
    );
    expect(commandWriter).toHaveBeenCalledWith(CommandTypes.PUBLISH, expect.objectContaining({ data: 'switched' }));
  });

  it('routes variable-group list, view and upload', async () => {
    svc.getPublishVariableGroups.mockResolvedValue([{ id: 'g1', name: 'G' }]);
    await handlePublishCommand(cmd('publish-variable-group-list'), {});
    expect(commandWriter).toHaveBeenLastCalledWith(CommandTypes.PUBLISH, {
      fullCommandName: 'appcircle-publish-variable-group-list',
      data: [{ id: 'g1', name: 'G' }],
    });

    svc.getPublishVariableListByGroupId.mockResolvedValue({ variables: [{ key: 'K' }] });
    await handlePublishCommand(cmd('publish-variable-group-view'), { publishVariableGroupId: 'g1' });
    expect(commandWriter).toHaveBeenLastCalledWith(CommandTypes.PUBLISH, {
      fullCommandName: 'appcircle-publish-variable-group-view',
      data: [{ key: 'K' }],
    });

    mfs.readFileSync.mockReturnValue('[]');
    await handlePublishCommand(cmd('publish-variable-group-upload'), { publishVariableGroupId: 'g1', filePath: 'vars.json' });
    expect(svc.uploadPublishEnvironmentVariablesFromFile).toHaveBeenCalledWith(expect.objectContaining({ filePath: '/abs/vars.json' }));
    expect(spinner.succeed).toHaveBeenCalledWith('Environment Variables uploaded successfully');
  });

  it('routes version-list, version-view, update-release-note, active-list and view', async () => {
    svc.getAppVersions.mockResolvedValue(['list']);
    await handlePublishCommand(cmd('publish-profile-version-list'), { ...base });
    expect(commandWriter).toHaveBeenLastCalledWith(CommandTypes.PUBLISH, expect.objectContaining({ data: ['list'] }));

    svc.getAppVersionDetail.mockResolvedValue({ id: 'v1' });
    await handlePublishCommand(cmd('publish-profile-version-view'), { ...base });
    expect(commandWriter).toHaveBeenLastCalledWith(CommandTypes.PUBLISH, expect.objectContaining({ data: { id: 'v1' } }));

    await handlePublishCommand(cmd('publish-profile-version-update-release-note'), { ...base, summary: 'notes' });
    expect(svc.setAppVersionReleaseNote).toHaveBeenCalledWith(expect.objectContaining({ summary: 'notes' }));
    expect(spinner.succeed).toHaveBeenCalledWith('Release note updated successfully.');

    svc.getActivePublishes.mockResolvedValue(['active']);
    await handlePublishCommand(cmd('publish-active-list'), {});
    expect(commandWriter).toHaveBeenLastCalledWith(CommandTypes.PUBLISH, expect.objectContaining({ data: ['active'] }));

    svc.getPublisDetailById.mockResolvedValue({ detail: 1 });
    await handlePublishCommand(cmd('publish-view'), { ...base });
    expect(commandWriter).toHaveBeenLastCalledWith(CommandTypes.PUBLISH, expect.objectContaining({ data: { detail: 1 } }));
  });

  it('prints the long description for a known group without a handler', async () => {
    await handlePublishCommand({ fullCommandName: 'appcircle-publish' } as any, {});
    const msg = vi.mocked(console.error).mock.calls[0][0] as string;
    expect(msg.startsWith('\n')).toBe(true);
    expect(msg).not.toContain('command not found');
  });

  describe('variable-group download', () => {
    const dl = cmd('publish-variable-group-download');
    const spies: Array<{ mockRestore: () => void }> = [];

    beforeEach(() => {
      spies.push(vi.spyOn(Date, 'now').mockReturnValue(42));
      svc.getPublishVariableGroups.mockResolvedValue([{ id: 'g1', name: 'Group' }]);
      svc.getPublishVariableListByGroupId.mockResolvedValue({
        variables: [
          { key: 'A', value: '1', isSecret: false },
          { key: 'C', value: '3', isSecret: true, isFile: true },
          { key: 'B', value: '2', isSecret: false },
        ],
      });
    });

    afterEach(() => {
      spies.splice(0).forEach((s) => s.mockRestore());
    });

    it('writes variables sorted by key (descending) into the default Downloads directory', async () => {
      await handlePublishCommand(dl, { publishVariableGroupId: 'g1' });
      const expectedPath = '/abs/home/u/Downloads/Group_42.json';
      expect(mfs.mkdirSync).not.toHaveBeenCalled();
      expect(mfs.writeFileSync).toHaveBeenCalledWith(
        expectedPath,
        JSON.stringify([
          { key: 'C', value: '3', isSecret: true, isFile: true, id: 'C' },
          { key: 'B', value: '2', isSecret: false, isFile: false, id: 'B' },
          { key: 'A', value: '1', isSecret: false, isFile: false, id: 'A' },
        ])
      );
      expect(spinner.succeed).toHaveBeenCalledWith(`Publish Environment Variables downloaded successfully to ${expectedPath}`);
    });

    it('expands ~, creates a missing directory and writes to a non-directory path as-is', async () => {
      mfs.existsSync.mockReturnValue(false);
      mfs.statSync.mockReturnValue({ isDirectory: () => false } as any);
      await handlePublishCommand(dl, { publishVariableGroupId: 'g1', path: '~/vars.json' });
      expect(mfs.mkdirSync).toHaveBeenCalledWith('/abs/home/u/vars.json', { recursive: true });
      expect(mfs.writeFileSync).toHaveBeenCalledWith('/abs/home/u/vars.json', expect.any(String));
    });

    it('uses variableGroupId when the resolved group has no publishVariableGroupId', async () => {
      // Name resolution yields a group without id, so the legacy variableGroupId is used.
      svc.getPublishVariableGroups
        .mockResolvedValueOnce([{ name: 'Group' }])
        .mockResolvedValueOnce([{ id: 'legacy', name: 'Group' }]);
      const params: any = { variableGroup: 'Group', variableGroupId: 'legacy', path: '/x' };
      await handlePublishCommand(dl, params);
      expect(params.publishVariableGroupId).toBe('legacy');
      expect(svc.getPublishVariableListByGroupId).toHaveBeenCalledWith(expect.objectContaining({ publishVariableGroupId: 'legacy' }));
      expect(mfs.writeFileSync).toHaveBeenCalledWith('/abs/x/Group_42.json', expect.any(String));
    });

    it('fails when the group does not exist', async () => {
      await expect(handlePublishCommand(dl, { publishVariableGroupId: 'missing' })).rejects.toThrow('Variable Group not found');
      expect(spinner.fail).toHaveBeenCalledWith('Variable Group with ID missing not found');
      expect(spinner.fail).toHaveBeenLastCalledWith('Failed to download Publish Environment Variables');
      expect(mfs.writeFileSync).not.toHaveBeenCalled();
    });
  });
});
