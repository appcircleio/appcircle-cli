/**
 * Unit tests for command-runner handlers of the enterprise app store, testing
 * distribution, signing identity and organization commands (paths not reached by
 * the older suites).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import path from 'path';
import * as services from '../../../src/services';
import { commandWriter } from '../../../src/core/writer';
import { createOra } from '../../../src/utils/orahelper';
import enquirer from 'enquirer';
import { Commands, CommandTypes } from '../../../src/core/commands';
import { AppcircleExitError } from '../../../src/core/AppcircleExitError';
import { ProgramError } from '../../../src/core/ProgramError';
import {
  validateEnterpriseAppVersionParams,
  handleEnterpriseProfileList,
  handleEnterpriseVersionList,
  handleEnterpriseVersionPublish,
  handleEnterpriseVersionRemove,
  handleUploadError,
  handleEnterpriseVersionUploadForProfile,
  handleEnterpriseVersionUploadWithoutProfile,
  validateTestingGroupParams,
  handleDistributionUpload,
  handleDistributionProfileAutoSend,
  handleTestingGroupList,
  handleTestingGroupView,
  handleTestingGroupRemove,
  handleTestingGroupTesterRemove,
  handleCertificateRemove,
  handleKeystoreUpload,
  handleKeystoreDownload,
  handleKeystoreRemove,
  handleProvisioningProfileRemove,
  handleOrganizationCommand,
} from '../../../src/core/command-runner';

const h = vi.hoisted(() => ({ spinners: [] as any[] }));

vi.mock('../../../src/services', async (importOriginal) => {
  const actual: any = await importOriginal();
  const mocked: any = {};
  for (const [key, value] of Object.entries(actual)) {
    mocked[key] = typeof value === 'function' ? vi.fn() : value;
  }
  return mocked;
});

vi.mock('../../../src/core/writer', () => ({
  commandWriter: vi.fn(),
  configWriter: vi.fn(),
}));

vi.mock('../../../src/utils/orahelper', () => ({ createOra: vi.fn() }));

vi.mock('enquirer', () => ({ default: { prompt: vi.fn() } }));

vi.mock('chalk', () => {
  const id = (text: string) => text;
  return {
    default: {
      red: id, yellow: id, green: id, cyan: id, blue: id, gray: id, white: id,
      hex: () => id,
    },
  };
});

const svc = services as any;
const cmd = (name: string) => ({ fullCommandName: `appcircle-${name}` }) as any;
const lastSpinner = () => h.spinners[h.spinners.length - 1];
const fullSpinner = () => ({ stop: vi.fn(), fail: vi.fn() });
const promptMessage = () => (vi.mocked(enquirer.prompt).mock.calls[0][0] as any).message;

const caught = (fn: () => unknown): any => {
  try {
    fn();
  } catch (e) {
    return e;
  }
  throw new Error('expected the call to throw');
};

beforeEach(() => {
  h.spinners.length = 0;
  vi.mocked(createOra).mockImplementation((text?: string) => {
    const spinner: any = { text: text ?? '' };
    spinner.start = vi.fn(() => spinner);
    spinner.stop = vi.fn(() => spinner);
    spinner.succeed = vi.fn(() => spinner);
    spinner.fail = vi.fn(() => spinner);
    h.spinners.push(spinner);
    return spinner;
  });
  vi.mocked(path.basename).mockReturnValue('app.ipa');
});

describe('enterprise app store handlers', () => {
  it('validateEnterpriseAppVersionParams requires a version id or name', async () => {
    await expect(
      validateEnterpriseAppVersionParams(cmd('enterprise-app-store-version-publish'), {}),
    ).rejects.toThrow(new ProgramError('Either --entVersionId or --entVersion parameter is required.'));
    expect(svc.getEnterpriseAppVersions).not.toHaveBeenCalled();
  });

  it('handleEnterpriseProfileList stops the spinner and rethrows on error', async () => {
    svc.getEnterpriseProfiles.mockRejectedValue(new Error('down'));
    await expect(handleEnterpriseProfileList(cmd('enterprise-app-store-profile-list'))).rejects.toThrow('down');
    expect(lastSpinner().stop).toHaveBeenCalled();
    expect(commandWriter).not.toHaveBeenCalled();
  });

  it('handleEnterpriseVersionList stops the spinner and rethrows on error', async () => {
    svc.getEnterpriseAppVersions.mockRejectedValue(new Error('down'));
    await expect(handleEnterpriseVersionList(cmd('enterprise-app-store-version-list'), {})).rejects.toThrow('down');
    expect(lastSpinner().stop).toHaveBeenCalled();
    expect(commandWriter).not.toHaveBeenCalled();
  });

  describe('handleEnterpriseVersionPublish required parameters', () => {
    const full = { entProfileId: 'p', entVersionId: 'v', summary: 's', releaseNotes: 'r', publishType: '1' };
    it.each([
      ['entProfileId', 'Enterprise Profile ID (--entProfileId) is required'],
      ['entVersionId', 'Enterprise Version ID (--entVersionId) is required'],
      ['summary', 'Summary (--summary) is required'],
      ['releaseNotes', 'Release Notes (--releaseNotes) is required'],
      ['publishType', 'Publish Type (--publishType) is required'],
    ])('fails without %s', async (missing, message) => {
      const params: any = { ...full };
      delete params[missing];
      await expect(handleEnterpriseVersionPublish(cmd('enterprise-app-store-version-publish'), params)).rejects.toThrow(
        message,
      );
      expect(svc.publishEnterpriseAppVersion).not.toHaveBeenCalled();
    });
  });

  it('handleEnterpriseVersionRemove fails when the version does not exist', async () => {
    svc.getEnterpriseAppVersions.mockResolvedValue([{ id: 'other' }]);
    await expect(
      handleEnterpriseVersionRemove(cmd('enterprise-app-store-version-remove'), { entProfileId: 'p', entVersionId: 'v' }),
    ).rejects.toThrow('App Version not found');
    expect(svc.getEnterpriseAppVersions).toHaveBeenCalledWith({ entProfileId: 'p', publishType: '0' });
    expect(enquirer.prompt).not.toHaveBeenCalled();
  });

  describe('handleEnterpriseVersionUploadForProfile outer error handling', () => {
    it('does not mark the spinner failed when the file validation exits', async () => {
      await expect(handleEnterpriseVersionUploadForProfile(cmd('x'), {})).rejects.toBeInstanceOf(AppcircleExitError);
      expect(lastSpinner().fail).not.toHaveBeenCalled();
    });

    it('turns an upload error into an exit without the generic failure text', async () => {
      svc.getEnterpriseUploadInformation.mockResolvedValue({ fileId: 'f-1' });
      svc.uploadArtifactWithSignedUrl.mockRejectedValue(new Error('The file is too large'));
      await expect(
        handleEnterpriseVersionUploadForProfile(cmd('x'), { app: 'app.ipa', entProfileId: 'p' }),
      ).rejects.toBeInstanceOf(AppcircleExitError);
      expect(lastSpinner().fail).toHaveBeenCalledTimes(1);
      expect(lastSpinner().fail).toHaveBeenCalledWith('File size exceeds the maximum allowed limit of 3 GB.');
      expect(svc.commitEnterpriseFileUpload).not.toHaveBeenCalled();
    });

    it('marks the spinner failed for other errors', async () => {
      svc.getEnterpriseUploadInformation.mockRejectedValue(new Error('no upload info'));
      await expect(
        handleEnterpriseVersionUploadForProfile(cmd('x'), { app: 'app.ipa', entProfileId: 'p' }),
      ).rejects.toThrow('no upload info');
      expect(lastSpinner().fail).toHaveBeenCalledWith('Upload failed');
    });
  });

  describe('handleEnterpriseVersionUploadWithoutProfile', () => {
    const command = cmd('enterprise-app-store-version-upload-without-profile');

    it('uploads, commits and writes the result', async () => {
      svc.getEnterpriseUploadInformation.mockResolvedValue({ fileId: 'f-1', url: 'u' });
      svc.uploadArtifactWithSignedUrl.mockResolvedValue(undefined);
      svc.commitEnterpriseFileUpload.mockResolvedValue({ taskId: 'task-1' });

      await handleEnterpriseVersionUploadWithoutProfile(command, { app: 'app.ipa', customTag: 'tag', message: 'm' });

      expect(svc.getEnterpriseUploadInformation).toHaveBeenCalledWith({ fileName: 'app.ipa', fileSize: 1000 });
      expect(svc.uploadArtifactWithSignedUrl).toHaveBeenCalledWith({
        app: '/mock/resolved/app.ipa',
        uploadInfo: { fileId: 'f-1', url: 'u' },
      });
      expect(svc.commitEnterpriseFileUpload).toHaveBeenCalledWith({
        fileId: 'f-1',
        fileName: 'app.ipa',
        customTag: 'tag',
        message: 'm',
      });
      expect(commandWriter).toHaveBeenCalledWith(CommandTypes.ENTERPRISE_APP_STORE, {
        fullCommandName: command.fullCommandName,
        data: { taskId: 'task-1' },
      });
      expect(lastSpinner().text).toBe('New profile created and app uploaded successfully.\n\nTaskId: task-1');
      expect(lastSpinner().succeed).toHaveBeenCalled();
    });

    it('turns an upload error into an exit without the generic failure text', async () => {
      svc.getEnterpriseUploadInformation.mockResolvedValue({ fileId: 'f-1' });
      svc.uploadArtifactWithSignedUrl.mockRejectedValue({ message: 'Bad Request', response: { status: 409, data: 'conflict' } });
      await expect(handleEnterpriseVersionUploadWithoutProfile(command, { app: 'app.ipa' })).rejects.toMatchObject({
        message: 'conflict',
        code: 1,
      });
      expect(lastSpinner().fail).toHaveBeenCalledTimes(1);
      expect(lastSpinner().fail).toHaveBeenCalledWith('Request failed with status code 409 Bad Request.');
    });

    it('shows the ProgramError message on the spinner', async () => {
      svc.getEnterpriseUploadInformation.mockRejectedValue(new ProgramError('quota exceeded'));
      await expect(handleEnterpriseVersionUploadWithoutProfile(command, { app: 'app.ipa' })).rejects.toThrow(
        'quota exceeded',
      );
      expect(lastSpinner().fail).toHaveBeenCalledWith('quota exceeded');
    });

    it('shows a generic failure for other errors', async () => {
      svc.getEnterpriseUploadInformation.mockRejectedValue(new Error('socket hang up'));
      await expect(handleEnterpriseVersionUploadWithoutProfile(command, { app: 'app.ipa' })).rejects.toThrow(
        'socket hang up',
      );
      expect(lastSpinner().fail).toHaveBeenCalledWith('Upload failed');
    });
  });
});

describe('handleUploadError', () => {
  it('handles "file too large" from a string body without a usable spinner', () => {
    const err = caught(() => handleUploadError({ response: { data: 'The file is too large' } }, {}));
    expect(err).toBeInstanceOf(AppcircleExitError);
    expect(err.code).toBe(1);
    expect(console.error).toHaveBeenCalledWith('File size exceeds the maximum allowed limit of 3 GB.\n');
  });

  it('rethrows a ProgramError as an exit error without a usable spinner', () => {
    const err = caught(() => handleUploadError(new ProgramError('bad profile'), {}));
    expect(err).toBeInstanceOf(AppcircleExitError);
    expect(err.message).toBe('bad profile');
  });

  it('handles an API response format error without a usable spinner', () => {
    const err = caught(() => handleUploadError(new Error("Cannot read properties of undefined (reading 'x')"), {}));
    expect(err).toBeInstanceOf(AppcircleExitError);
    expect(console.error).toHaveBeenCalledWith(
      'API response format error. Please check your connection settings (AUTH_HOSTNAME and API_HOSTNAME).\n',
    );
  });

  it('handles a file extension error with a spinner', () => {
    const spinner = fullSpinner();
    const err = caught(() =>
      handleUploadError({ message: 'x', response: { status: 400, data: { message: 'File extension is .zip' } } }, spinner),
    );
    expect(err).toBeInstanceOf(AppcircleExitError);
    expect(spinner.stop).toHaveBeenCalled();
    expect(spinner.fail).toHaveBeenCalledWith('Request failed with status code 400 Bad Request.');
    expect(console.error).toHaveBeenCalledWith('Invalid file type. Extension should be .ipa, .apk, or .aab.\n');
  });

  it.each([[null], [{}]])('handles a file extension error with spinner %j', (spinner) => {
    const err = caught(() => handleUploadError({ message: 'Bad Request: wrong extension' }, spinner));
    expect(err).toBeInstanceOf(AppcircleExitError);
    expect(console.error).toHaveBeenCalledWith('Invalid file type. Extension should be .ipa, .apk, or .aab.\n');
  });

  it('reports status code, status text and API message', () => {
    const spinner = fullSpinner();
    const err = caught(() =>
      handleUploadError(
        { message: 'Request failed', response: { status: 500, statusText: 'Internal Server Error', data: { message: 'Server says no' } } },
        spinner,
      ),
    );
    expect(spinner.fail).toHaveBeenCalledWith('Request failed with status code 500 Internal Server Error.');
    expect(console.error).toHaveBeenCalledWith('\nServer says no');
    expect(err).toBeInstanceOf(AppcircleExitError);
    expect(err.message).toBe('Server says no');
  });

  it('uses the axios message when the API message is empty', () => {
    const err = caught(() => handleUploadError({ message: 'Forbidden', response: { status: 403, data: {} } }, {}));
    expect(err.message).toBe('Forbidden');
    expect(console.error).not.toHaveBeenCalled();
  });

  it('uses "Upload failed" when there is no message at all', () => {
    const err = caught(() => handleUploadError({ response: { status: 502, data: {} } }, null));
    expect(err.message).toBe('Upload failed');
  });

  it('does not print a whitespace-only API message', () => {
    const spinner = fullSpinner();
    const err = caught(() => handleUploadError({ response: { status: 500, data: '   ' } }, spinner));
    expect(console.error).not.toHaveBeenCalled();
    expect(err.message).toBe('   ');
  });

  it('rethrows other errors and reports "Unknown error" without a message', () => {
    const spinner = fullSpinner();
    const original = {};
    expect(caught(() => handleUploadError(original, spinner))).toBe(original);
    expect(spinner.fail).toHaveBeenCalledWith('Upload failed: Unknown error');
  });

  it('rethrows other errors without a usable spinner', () => {
    const original = new Error('network');
    expect(caught(() => handleUploadError(original, {}))).toBe(original);
  });
});

describe('testing distribution handlers', () => {
  it('validateTestingGroupParams requires a testing group id or name', async () => {
    await expect(
      validateTestingGroupParams(cmd('testing-distribution-testing-group-view'), {}),
    ).rejects.toMatchObject({ message: 'Either --testingGroupId or --testingGroup parameter is required', code: 1 });
    expect(svc.getTestingGroups).not.toHaveBeenCalled();
  });

  it.each([[[]], [null]])('handleDistributionUpload fails when no profile is available (%j)', async (profiles) => {
    svc.getDistributionProfiles.mockResolvedValue(profiles);
    await expect(
      handleDistributionUpload(cmd('testing-distribution-upload'), { distProfileId: 'd', app: 'app.ipa' }),
    ).rejects.toMatchObject({ message: 'No Distribution Profile available', code: 1 });
    const spinner = lastSpinner();
    expect(spinner.text).toBe('No Distribution Profile available');
    expect(spinner.fail).toHaveBeenCalledTimes(1);
    expect(spinner.fail).toHaveBeenCalledWith();
    expect(svc.getTestingDistributionUploadInformation).not.toHaveBeenCalled();
  });

  describe('handleDistributionProfileAutoSend', () => {
    const command = cmd('testing-distribution-profile-settings-auto-send');

    it('resolves the profile name and enables auto send', async () => {
      svc.getDistributionProfiles.mockResolvedValue([{ id: 'd-1', name: 'QA' }]);
      const params: any = { distProfile: 'QA', autoSend: true };
      await handleDistributionProfileAutoSend(command, params);
      expect(params.distProfileId).toBe('d-1');
      expect(lastSpinner().text).toBe('Auto Send enabled successfully for Distribution Profile');
      expect(lastSpinner().succeed).toHaveBeenCalled();
    });

    it('reports auto send disabled for an id', async () => {
      svc.getDistributionProfiles.mockResolvedValue([{ id: 'd-1', name: 'QA' }]);
      await handleDistributionProfileAutoSend(command, { distProfileId: 'd-1', autoSend: false });
      expect(lastSpinner().text).toBe('Auto Send disabled successfully for Distribution Profile');
    });

    it('fails when the profile name is not found', async () => {
      svc.getDistributionProfiles.mockResolvedValue([{ id: 'd-1', name: 'QA' }]);
      await expect(handleDistributionProfileAutoSend(command, { distProfile: 'Nope' })).rejects.toMatchObject({
        message: 'Distribution profile with name "Nope" not found',
        code: 1,
      });
      expect(lastSpinner().fail.mock.calls).toEqual([
        ['Distribution profile with name "Nope" not found'],
        ['Auto send setting failed'],
      ]);
    });

    it.each([[[]], [undefined]])('fails when no profile is available (%j)', async (profiles) => {
      svc.getDistributionProfiles.mockResolvedValue(profiles);
      await expect(handleDistributionProfileAutoSend(command, { distProfileId: 'd-1' })).rejects.toMatchObject({
        message: 'No Distribution Profile available',
      });
      expect(lastSpinner().fail).toHaveBeenLastCalledWith('Auto send setting failed');
      expect(lastSpinner().succeed).not.toHaveBeenCalled();
    });
  });

  it('handleTestingGroupList stops the spinner and rethrows on error', async () => {
    svc.getTestingGroups.mockRejectedValue(new Error('down'));
    await expect(handleTestingGroupList(cmd('testing-distribution-testing-group-list'))).rejects.toThrow('down');
    expect(lastSpinner().stop).toHaveBeenCalled();
  });

  it('handleTestingGroupView stops the spinner and rethrows on error', async () => {
    svc.getTestingGroupById.mockRejectedValue(new Error('missing'));
    await expect(
      handleTestingGroupView(cmd('testing-distribution-testing-group-view'), { testingGroupId: 'g' }),
    ).rejects.toThrow('missing');
    expect(svc.getTestingGroupById).toHaveBeenCalledWith({ testingGroupId: 'g' });
    expect(lastSpinner().stop).toHaveBeenCalled();
  });

  it('handleTestingGroupRemove marks the spinner failed when the lookup fails', async () => {
    svc.getTestingGroupById.mockRejectedValue(new Error('missing'));
    await expect(
      handleTestingGroupRemove(cmd('testing-distribution-testing-group-remove'), { testingGroupId: 'g' }),
    ).rejects.toThrow('missing');
    expect(lastSpinner().fail).toHaveBeenCalledWith('Remove failed');
    expect(svc.deleteTestingGroup).not.toHaveBeenCalled();
  });

  describe('handleTestingGroupTesterRemove', () => {
    const command = cmd('testing-distribution-testing-group-tester-remove');

    it('names "this Tester" in the prompt when no email is given and can be cancelled', async () => {
      vi.mocked(enquirer.prompt).mockResolvedValue({ confirm: 'no' } as any);
      await handleTestingGroupTesterRemove(command, { testingGroupId: 'g' });
      expect(promptMessage()).toBe(
        'Are you sure you want to remove this Tester from the Testing Group? This action cannot be undone. (Y/n)',
      );
      expect(console.log).toHaveBeenCalledWith('Tester removal cancelled.');
      expect(svc.removeTesterFromTestingGroup).not.toHaveBeenCalled();
    });

    it('marks the spinner failed when the removal fails', async () => {
      vi.mocked(enquirer.prompt).mockResolvedValue({ confirm: 'yes' } as any);
      svc.removeTesterFromTestingGroup.mockRejectedValue(new Error('cannot remove'));
      const params = { testingGroupId: 'g', email: 't@example.com' };
      await expect(handleTestingGroupTesterRemove(command, params)).rejects.toThrow('cannot remove');
      expect(svc.removeTesterFromTestingGroup).toHaveBeenCalledWith(params);
      expect(lastSpinner().fail).toHaveBeenCalledWith('Remove failed');
    });
  });
});

describe('signing identity handlers', () => {
  describe('handleCertificateRemove confirmation name', () => {
    const command = cmd('signing-identity-certificate-remove');
    const params = { certificateId: 'cert-id', certificateBundleId: 'bundle-id' };

    beforeEach(() => {
      vi.mocked(enquirer.prompt).mockResolvedValue({ confirm: 'no' } as any);
    });

    it.each([
      ['the certificate id when no details are returned', null, 'cert-id'],
      ['the detail id when the detail has no name', { id: 'detail-id' }, 'detail-id'],
    ])('uses %s', async (_label, detail, expected) => {
      svc.getCertificateDetailById.mockResolvedValue(detail);
      await handleCertificateRemove(command, params);
      expect(svc.getCertificateDetailById).toHaveBeenCalledWith({ certificateBundleId: 'bundle-id' });
      expect(promptMessage()).toContain(`delete the Certificate "${expected}"?`);
      expect(console.log).toHaveBeenCalledWith('Certificate deletion cancelled.');
    });

    it('warns and uses the id when the details cannot be fetched', async () => {
      svc.getCertificateDetailById.mockRejectedValue(new Error('404'));
      await handleCertificateRemove(command, params);
      expect(console.warn).toHaveBeenCalledWith(
        '\nWarning: Could not fetch certificate details. Using ID in confirmation.',
      );
      expect(promptMessage()).toContain('delete the Certificate "cert-id"?');
    });
  });

  it('handleKeystoreUpload passes an undefined path through', async () => {
    svc.uploadAndroidKeystoreFile.mockResolvedValue(undefined);
    await handleKeystoreUpload(cmd('signing-identity-keystore-upload'), { password: 'x' });
    expect(svc.uploadAndroidKeystoreFile).toHaveBeenCalledWith({ password: 'x', path: undefined });
    expect(lastSpinner().succeed).toHaveBeenCalledWith('Keystore file uploaded successfully.\n\n');
  });

  it('handleKeystoreDownload names the file after the keystore id when there is no file name', async () => {
    svc.getKeystoreDetailById.mockResolvedValue({ id: 'ks-1' });
    svc.downloadKeystoreById.mockResolvedValue(undefined);
    await handleKeystoreDownload(cmd('signing-identity-keystore-download'), { keystoreId: 'ks-1', path: '/tmp/out' });
    expect(svc.downloadKeystoreById).toHaveBeenCalledWith(
      { keystoreId: 'ks-1', path: '/tmp/out' },
      '/mock/resolved//tmp/out',
      'ks-1.keystore',
    );
    expect(lastSpinner().succeed).toHaveBeenCalled();
  });

  describe('handleKeystoreRemove', () => {
    const command = cmd('signing-identity-keystore-remove');

    it.each([
      ['the keystore id when no details are returned', null, 'ks-1'],
      ['the file name when there is no name', { fileName: 'release.jks', id: 'x' }, 'release.jks'],
      ['the detail id when there is no name or file name', { id: 'detail-id' }, 'detail-id'],
    ])('confirms with %s', async (_label, detail, expected) => {
      vi.mocked(enquirer.prompt).mockResolvedValue({ confirm: 'no' } as any);
      svc.getKeystoreDetailById.mockResolvedValue(detail);
      await handleKeystoreRemove(command, { keystoreId: 'ks-1' });
      expect(promptMessage()).toContain(`delete the Keystore "${expected}"?`);
      expect(console.log).toHaveBeenCalledWith('Keystore deletion cancelled.');
    });

    it('warns when the details cannot be fetched', async () => {
      vi.mocked(enquirer.prompt).mockResolvedValue({ confirm: 'no' } as any);
      svc.getKeystoreDetailById.mockRejectedValue(new Error('404'));
      await handleKeystoreRemove(command, { keystoreId: 'ks-1' });
      expect(console.warn).toHaveBeenCalledWith('\nWarning: Could not fetch keystore details. Using ID in confirmation.');
      expect(promptMessage()).toContain('delete the Keystore "ks-1"?');
    });

    it('marks the spinner failed when the removal fails', async () => {
      vi.mocked(enquirer.prompt).mockResolvedValue({ confirm: 'yes' } as any);
      svc.getKeystoreDetailById.mockResolvedValue({ name: 'Release' });
      svc.removeKeystore.mockRejectedValue(new Error('locked'));
      await expect(handleKeystoreRemove(command, { keystoreId: 'ks-1' })).rejects.toThrow('locked');
      expect(svc.removeKeystore).toHaveBeenCalledWith({ keystoreId: 'ks-1' });
      expect(lastSpinner().fail).toHaveBeenCalledWith('Remove failed');
    });
  });

  describe('handleProvisioningProfileRemove', () => {
    const command = cmd('signing-identity-provisioning-profile-remove');

    it.each([
      ['the profile id when no details are returned', null, 'pp-1'],
      ['the file name when there is no name', { filename: 'dev.mobileprovision', id: 'x' }, 'dev.mobileprovision'],
      ['the detail id when there is no name or file name', { id: 'detail-id' }, 'detail-id'],
    ])('confirms with %s', async (_label, detail, expected) => {
      vi.mocked(enquirer.prompt).mockResolvedValue({ confirm: 'no' } as any);
      svc.getProvisioningProfileDetailById.mockResolvedValue(detail);
      await handleProvisioningProfileRemove(command, { provisioningProfileId: 'pp-1' });
      expect(promptMessage()).toContain(`delete the Provisioning Profile "${expected}"?`);
      expect(console.log).toHaveBeenCalledWith('Provisioning Profile deletion cancelled.');
    });

    it('warns when the details cannot be fetched', async () => {
      vi.mocked(enquirer.prompt).mockResolvedValue({ confirm: 'no' } as any);
      svc.getProvisioningProfileDetailById.mockRejectedValue(new Error('404'));
      await handleProvisioningProfileRemove(command, { provisioningProfileId: 'pp-1' });
      expect(console.warn).toHaveBeenCalledWith(
        '\nWarning: Could not fetch provisioning profile details. Using ID in confirmation.',
      );
      expect(promptMessage()).toContain('delete the Provisioning Profile "pp-1"?');
    });

    it('marks the spinner failed when the removal fails', async () => {
      vi.mocked(enquirer.prompt).mockResolvedValue({ confirm: 'yes' } as any);
      svc.getProvisioningProfileDetailById.mockResolvedValue({ name: 'Dev' });
      svc.removeProvisioningProfile.mockRejectedValue(new Error('in use'));
      await expect(handleProvisioningProfileRemove(command, { provisioningProfileId: 'pp-1' })).rejects.toThrow('in use');
      expect(svc.removeProvisioningProfile).toHaveBeenCalledWith({ provisioningProfileId: 'pp-1' });
      expect(lastSpinner().fail).toHaveBeenCalledWith('Remove failed');
    });
  });
});

describe('handleOrganizationCommand', () => {
  const orgs = [
    { id: 'org-1', name: 'Main' },
    { id: 'org-2', name: 'Sub' },
  ];

  it.each([['all'], ['current']])(
    'resolves the organization name when organizationId is "%s"',
    async (organizationId) => {
      svc.getOrganizations.mockResolvedValue(orgs);
      svc.getOrganizationDetail.mockResolvedValue({ id: 'org-2', name: 'Sub' });
      const params: any = { organization: 'Sub', organizationId };
      await handleOrganizationCommand(cmd('organization-view'), params);
      expect(params.organizationId).toBe('org-2');
      expect(svc.getUserInfo).not.toHaveBeenCalled();
      expect(svc.getOrganizationDetail).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 'org-2' }));
      expect(commandWriter).toHaveBeenCalledWith(CommandTypes.ORGANIZATION, {
        fullCommandName: 'appcircle-organization-view',
        data: { id: 'org-2', name: 'Sub' },
      });
    },
  );

  it('requires --userId or --user for role commands and prints the command help', async () => {
    const organization: any = Commands.find((c) => c.command === CommandTypes.ORGANIZATION);
    const role = organization.subCommands.find((c: any) => c.command === 'role');
    const view = role.subCommands.find((c: any) => c.command === 'view');
    await expect(handleOrganizationCommand(cmd('organization-role-view'), { organizationId: 'org-1' })).rejects.toThrow(
      new ProgramError('You must provide either --userId or --user parameter for this command.'),
    );
    expect(console.log).toHaveBeenCalledWith(view.longDescription || view.description);
  });

  it('resolves --user to a user id for role commands', async () => {
    svc.getOrganizationUsersWithRoles.mockResolvedValue([
      { id: 'u-1', email: 'a@example.com', fullName: 'A' },
      { id: 'u-2', email: 'b@example.com', fullName: 'B' },
    ]);
    svc.getOrganizationUserinfo.mockResolvedValue({ roles: ['owner'], inheritedRoles: [] });
    const params: any = { organizationId: 'org-1', user: 'B' };
    await handleOrganizationCommand(cmd('organization-role-view'), params);
    expect(svc.getOrganizationUsersWithRoles).toHaveBeenCalledWith({ organizationId: 'org-1' });
    expect(params.userId).toBe('u-2');
    expect(svc.getOrganizationUserinfo).toHaveBeenCalledWith({ organizationId: 'org-1', userId: 'u-2' });
  });

  it('keeps an explicit --userId even when --user is given', async () => {
    svc.getOrganizationUserinfo.mockResolvedValue({ roles: [], inheritedRoles: [] });
    const params: any = { organizationId: 'org-1', user: 'B', userId: 'u-9' };
    await handleOrganizationCommand(cmd('organization-role-view'), params);
    expect(svc.getOrganizationUsersWithRoles).not.toHaveBeenCalled();
    expect(svc.getOrganizationUserinfo).toHaveBeenCalledWith({ organizationId: 'org-1', userId: 'u-9' });
  });
});
