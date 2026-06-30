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

// New function to get app version after upload using task completion and time-based filtering
// This is the most reliable method: waits for task completion and filters versions created after upload start time
export async function getAppVersionAfterUploadWithTaskCompletion(options: {
    distProfileId: string;
    taskId: string;
    uploadStartTime: number; // Upload başlama zamanı (ms)
    expectedFileSize?: number;
    fileName?: string;
    waitForTaskCompletion: (taskId: string) => Promise<void>;
}): Promise<string | null> {
    await options.waitForTaskCompletion(options.taskId);
    
    // Helper function to get and filter versions
    const getVersionsAfterUpload = (profileData: any) => {
        if (!profileData || !profileData.appVersions || profileData.appVersions.length === 0) {
            return [];
        }
        return profileData.appVersions.filter((version: any) => {
            if (!version.createdAt) return false;
            const versionCreatedTime = new Date(version.createdAt).getTime();
            return versionCreatedTime >= options.uploadStartTime;
        });
    };
    
    // First attempt: get profile and filter versions
    const profile = await getDistributionProfileById({ 
        distProfileId: options.distProfileId 
    });
    
    let versionsAfterUpload = getVersionsAfterUpload(profile);
    
    // If no versions found after upload, retry once (backend might need more time)
    if (versionsAfterUpload.length === 0) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const profileRetry = await getDistributionProfileById({ 
            distProfileId: options.distProfileId 
        });
        versionsAfterUpload = getVersionsAfterUpload(profileRetry);
    }
    
    const matchingVersions = versionsAfterUpload.filter((version: any) => {
        let matchesSize = true;
        let matchesFileName = true;
        
        if (options.expectedFileSize && version.size) {
            const sizeDiff = Math.abs(version.size - options.expectedFileSize);
            matchesSize = sizeDiff < 500; // 500 byte tolerans
        }
        
        if (options.fileName && version.fileName) {
            const fileNameLower = options.fileName.toLowerCase();
            const versionFileNameLower = version.fileName.toLowerCase();
            matchesFileName = fileNameLower === versionFileNameLower;
        }
        
        return matchesSize && matchesFileName;
    });
    
    if (matchingVersions.length > 0) {
        const sorted = matchingVersions.sort((a: any, b: any) => {
            const timeA = new Date(a.createdAt).getTime();
            const timeB = new Date(b.createdAt).getTime();
            return timeB - timeA; // En yeni önce
        });
        return sorted[0].id;
    }
    
    if (versionsAfterUpload.length > 0) {
        const sorted = versionsAfterUpload.sort((a: any, b: any) => {
            const timeA = new Date(a.createdAt).getTime();
            const timeB = new Date(b.createdAt).getTime();
            return timeB - timeA;
        });
        return sorted[0].id;
    }
    
    return null;
}

