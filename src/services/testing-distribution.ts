import qs from 'querystring';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import axios from 'axios';
import moment from 'moment';
import { CountriesList, EnvironmentVariableTypes } from '../constant';
import { AUTH_HOSTNAME, OptionsType, appcircleApi, getHeaders } from './api';
import { ProgramError } from '../core/ProgramError';
import { FileUploadInformation } from '../types/file-upload';

export async function getDistributionProfiles(options: OptionsType = {}) {
    const distributionProfiles = await appcircleApi.get(`distribution/v2/profiles`, {
      headers: getHeaders(),
    });
    return distributionProfiles.data;
}

export async function getDistributionProfileById(options: OptionsType<{ distProfileId: string }>) {
    const distributionProfile = await appcircleApi.get(`distribution/v2/profiles/${options.distProfileId}`, {
      headers: getHeaders(),
    });
    return distributionProfile.data;
}

export async function getLatestAppVersionId(options: OptionsType<{ distProfileId: string }>) {
    const profile = await getDistributionProfileById(options);
    if (profile && profile.appVersions && profile.appVersions.length > 0) {
        const sortedVersions = [...profile.appVersions].sort((a: any, b: any) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        return sortedVersions[0].id;
    }
    return null;
}

// New function to get the latest app version ID with a minimum wait for new uploads
export async function getLatestAppVersionIdAfterUpload(options: OptionsType<{ distProfileId: string; expectedFileSize?: number; fileName?: string }>) {
    // Give some time for the new version to appear in the API
    await new Promise(resolve => setTimeout(resolve, 3000));

    const profile = await getDistributionProfileById(options);
    if (profile && profile.appVersions && profile.appVersions.length > 0) {
        // Sort by creation time, newest first
        const sortedVersions = [...profile.appVersions].sort((a: any, b: any) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        // If we have expected file size or name, try to match the most recent version
        if (options.expectedFileSize || options.fileName) {
            for (const version of sortedVersions) {
                const isRecentlyCreated = new Date().getTime() - new Date(version.createdAt).getTime() < 30000; // Within 30 seconds

                if (isRecentlyCreated) {
                    // Additional checks can be added here if needed
                    if (options.expectedFileSize && version.size && Math.abs(version.size - options.expectedFileSize) < 1000) {
                        return version.id;
                    }
                    if (options.fileName && version.fileName && version.fileName.includes(options.fileName)) {
                        return version.id;
                    }
                    // If no specific matching criteria, return the most recent one
                    if (!options.expectedFileSize && !options.fileName) {
                        return version.id;
                    }
                }
            }
        }

        // Fallback to most recent version
        return sortedVersions[0].id;
    }
    return null;
}

export async function updateDistributionProfileSettings(options: OptionsType<{ testingGroupIds: string[]; distProfileId: string }>) {
    const { testingGroupIds, distProfileId } = options;
    const distributionProfile = await appcircleApi.patch(`distribution/v2/profiles/${distProfileId}`, {testingGroupIds}, {
      headers: getHeaders(),
    });
    return distributionProfile.data;
}
export async function createDistributionProfile(options: OptionsType<{ name: string }>) {
    const response = await appcircleApi.post(
      `distribution/v1/profiles`,
      { name: options.name },
      {
        headers: getHeaders(),
      }
    );
    return response.data;
}

export async function getTestingGroups() {
    const response = await appcircleApi.get(`distribution/v2/testing-groups`, {
      headers: getHeaders(),
    });
    return response.data;
}

export async function getTestingGroupById(options: OptionsType<{ testingGroupId: string }>) {
    const response = await appcircleApi.get(`distribution/v2/testing-groups/${options.testingGroupId}`, {
      headers: getHeaders(),
    });
    return response.data;
}
export async function createTestingGroup(options: OptionsType<{ name: string }>) {
    const {name} = options; 
    const response = await appcircleApi.post(`distribution/v2/testing-groups`, { name }, {
      headers: getHeaders(),
    });
    return response.data;
}

export async function deleteTestingGroup(options: OptionsType<{ testingGroupId: string }>) {
    const response = await appcircleApi.delete(`distribution/v2/testing-groups/${options.testingGroupId}`, {
        headers: getHeaders(),
      });
      return response.data;
}

export async function addTesterToTestingGroup(options: OptionsType<{ testerEmail: string,testingGroupId: string }>) {
    const response = await appcircleApi.post(`distribution/v2/testing-groups/${options.testingGroupId}/testers`,[options.testerEmail], {
        headers: getHeaders(),
      });
      return response.data;
}

export async function removeTesterFromTestingGroup(options: OptionsType<{ testerEmail: string, testingGroupId: string }>) {
    const response = await appcircleApi.delete(`distribution/v2/testing-groups/${options.testingGroupId}/testers`, {
        headers: getHeaders(),
        data: [options.testerEmail]
      },
      );
      return response.data;
}

export async function getTestingDistributionUploadInformation(
  options: OptionsType<{ fileSize: number; fileName: string; distProfileId: string }>
): Promise<FileUploadInformation> {
  const res = await appcircleApi.get<FileUploadInformation>(
    `distribution/v1/profiles/${options.distProfileId}/app-versions` +
      `?action=uploadInformation&fileSize=${options.fileSize}&fileName=${options.fileName}`,
    { headers: getHeaders() }
  );
  return res.data;
}

export async function commitTestingDistributionFileUpload(options: OptionsType<{ fileId: string; fileName: string; distProfileId: string }>) {

  const commitFileResponse = await appcircleApi.post(`distribution/v1/profiles/${options.distProfileId}/app-versions?action=commitFileUpload`,{fileId: options.fileId, fileName: options.fileName},{
    headers: {
      ...getHeaders(),
    },
  });
  return commitFileResponse.data;
}

export async function updateTestingDistributionReleaseNotes(options: OptionsType<{ distProfileId: string; versionId: string; message: string }>) {
  const response = await appcircleApi.patch(
    `distribution/v1/profiles/${options.distProfileId}/app-versions/${options.versionId}?action=updateMessage`,
    { message: options.message },
    {
      headers: {
        ...getHeaders(),
      },
    }
  );
  return response.data;
}