import fs from 'fs';
import FormData from 'form-data';
import { OptionsType, appcircleApi, getHeaders } from './api';

export async function getEnterpriseUploadInformation(options: OptionsType<{ fileSize: number; fileName: string; entProfileId?: string }>) {

  const uploadInformationResponse = await appcircleApi.get(`store/v1/profiles/app-versions?action=uploadInformation&fileSize=${options.fileSize}&fileName=${options.fileName}`,{
    headers: {
      ...getHeaders(),
    },
  });
  return uploadInformationResponse.data;
}

export async function commitEnterpriseFileUpload(options: OptionsType<{ fileId: number; fileName: string; entProfileId?: string }>) {

  var createNewProfile = options.entProfileId === undefined;
  const commitFileResponse = await appcircleApi.post(`store/v1/profiles/app-versions?action=commitFileUpload&createNewProfile=${createNewProfile}${options.entProfileId ? `&profileId=${options.entProfileId}`: ''}`,{fileId: options.fileId, fileName: options.fileName},{
    headers: {
      ...getHeaders(),
    },
  });
  return commitFileResponse.data;
}

export async function getEnterpriseProfiles(options: OptionsType = {}) {
    const buildProfiles = await appcircleApi.get(`store/v2/profiles`, {
      headers: getHeaders(),
    });
    return buildProfiles.data;
  }
  
  export async function getEnterpriseAppVersions(options: { entProfileId: string; publishType: string }) {
    let versionType = '';
    switch (options.publishType) {
      case '1':
        versionType = '?publishtype=Beta';
        break;
      case '2':
        versionType = '?publishtype=Live';
      default:
        break;
    }
  
    const profileResponse = await appcircleApi.get(`store/v2/profiles/${options.entProfileId}/app-versions${versionType}`, {
      headers: getHeaders(),
    });
    return profileResponse.data;
  }
  
  export async function publishEnterpriseAppVersion(options: {
    entProfileId: string;
    entVersionId: string;
    summary: string;
    releaseNotes: string;
    publishType: string;
  }) {
    const versionResponse = await appcircleApi.patch(
      `store/v2/profiles/${options.entProfileId}/app-versions/${options.entVersionId}?action=publish`,
      { summary: options.summary, releaseNotes: options.releaseNotes, publishType: options.publishType },
      {
        headers: getHeaders(),
      }
    );
    return versionResponse.data;
  }
  
  export async function unpublishEnterpriseAppVersion(options: OptionsType<{ entProfileId: string; entVersionId: string }>) {
    const versionResponse = await appcircleApi.patch(
      `store/v2/profiles/${options.entProfileId}/app-versions/${options.entVersionId}?action=unpublish`,
      {},
      {
        headers: getHeaders(),
      }
    );
    return versionResponse.data;
  }
  
  export async function removeEnterpriseAppVersion(options: { entProfileId: string; entVersionId: string }) {
    const versionResponse = await appcircleApi.delete(`store/v2/profiles/${options.entProfileId}/app-versions/${options.entVersionId}`, {
      headers: getHeaders(),
    });
    if (versionResponse.data.length === 0) {
      console.info('No app versions available.');
      return;
    }
    return versionResponse.data;
  }
  
  export async function notifyEnterpriseAppVersion(
    options: OptionsType<{ entProfileId: string; entVersionId: string; subject: string; message: string }>
  ) {
    const versionResponse = await appcircleApi.post(
      `store/v2/profiles/${options.entProfileId}/app-versions/${options.entVersionId}?action=notify`,
      { subject: options.subject, message: options.message },
      {
        headers: getHeaders(),
      }
    );
    return versionResponse.data;
  }
  
  export async function uploadEnterpriseAppVersion(options: OptionsType<{ entProfileId: string; app: string }>) {
    const data = new FormData();
    data.append('File', fs.createReadStream(options.app));
  
    const uploadResponse = await appcircleApi.post(`store/v2/profiles/${options.entProfileId}/app-versions`, data, {
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
  
  export async function uploadEnterpriseApp(options: { app: string }) {
    const data = new FormData();
    data.append('File', fs.createReadStream(options.app));
    const uploadResponse = await appcircleApi.post(`store/v2/profiles/app-versions`, data, {
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
  
  export async function getEnterpriseDownloadLink(options: OptionsType<{ entProfileId: string; entVersionId: string }>) {
    const qrcodeStatus = await appcircleApi.get(`store/v2/profiles/${options.entProfileId}/app-versions/${options.entVersionId}?action=download`, {
      headers: getHeaders(),
    });
    return qrcodeStatus.data;
  }