// New function to get the latest app version ID with a minimum wait for new uploads
export async function getLatestAppVersionIdAfterUpload(options: OptionsType<{ distProfileId: string; expectedFileSize?: number; fileName?: string; isAab?: boolean }>) {
    // AAB files need more processing time, so wait longer
    const waitTime = options.isAab ? 8000 : 3000; // 8 seconds for AAB, 3 seconds for others
    await new Promise(resolve => setTimeout(resolve, waitTime));

    const profile = await getDistributionProfileById(options);
    
    if (profile && profile.appVersions && profile.appVersions.length > 0) {
        // Sort by creation time, newest first
        const sortedVersions = [...profile.appVersions].sort((a: any, b: any) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        // Use a stricter time window to ensure we only match very recent uploads
        // This prevents matching older uploads when multiple uploads happen quickly
        const strictWindow = options.isAab ? 20000 : 15000; // 20 seconds for AAB, 15 seconds for others (reduced from 30)
        const currentTime = new Date().getTime();

        // Collect all potential matches first, then return the absolute newest one
        const potentialMatches: Array<{ version: any; score: number; createdAt: number }> = [];

        // If we have expected file size or name, try to match versions
        if (options.expectedFileSize || options.fileName) {
            for (const version of sortedVersions) {
                const versionCreatedTime = new Date(version.createdAt).getTime();
                const ageMs = currentTime - versionCreatedTime;
                const isVeryRecentlyCreated = ageMs < strictWindow;

                // Only consider versions created very recently
                if (!isVeryRecentlyCreated) {
                    continue;
                }

                let matchesSize = false;
                let matchesFileName = false;
                let score = 0; // Higher score = better match
                
                // Check file size match (within 500 bytes tolerance - stricter than before)
                if (options.expectedFileSize && version.size) {
                    const sizeDiff = Math.abs(version.size - options.expectedFileSize);
                    if (sizeDiff < 500) {
                        matchesSize = true;
                        score += 10; // Size match adds to score
                        // Exact size match gets higher score
                        if (sizeDiff === 0) {
                            score += 5;
                        }
                    }
                } else if (!options.expectedFileSize) {
                    matchesSize = true; // No size requirement
                }
                
                // Check filename match
                if (options.fileName && version.fileName) {
                    const fileNameLower = options.fileName.toLowerCase();
                    const versionFileNameLower = version.fileName.toLowerCase();
                    
                    // Exact match gets highest score
                    if (versionFileNameLower === fileNameLower) {
                        matchesFileName = true;
                        score += 20; // Exact filename match
                    } else if (versionFileNameLower.includes(fileNameLower) || fileNameLower.includes(versionFileNameLower)) {
                        matchesFileName = true;
                        score += 10; // Partial filename match
                    } else if (options.isAab) {
                        // For AAB files, try matching base name (without extension)
                        const baseName = path.parse(options.fileName).name.toLowerCase();
                        const versionBaseName = path.parse(version.fileName).name.toLowerCase();
                        if (versionBaseName === baseName) {
                            matchesFileName = true;
                            score += 15; // Exact base name match
                        } else if (versionBaseName.includes(baseName) || baseName.includes(versionBaseName)) {
                            matchesFileName = true;
                            score += 8; // Partial base name match
                        }
                    }
                } else if (!options.fileName) {
                    matchesFileName = true; // No filename requirement
                }
                
                // If we have both size and filename, require both to match for highest confidence
                if (options.expectedFileSize && options.fileName) {
                    if (matchesSize && matchesFileName) {
                        // Add bonus for being very recent (newer = higher score)
                        score += Math.max(0, 100 - Math.floor(ageMs / 100)); // Up to 100 points for recency
                        potentialMatches.push({ version, score, createdAt: versionCreatedTime });
                    }
                } else if (matchesSize || matchesFileName) {
                    // If we only have one criterion, match on that but with lower priority
                    score += Math.max(0, 50 - Math.floor(ageMs / 200)); // Up to 50 points for recency
                    potentialMatches.push({ version, score, createdAt: versionCreatedTime });
                }
            }
            
            // If we found matches, return the one with highest score (which will be the newest with best match)
            if (potentialMatches.length > 0) {
                // Sort by score (descending), then by creation time (newest first) as tiebreaker
                potentialMatches.sort((a, b) => {
                    if (b.score !== a.score) {
                        return b.score - a.score;
                    }
                    return b.createdAt - a.createdAt; // Newer first
                });
                
                return potentialMatches[0].version.id;
            }
        }

        // Fallback: only return most recent version if it was created very recently (within strict window)
        // This prevents updating release notes for an old app
        const fallbackWindow = options.isAab ? 20000 : 15000; // Same window as above
        const mostRecentVersion = sortedVersions[0];
        if (mostRecentVersion && mostRecentVersion.createdAt) {
            const versionCreatedTime = new Date(mostRecentVersion.createdAt).getTime();
            const ageMs = currentTime - versionCreatedTime;
            const isVeryRecentlyCreated = ageMs < fallbackWindow;
            if (isVeryRecentlyCreated) {
                return mostRecentVersion.id;
            }
        }
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

export async function commitTestingDistributionFileUpload(options: OptionsType<{ fileId: string; fileName: string; distProfileId: string; customTag?: string; message?: string }>) {
  const requestBody: { fileId: string; fileName: string; customTag?: string; message?: string } = {
    fileId: options.fileId,
    fileName: options.fileName,
  };
  
  if (options.customTag !== undefined && options.customTag !== null) {
    requestBody.customTag = options.customTag;
  }
  
  if (options.message !== undefined && options.message !== null) {
    requestBody.message = options.message;
  }

  const commitFileResponse = await appcircleApi.post(`distribution/v1/profiles/${options.distProfileId}/app-versions?action=commitFileUpload`, requestBody, {
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