import qs from 'querystring';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import axios from 'axios';
import moment from 'moment';
import { CountriesList, EnvironmentVariableTypes } from '../constant';
import { AUTH_HOSTNAME, OptionsType, appcircleApi, getHeaders } from './api';
import { ProgramError } from '../core/ProgramError';

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
