
import fs from 'fs';
import FormData from 'form-data';
import { ProgramError } from '../core/ProgramError';
import { OptionsType, appcircleApi, getHeaders } from './api';

export async function createPublishProfile(options: OptionsType<{ platform: string, name: string }>) {
    const response = await appcircleApi.post(
      `publish/v2/profiles/${options.platform}`,
      { name: options.name },
      { headers: getHeaders() }
    );
    return response.data;
  }
  
  export async function getPublishProfiles(options: OptionsType<{ platform: string }>) {
    const response = await appcircleApi.get(
      `publish/v2/profiles/${options.platform}`,
      { headers: getHeaders() }
    );
    return response.data;
  }

  export async function startExistingPublishFlow(options: OptionsType<{ publishProfileId: string, platform:string, publishId: string }>) {
    const startResponse = await appcircleApi.post(`publish/v2/profiles/${options.platform}/${options.publishProfileId}/publish/${options.publishId}?action=restart`,"{}", 
    {
      headers: getHeaders()
    }
    );
    return startResponse.data;
  }

  export async function getPublishVariableGroups() {

    const response = await appcircleApi.get(`publish/v2/variable-groups`,
    {
      headers: getHeaders()
    }
    );
  
    return response.data;
  }
  export async function getPublishVariableListByGroupId(options: OptionsType<{ publishVariableGroupId: string }>) {
  
    const response = await appcircleApi.get(`publish/v2/variable-groups/${options.publishVariableGroupId}`,
    {
      headers: getHeaders()
    }
    );
  
    return response.data;
  }
  export async function setAppVersionReleaseCandidateStatus(options: OptionsType<{ publishProfileId: string, platform:string, appVersionId: string, releaseCandidate: boolean }>) {
  
    const response = await appcircleApi.patch(`publish/v2/profiles/${options.platform}/${options.publishProfileId}/app-versions/${options.appVersionId}?action=releaseCandidate`,{
      ReleaseCandidate: options.releaseCandidate
    },
    {
      headers: getHeaders()
    }
    );
  
    return response.data;
  }
  
  export async function switchPublishProfileAutoPublishSettings(options: OptionsType<{ publishProfileId: string, platform:string, appVersionId: string, enableAutoPublish: boolean, currentProfileSettings: any }>) {
    const response = await appcircleApi.patch(`publish/v2/profiles/${options.platform}/${options.publishProfileId}`,{
      profileSettings: {...options.currentProfileSettings , whenNewVersionRecieved: options.enableAutoPublish }
    },
    {
      headers: getHeaders()
    }
    );
  
    return response.data;
  }

  export async function uploadAppVersion(options: OptionsType<{ app: string; publishProfileId: string, platform:string }>) {
    const data = new FormData();
    data.append('File', fs.createReadStream(options.app));
  
    const uploadResponse = await appcircleApi.post(`publish/v2/profiles/${options.platform}/${options.publishProfileId}/app-versions`, data, {
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      headers: {
        ...getHeaders(),
        ...data.getHeaders(),
        'Content-Type': 'multipart/form-data;boundary=' + data.getBoundary(),
      },
    });
    return uploadResponse.data;
  }
  export async function getAppVersions(options: OptionsType<{ publishProfileId: string, platform:string }>) {
    const appVersions = await appcircleApi.get(`publish/v2/profiles/${options.platform}/${options.publishProfileId}/app-versions`, {
      headers: getHeaders(),
    });
    return appVersions.data;
  }
  export async function getPublishByAppVersion(options: OptionsType<{ publishProfileId: string, platform:string,appVersionId: string }>) {
    const publish = await appcircleApi.get(`publish/v2/profiles/${options.platform}/${options.publishProfileId}/app-versions/${options.appVersionId}/publish`, {
      headers: getHeaders(),
    });
    return publish.data;
  }
  export async function deleteAppVersion(options: OptionsType<{ publishProfileId: string, platform:string, appVersionId: string }>) {
    const appVersions = await appcircleApi.delete(`publish/v2/profiles/${options.platform}/${options.publishProfileId}/app-versions/${options.appVersionId}`, {
      headers: getHeaders(),
    });
    return appVersions.data;
  }
  export async function getAppVersionDownloadLink(options: OptionsType<{ publishProfileId: string, platform:string, appVersionId: string }>) {
  
    const downloadResponse = await appcircleApi.get(`publish/v2/profiles/${options.platform}/${options.publishProfileId}/app-versions/${options.appVersionId}?action=download`, 
    {
      headers: getHeaders()
    }
    );
  
    return downloadResponse.data;
  }
  export async function getPublishProfileDetailById(options: OptionsType<{ publishProfileId: string, platform:string }>) {
  
    const response = await appcircleApi.get(`publish/v2/profiles/${options.platform}/${options.publishProfileId}`, 
    {
      headers: getHeaders()
    }
    );
  
    return response.data;
  }
  
  