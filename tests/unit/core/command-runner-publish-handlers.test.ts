/**
 * Tests for publish handlers in command-runner: publish flow list/download/update, profile delete failure,
 * upload validation and error mapping, version upload/delete/download, variable group upload and publish start.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const svc = vi.hoisted(() => ({
  getPublishFlows: vi.fn(),
  downloadPublishFlowYaml: vi.fn(),
  updatePublishFlowFromFile: vi.fn(),
  getPublishProfileDetailById: vi.fn(),
  deletePublishProfile: vi.fn(),
  getAppVersions: vi.fn(),
  getAppVersionDetail: vi.fn(),
  setAppVersionReleaseCandidateStatus: vi.fn(),
  setAppVersionReleaseNote: vi.fn(),
  getPublishUploadInformation: vi.fn(),
  uploadArtifactWithSignedUrl: vi.fn(),
  commitPublishFileUpload: vi.fn(),
  getTaskStatus: vi.fn(),
  deleteAppVersion: vi.fn(),
  getAppVersionDownloadLink: vi.fn(),
  downloadAppVersion: vi.fn(),
  uploadPublishEnvironmentVariablesFromFile: vi.fn(),
  getPublishByAppVersion: vi.fn(),
  startExistingPublishFlow: vi.fn(),
}));

const spinner = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  succeed: vi.fn(),
  fail: vi.fn(),
  text: '',
}));

const cfg = vi.hoisted(() => ({ getConsoleOutputType: vi.fn() }));

vi.mock('../../../src/services', () => svc);
vi.mock('../../../src/core/writer', () => ({ commandWriter: vi.fn(), configWriter: vi.fn() }));
vi.mock('enquirer', () => ({ default: { prompt: vi.fn() } }));
vi.mock('../../../src/utils/orahelper', () => ({ createOra: vi.fn(() => spinner) }));
vi.mock('../../../src/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/config')>();
  return { ...actual, getConsoleOutputType: cfg.getConsoleOutputType };
});

import {
  handlePublishFlowList,
  handlePublishFlowDownload,
  handlePublishFlowUpdate,
  handlePublishProfileDelete,
  validateFileForUpload,
  handleReleaseCandidateMarking,
  handlePublishUploadError,
  handlePublishVersionUpload,
  getAppVersionDetailsForDeletion,
  handlePublishVersionDelete,
  setupDownloadDirectoryForAppVersion,
  handlePublishVersionDownload,
  handlePublishVariableGroupUpload,
  handlePublishStart,
} from '../../../src/core/command-runner';
import { commandWriter } from '../../../src/core/writer';
import { createOra } from '../../../src/utils/orahelper';
import { appcircleApi } from '../../../src/services/api';
import enquirer from 'enquirer';
import { AppcircleExitError } from '../../../src/core/AppcircleExitError';
import { ProgramError } from '../../../src/core/ProgramError';
import { CommandTypes } from '../../../src/core/commands';

const mfs = vi.mocked(fs);
const mpath = vi.mocked(path);
const mos = vi.mocked(os);
const prompt = vi.mocked(enquirer.prompt);
const cmd = (fullCommandName: string) => ({ fullCommandName }) as any;

describe('publish handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    spinner.start.mockReturnValue(spinner);
    spinner.text = '';
    cfg.getConsoleOutputType.mockReturnValue('plain');
    mos.homedir.mockReturnValue('/home/u');
    mpath.join.mockImplementation((...parts: string[]) => parts.join('/'));
    mpath.resolve.mockImplementation((p: string) => `/abs${p.startsWith('/') ? '' : '/'}${p}`);
    mpath.basename.mockImplementation((p: string) => p.split('/').pop() as string);
    mfs.existsSync.mockReturnValue(true);
    mfs.statSync.mockReturnValue({ isDirectory: () => true, isFile: () => true, size: 10 } as any);
  });

  const spies: Array<{ mockRestore: () => void }> = [];
  afterEach(() => {
    spies.splice(0).forEach((s) => s.mockRestore());
    vi.useRealTimers();
  });

  describe('handlePublishFlowList', () => {
    it('lists flows of a profile and writes them', async () => {
      svc.getPublishFlows.mockResolvedValue([{ id: 'f1' }]);
      await handlePublishFlowList(cmd('appcircle-publish-profile-publish-flow-list'), { platform: 'ios', publishProfileId: 'p1' });
      expect(svc.getPublishFlows).toHaveBeenCalledWith({ platform: 'ios', publishProfileId: 'p1' });
      expect(spinner.stop).toHaveBeenCalled();
      expect(commandWriter).toHaveBeenCalledWith(CommandTypes.PUBLISH, {
        fullCommandName: 'appcircle-publish-profile-publish-flow-list',
        data: [{ id: 'f1' }],
      });
    });
  });

  describe('handlePublishFlowDownload', () => {
    beforeEach(() => {
      spies.push(vi.spyOn(Date, 'now').mockReturnValue(111));
      svc.downloadPublishFlowYaml.mockResolvedValue('yaml: 1');
    });

    it('prints the command help and exits when publishFlowId is missing', async () => {
      const err = await handlePublishFlowDownload(cmd('appcircle-publish'), {}).catch((e) => e);
      expect(err).toBeInstanceOf(AppcircleExitError);
      expect(err.code).toBe(1);
      expect(console.error).toHaveBeenCalledTimes(1);
    });

    it('exits without help text when the command has no description', async () => {
      const err = await handlePublishFlowDownload(cmd('appcircle-publish-nope'), {}).catch((e) => e);
      expect(err).toBeInstanceOf(AppcircleExitError);
      expect(console.error).not.toHaveBeenCalled();
    });

    it('names the file after the flow and writes into the default Downloads directory', async () => {
      svc.getPublishFlows.mockResolvedValue([{ id: 'other' }, { id: 'f1', flowName: 'MyFlow' }]);
      await handlePublishFlowDownload(cmd('x'), { platform: 'ios', publishProfileId: 'p1', publishFlowId: 'f1' });
      expect(svc.downloadPublishFlowYaml).toHaveBeenCalledWith(expect.objectContaining({ publishFlowId: 'f1' }));
      expect(mfs.mkdirSync).not.toHaveBeenCalled();
      const expected = '/abs/home/u/Downloads/MyFlow_111.yaml';
      expect(mfs.writeFileSync).toHaveBeenCalledWith(expected, Buffer.from('yaml: 1'));
      expect(spinner.succeed).toHaveBeenCalledWith(`Publish Flow downloaded successfully to ${expected}`);
    });

    it('falls back to the flow id when the flow has no name, no flows are returned, or listing fails', async () => {
      svc.getPublishFlows.mockResolvedValueOnce([{ id: 'f1' }]);
      await handlePublishFlowDownload(cmd('x'), { publishFlowId: 'f1' });
      expect(mfs.writeFileSync).toHaveBeenLastCalledWith('/abs/home/u/Downloads/f1_111.yaml', expect.any(Buffer));

      svc.getPublishFlows.mockResolvedValueOnce(null);
      await handlePublishFlowDownload(cmd('x'), { publishFlowId: 'f2' });
      expect(mfs.writeFileSync).toHaveBeenLastCalledWith('/abs/home/u/Downloads/f2_111.yaml', expect.any(Buffer));

      svc.getPublishFlows.mockRejectedValueOnce(new Error('list failed'));
      await handlePublishFlowDownload(cmd('x'), { publishFlowId: 'f3' });
      expect(mfs.writeFileSync).toHaveBeenLastCalledWith('/abs/home/u/Downloads/f3_111.yaml', expect.any(Buffer));
    });

    it('expands ~, creates a missing directory and writes to a file path as-is', async () => {
      svc.getPublishFlows.mockResolvedValue([]);
      mfs.existsSync.mockReturnValue(false);
      mfs.statSync.mockReturnValue({ isDirectory: () => false } as any);
      await handlePublishFlowDownload(cmd('x'), { publishFlowId: 'f1', path: '~/out/flow.yaml' });
      expect(mfs.mkdirSync).toHaveBeenCalledWith('/abs/home/u/out/flow.yaml', { recursive: true });
      expect(mfs.writeFileSync).toHaveBeenCalledWith('/abs/home/u/out/flow.yaml', expect.any(Buffer));
    });

    it('uses a custom path without ~ unchanged', async () => {
      svc.getPublishFlows.mockResolvedValue([]);
      await handlePublishFlowDownload(cmd('x'), { publishFlowId: 'f1', path: '/tmp/dl' });
      expect(mfs.writeFileSync).toHaveBeenCalledWith('/abs/tmp/dl/f1_111.yaml', expect.any(Buffer));
    });

    it('fails the spinner and rethrows when the download fails', async () => {
      svc.getPublishFlows.mockResolvedValue([]);
      svc.downloadPublishFlowYaml.mockRejectedValue(new Error('dl failed'));
      await expect(handlePublishFlowDownload(cmd('x'), { publishFlowId: 'f1' })).rejects.toThrow('dl failed');
      expect(spinner.fail).toHaveBeenCalledWith('Failed to download Publish Flow');
    });
  });

  describe('handlePublishFlowUpdate', () => {
    it('prints help and exits when required params are missing', async () => {
      await expect(handlePublishFlowUpdate(cmd('appcircle-publish'), { publishFlowId: 'f1' })).rejects.toBeInstanceOf(AppcircleExitError);
      expect(console.error).toHaveBeenCalledTimes(1);
      await expect(handlePublishFlowUpdate(cmd('appcircle-publish-nope'), { filePath: 'a.yaml' })).rejects.toBeInstanceOf(AppcircleExitError);
      expect(console.error).toHaveBeenCalledTimes(1);
    });

    it('throws ProgramError when the file is missing or not a file', async () => {
      mfs.existsSync.mockReturnValueOnce(false);
      await expect(handlePublishFlowUpdate(cmd('x'), { publishFlowId: 'f1', filePath: '~/flow.yaml' })).rejects.toThrow(
        new ProgramError('Publish flow file not found at path: /abs/home/u/flow.yaml')
      );
      mfs.statSync.mockReturnValueOnce({ isFile: () => false } as any);
      await expect(handlePublishFlowUpdate(cmd('x'), { publishFlowId: 'f1', filePath: 'dir' })).rejects.toThrow(
        'Publish flow file not found at path: /abs/dir'
      );
      expect(svc.updatePublishFlowFromFile).not.toHaveBeenCalled();
    });

    it('updates the flow with the resolved file path', async () => {
      const params: any = { publishFlowId: 'f1', filePath: 'flow.yaml' };
      await handlePublishFlowUpdate(cmd('x'), params);
      expect(svc.updatePublishFlowFromFile).toHaveBeenCalledWith(expect.objectContaining({ filePath: '/abs/flow.yaml' }));
      expect(spinner.succeed).toHaveBeenCalledWith('Publish Flow updated successfully');
    });

    it('fails the spinner and rethrows when the update fails', async () => {
      svc.updatePublishFlowFromFile.mockRejectedValueOnce(new Error('upd failed'));
      await expect(handlePublishFlowUpdate(cmd('x'), { publishFlowId: 'f1', filePath: 'flow.yaml' })).rejects.toThrow('upd failed');
      expect(spinner.fail).toHaveBeenCalledWith('Failed to update Publish Flow');
    });
  });

  describe('handlePublishProfileDelete', () => {
    it('fails the spinner and rethrows when deletion fails', async () => {
      svc.getPublishProfileDetailById.mockResolvedValue({ name: 'P' });
      prompt.mockResolvedValue({ confirm: 'yes' } as any);
      svc.deletePublishProfile.mockRejectedValue(new Error('del failed'));
      await expect(handlePublishProfileDelete(cmd('x'), { publishProfileId: 'p1' })).rejects.toThrow('del failed');
      expect(spinner.fail).toHaveBeenCalledWith('Failed to remove Publish Profile');
      expect(commandWriter).not.toHaveBeenCalled();
    });
  });

  describe('validateFileForUpload', () => {
    it('requires a path', () => {
      expect(() => validateFileForUpload('', '')).toThrow(/The --app parameter is required/);
    });

    it('rejects a missing file using the original path in the message', () => {
      mfs.existsSync.mockReturnValue(false);
      expect(() => validateFileForUpload('~/app.ipa', '~/app.ipa')).toThrow('File not found: ~/app.ipa');
    });

    it('returns the resolved, tilde-expanded path for an existing file', () => {
      expect(validateFileForUpload('~/app.ipa', '~/app.ipa')).toBe('/abs/home/u/app.ipa');
      expect(mfs.existsSync).toHaveBeenCalledWith('/abs/home/u/app.ipa');
    });
  });

  describe('handleReleaseCandidateMarking', () => {
    it('picks the newest version, treating versions without createdAt as oldest', async () => {
      svc.getAppVersions.mockResolvedValue([
        { id: 'no-date-1' },
        { id: 'newest', createdAt: '2025-01-02T00:00:00Z' },
        { id: 'no-date-2' },
        { id: 'older', createdAt: '2024-01-01T00:00:00Z' },
      ]);
      await handleReleaseCandidateMarking({ publishProfileId: 'p1' }, true);
      expect(svc.setAppVersionReleaseCandidateStatus).toHaveBeenCalledWith(
        expect.objectContaining({ appVersionId: 'newest', releaseCandidate: true })
      );
    });
  });

  describe('handlePublishUploadError', () => {
    const sp = () => ({ stop: vi.fn(), fail: vi.fn() });

    it('maps a string "file too large" response, with and without a status code', () => {
      const s1 = sp();
      expect(() => handlePublishUploadError({ response: { data: 'The file is too large' } }, s1)).toThrow(
        'File size exceeds the maximum allowed limit of 3 GB.'
      );
      expect(s1.stop).toHaveBeenCalled();
      expect(s1.fail).toHaveBeenCalledWith('Request failed with status code 400 Bad Request.');

      const s2 = sp();
      expect(() => handlePublishUploadError({ response: { status: 413, data: { message: 'The file is too large' } } }, s2)).toThrow(
        AppcircleExitError
      );
      expect(s2.fail).toHaveBeenCalledWith('Request failed with status code 413 Bad Request.');
    });

    it('maps "Cannot read properties" errors and uses status/statusText when present', () => {
      const s1 = sp();
      expect(() => handlePublishUploadError({ message: 'Cannot read properties of undefined' }, s1)).toThrow('API response format error');
      expect(s1.stop).toHaveBeenCalled();
      expect(s1.fail).toHaveBeenCalledWith('Request failed with status code 500 Internal Server Error.');

      const s2 = sp();
      const err: any = { message: 'Cannot read properties of null', response: { status: 502, statusText: 'Bad Gateway', data: {} } };
      expect(() => handlePublishUploadError(err, s2)).toThrow('API response format error');
      expect(s2.fail).toHaveBeenCalledWith('Request failed with status code 502 Bad Gateway.');
    });

    it('maps file extension errors with and without a spinner', () => {
      const s = sp();
      expect(() => handlePublishUploadError({ response: { data: { message: 'File extension is .zip' } } }, s)).toThrow(AppcircleExitError);
      expect(s.stop).toHaveBeenCalled();
      expect(s.fail).toHaveBeenCalledWith('Request failed with status code 400 Bad Request.');
      expect(console.error).toHaveBeenCalledWith('Invalid file type. Extension should be .ipa, .apk, or .aab.\n');

      expect(() => handlePublishUploadError({ message: 'bad extension' })).toThrow(AppcircleExitError);
    });
  });

  describe('handlePublishVersionUpload', () => {
    const params = () => ({ app: 'build/app.ipa', publishProfileId: 'p1', platform: 'ios', customTag: 't', message: 'm' }) as any;

    beforeEach(() => {
      mfs.statSync.mockReturnValue({ isDirectory: () => false, isFile: () => true, size: 2048 } as any);
      svc.getPublishUploadInformation.mockResolvedValue({ fileId: 'file-1' });
      svc.commitPublishFileUpload.mockResolvedValue({ taskId: 'task-1', appVersionId: 'av-1' });
      svc.getTaskStatus.mockResolvedValue({ stateValue: 3 });
    });

    it('uploads, commits and waits for the task without marking as RC', async () => {
      await handlePublishVersionUpload(cmd('x'), params());
      expect(svc.getPublishUploadInformation).toHaveBeenCalledWith({ fileName: 'app.ipa', fileSize: 2048, publishProfileId: 'p1', platform: 'ios' });
      expect(svc.uploadArtifactWithSignedUrl).toHaveBeenCalledWith({ app: '/abs/build/app.ipa', uploadInfo: { fileId: 'file-1' } });
      expect(svc.commitPublishFileUpload).toHaveBeenCalledWith({
        fileId: 'file-1', fileName: 'app.ipa', publishProfileId: 'p1', platform: 'ios', customTag: 't', message: 'm',
      });
      expect(svc.getTaskStatus).toHaveBeenCalledWith({ taskId: 'task-1' });
      expect(svc.setAppVersionReleaseCandidateStatus).not.toHaveBeenCalled();
      expect(spinner.text).toBe('App version uploaded  successfully.\n\nTaskId: task-1');
      expect(spinner.succeed).toHaveBeenCalled();
    });

    it('marks the uploaded version as release candidate when requested', async () => {
      await handlePublishVersionUpload(cmd('x'), { ...params(), markAsRc: true });
      expect(svc.setAppVersionReleaseCandidateStatus).toHaveBeenCalledWith(
        expect.objectContaining({ appVersionId: 'av-1', releaseCandidate: true })
      );
      expect(spinner.text).toContain('and marked as release candidate');
    });

    it('reports the upload error message and rethrows unknown errors', async () => {
      svc.uploadArtifactWithSignedUrl.mockRejectedValueOnce(new Error('network down'));
      await expect(handlePublishVersionUpload(cmd('x'), params())).rejects.toThrow('network down');
      expect(spinner.fail).toHaveBeenCalledWith('Upload failed: network down');
      expect(spinner.fail).toHaveBeenLastCalledWith('Upload failed');
    });

    it('uses "Unknown error" when the upload error has no message', async () => {
      svc.uploadArtifactWithSignedUrl.mockRejectedValueOnce({ code: 'X' });
      await expect(handlePublishVersionUpload(cmd('x'), params())).rejects.toEqual({ code: 'X' });
      expect(spinner.fail).toHaveBeenCalledWith('Upload failed: Unknown error');
    });
  });

  describe('getAppVersionDetailsForDeletion', () => {
    it('describes a version without a file name by its version number', async () => {
      svc.getAppVersionDetail.mockResolvedValue({ version: '2.0' });
      expect(await getAppVersionDetailsForDeletion({ appVersionId: 'v1' })).toBe('"Version 2.0" (ID: v1)');
    });

    it('falls back to the version list when the detail is empty', async () => {
      svc.getAppVersionDetail.mockResolvedValue(null);
      svc.getAppVersions.mockResolvedValueOnce([{ id: 'v0' }, { id: 'v1', fileName: 'a.ipa', version: '1.0' }]);
      expect(await getAppVersionDetailsForDeletion({ appVersionId: 'v1' })).toBe('"a.ipa (v1.0)" (ID: v1)');

      svc.getAppVersions.mockResolvedValueOnce([{ id: 'v1', version: '3.1' }]);
      expect(await getAppVersionDetailsForDeletion({ appVersionId: 'v1' })).toBe('"Version 3.1" (ID: v1)');

      svc.getAppVersions.mockResolvedValueOnce([{ id: 'zz' }]);
      expect(await getAppVersionDetailsForDeletion({ appVersionId: 'v1' })).toBe('(ID: v1)');
    });
  });

  describe('handlePublishVersionDelete', () => {
    beforeEach(() => {
      svc.getAppVersionDetail.mockResolvedValue({ fileName: 'a.ipa', version: '1' });
    });

    it('does nothing when the user cancels', async () => {
      prompt.mockResolvedValue({ confirm: 'no' } as any);
      await handlePublishVersionDelete(cmd('x'), { appVersionId: 'v1' });
      expect((prompt.mock.calls[0][0] as any).message).toContain('"a.ipa (v1)" (ID: v1)');
      expect(svc.deleteAppVersion).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('App Version deletion cancelled.'));
    });

    it('deletes the version and reports the task id', async () => {
      prompt.mockResolvedValue({ confirm: 'yes' } as any);
      svc.deleteAppVersion.mockResolvedValue({ taskId: 'del-task' });
      await handlePublishVersionDelete(cmd('x'), { appVersionId: 'v1' });
      expect(svc.deleteAppVersion).toHaveBeenCalledWith({ appVersionId: 'v1' });
      expect(commandWriter).toHaveBeenCalledWith(CommandTypes.PUBLISH, { taskId: 'del-task' });
      expect(spinner.text).toBe('App Version removed successfully.\n\nTaskId: del-task');
      expect(spinner.succeed).toHaveBeenCalled();
    });

    it('fails the spinner and rethrows on error', async () => {
      prompt.mockResolvedValue({ confirm: 'yes' } as any);
      svc.deleteAppVersion.mockRejectedValue(new Error('cannot delete'));
      await expect(handlePublishVersionDelete(cmd('x'), { appVersionId: 'v1' })).rejects.toThrow('cannot delete');
      expect(spinner.fail).toHaveBeenCalledWith('Remove failed');
    });
  });

  describe('setupDownloadDirectoryForAppVersion', () => {
    it('returns an existing directory without creating it', () => {
      expect(setupDownloadDirectoryForAppVersion({})).toBe('/home/u/Downloads');
      expect(mfs.mkdirSync).not.toHaveBeenCalled();
    });
  });

  describe('handlePublishVersionDownload', () => {
    it('downloads the version file into the target directory', async () => {
      svc.getAppVersionDownloadLink.mockResolvedValue('https://example.test/file');
      svc.getAppVersions.mockResolvedValue([{ id: 'v1', fileName: 'app.ipa' }]);
      await handlePublishVersionDownload(cmd('x'), { appVersionId: 'v1', path: '/out' });
      expect(svc.downloadAppVersion).toHaveBeenCalledWith({ url: 'https://example.test/file', path: '/abs/out/app.ipa' });
      expect(spinner.text).toBe('App version downloaded successfully.\n\nDownload Path: /abs/out/app.ipa');
      expect(spinner.succeed).toHaveBeenCalled();
    });

    it('fails the spinner and rethrows when the version cannot be found', async () => {
      svc.getAppVersionDownloadLink.mockResolvedValue('u');
      svc.getAppVersions.mockResolvedValue([]);
      await expect(handlePublishVersionDownload(cmd('x'), { appVersionId: 'v1' })).rejects.toThrow('App version not found');
      expect(spinner.fail).toHaveBeenCalledWith('Process failed');
    });
  });

  describe('handlePublishVariableGroupUpload', () => {
    it('fails the spinner and rethrows when validation fails', async () => {
      await expect(handlePublishVariableGroupUpload(cmd('x'), {})).rejects.toThrow('JSON file path is required');
      expect(spinner.fail).toHaveBeenCalledWith('JSON file path is required');
      expect(spinner.fail).toHaveBeenLastCalledWith('Failed to upload Environment Variables');
      expect(svc.uploadPublishEnvironmentVariablesFromFile).not.toHaveBeenCalled();
    });
  });

  describe('handlePublishStart', () => {
    beforeEach(() => {
      svc.getPublishByAppVersion.mockResolvedValue({ steps: [{ publishId: 'step-pub' }] });
    });

    it('uses the first step publishId when the start response is not a string and prints JSON when monitoring is impossible', async () => {
      cfg.getConsoleOutputType.mockReturnValue('json');
      svc.startExistingPublishFlow.mockResolvedValue({ ok: true });
      await handlePublishStart(cmd('x'), { platform: 'ios' });
      expect(createOra).not.toHaveBeenCalled();
      expect(svc.startExistingPublishFlow).toHaveBeenCalledWith({ platform: 'ios', publishId: 'step-pub' });
      expect(console.log).toHaveBeenCalledWith(
        JSON.stringify({ publishId: 'step-pub', status: 'started', message: 'Publish flow started successfully' })
      );
    });

    it('in JSON mode does not report the failure through a spinner and rethrows', async () => {
      cfg.getConsoleOutputType.mockReturnValue('json');
      svc.getPublishByAppVersion.mockRejectedValue(new Error('no publish'));
      await expect(handlePublishStart(cmd('x'), {})).rejects.toThrow('no publish');
      expect(createOra).not.toHaveBeenCalled();
    });

    it('calls the no-op spinner when the output type is JSON at start but plain afterwards', async () => {
      cfg.getConsoleOutputType.mockReturnValueOnce('json').mockReturnValue('plain');
      svc.startExistingPublishFlow.mockResolvedValue('pub-from-start');
      await expect(handlePublishStart(cmd('x'), {})).resolves.toBeUndefined();
      expect(createOra).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Insufficient parameters to monitor Publish Status'));

      cfg.getConsoleOutputType.mockReturnValueOnce('json').mockReturnValue('plain');
      svc.getPublishByAppVersion.mockRejectedValueOnce(new Error('failed after json'));
      await expect(handlePublishStart(cmd('x'), {})).rejects.toThrow('failed after json');
      expect(createOra).not.toHaveBeenCalled();
    });

    it('monitors the publish when platform, profile and app version are given', async () => {
      vi.useFakeTimers();
      cfg.getConsoleOutputType.mockReturnValue('json');
      svc.startExistingPublishFlow.mockResolvedValue('pub-1');
      const get = vi.spyOn(appcircleApi, 'get').mockResolvedValue({ status: 200, data: { status: 0 } } as any);
      spies.push(get);
      const p = handlePublishStart(cmd('x'), { platform: 'ios', publishProfileId: 'p1', appVersionId: 'v1' });
      const settled = p.then(() => 'resolved', (e) => e);
      // 2s initial delay, then the 10s back-off that follows the (internally caught) success exit
      await vi.advanceTimersByTimeAsync(12000);
      expect(await settled).toBe('resolved');
      expect(get).toHaveBeenCalledWith('publish/v1/profiles/ios/p1/app-versions/v1/publish', expect.any(Object));
      expect(console.log).toHaveBeenCalledWith(
        JSON.stringify({ publishId: 'pub-1', status: 'success', message: 'Publish completed successfully' })
      );
    });
  });
});
