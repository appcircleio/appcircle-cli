/**
 * @fileoverview Utility functions for writer.ts to improve testability
 * Extracted utilities from writer.ts for table formatting, data transformation, and command-specific output
 */

import moment from 'moment';
import { 
  AuthenticationTypes, 
  OperatingSystems, 
  PlatformTypes, 
  PublishTypes, 
  BuildStatus, 
  QueueItemStatus, 
  IOSCertificateStoreTypes 
} from '../constant';

/**
 * Data transformation utilities
 */

/**
 * Formats date using moment.js with fallback
 * @param date Date string or null/undefined
 * @param fallback Fallback text when date is invalid
 * @returns Formatted date string
 */
export const formatDate = (date?: string | null, fallback: string = '-'): string => {
  if (!date) return fallback;
  try {
    const momentDate = moment(date);
    return momentDate.isValid() ? momentDate.calendar() : fallback;
  } catch (error) {
    return fallback;
  }
};

/**
 * Formats date as relative time (fromNow)
 * @param date Date string or null/undefined
 * @param fallback Fallback text when date is invalid
 * @returns Relative time string
 */
export const formatRelativeDate = (date?: string | null, fallback: string = '-'): string => {
  if (!date) return fallback;
  try {
    const momentDate = moment(date);
    return momentDate.isValid() ? momentDate.fromNow() : fallback;
  } catch (error) {
    return fallback;
  }
};

/**
 * Formats duration in human-readable format
 * @param duration Duration string or number
 * @returns Formatted duration string
 */
export const formatDuration = (duration?: string | number): string => {
  if (!duration) return '-';
  
  try {
    const parsedDuration = moment.duration(duration);
    const hours = parsedDuration.hours() !== 0 ? `${parsedDuration.hours()} hours ` : '';
    const minutes = parsedDuration.minutes() !== 0 ? `${parsedDuration.minutes()} minutes ` : '';
    const seconds = parsedDuration.seconds() !== 0 ? `${parsedDuration.seconds()} seconds ` : '';
    
    const result = `${hours}${minutes}${seconds}`.trim();
    return result || '-';
  } catch (error) {
    return '-';
  }
};

/**
 * Formats file size in MB
 * @param bytes File size in bytes
 * @param decimals Number of decimal places
 * @returns Formatted file size string
 */
export const formatFileSize = (bytes?: number, decimals: number = 2): string => {
  if (!bytes || bytes <= 0) return '-';
  return `${(bytes / 1000000).toFixed(decimals)} MB`;
};

/**
 * Converts boolean to Yes/No string
 * @param value Boolean value
 * @param fallback Fallback for null/undefined
 * @returns Yes/No string
 */
export const formatBoolean = (value?: boolean | null, fallback: string = '-'): string => {
  if (value === null || value === undefined) return fallback;
  return value ? 'Yes' : 'No';
};

/**
 * Formats enabled/disabled status
 * @param value Boolean or number value
 * @param enabledText Text for enabled state
 * @param disabledText Text for disabled state
 * @returns Status string
 */
export const formatEnabledStatus = (
  value?: boolean | number | null,
  enabledText: string = 'Enabled',
  disabledText: string = 'Disabled'
): string => {
  if (value === null || value === undefined) return disabledText;
  if (typeof value === 'boolean') return value ? enabledText : disabledText;
  if (typeof value === 'number') return value > 0 ? enabledText : disabledText;
  return disabledText;
};

/**
 * Enum mapping utilities
 */

/**
 * Maps enum value to string with fallback
 * @param enumObject Enum object to map from
 * @param value Enum value
 * @param fallback Fallback text
 * @returns Mapped enum string
 */
export const mapEnumValue = (enumObject: any, value?: string | number | null, fallback: string = '-'): string => {
  if (value === null || value === undefined) return fallback;
  const mappedValue = enumObject[String(value)];
  return mappedValue || fallback;
};

/**
 * Maps authentication type enum
 * @param type Authentication type value
 * @returns Mapped authentication type string
 */
export const mapAuthenticationType = (type?: string | number): string => {
  return mapEnumValue(AuthenticationTypes, type);
};

/**
 * Maps operating system enum
 * @param os Operating system value
 * @returns Mapped OS string
 */
export const mapOperatingSystem = (os?: string | number): string => {
  return mapEnumValue(OperatingSystems, os);
};

/**
 * Maps platform type enum
 * @param platform Platform type value
 * @returns Mapped platform string
 */
export const mapPlatformType = (platform?: string | number): string => {
  return mapEnumValue(PlatformTypes, platform);
};

/**
 * Maps publish type enum
 * @param type Publish type value
 * @returns Mapped publish type string
 */
export const mapPublishType = (type?: string | number): string => {
  return mapEnumValue(PublishTypes, type);
};

/**
 * Maps build status enum
 * @param status Build status value
 * @returns Mapped build status string
 */
export const mapBuildStatus = (status?: string | number): string => {
  return mapEnumValue(BuildStatus, status, 'No previous builds');
};

/**
 * Maps queue item status enum
 * @param status Queue status value
 * @returns Mapped queue status string
 */
export const mapQueueItemStatus = (status?: string | number): string => {
  return mapEnumValue(QueueItemStatus, status);
};

/**
 * Maps iOS certificate store type enum
 * @param type Store type value
 * @returns Mapped store type string
 */
export const mapCertificateStoreType = (type?: string | number): string => {
  return mapEnumValue(IOSCertificateStoreTypes, type);
};

/**
 * Data validation and transformation utilities
 */

/**
 * Safely accesses nested object properties
 * @param obj Object to access
 * @param path Property path (e.g., 'item1.id')
 * @param fallback Fallback value
 * @returns Property value or fallback
 */
export const safeGet = (obj: any, path: string, fallback: any = '-'): any => {
  if (!obj || !path) return fallback;
  
  const keys = path.split('.');
  let current = obj;
  
  for (const key of keys) {
    if (current === null || current === undefined || !(key in current)) {
      return fallback;
    }
    current = current[key];
  }
  
  return current === null || current === undefined ? fallback : current;
};

/**
 * Validates and formats array data for table display
 * @param data Array data
 * @param emptyMessage Message for empty arrays
 * @returns Validation result
 */
export const validateTableData = (
  data?: any[],
  emptyMessage: string = 'No data available.'
): { isValid: boolean; data: any[]; message?: string } => {
  if (!Array.isArray(data)) {
    return { isValid: false, data: [], message: emptyMessage };
  }
  
  if (data.length === 0) {
    return { isValid: false, data: [], message: emptyMessage };
  }
  
  return { isValid: true, data };
};

/**
 * Formats version string with version code
 * @param version Version string
 * @param versionCode Version code
 * @param appName App name
 * @returns Formatted version string
 */
export const formatVersionString = (version?: string, versionCode?: string, appName?: string): string => {
  const versionPart = version || '-';
  const codePart = versionCode || '-';
  const namePart = appName || '-';
  return `${versionPart}(${codePart}) - ${namePart}`;
};

/**
 * Formats auto-distribute count status
 * @param count Auto distribute count
 * @returns Formatted status string
 */
export const formatAutoDistributeStatus = (count?: number): string => {
  if (!count || count === 0) return 'Disabled';
  return `Enabled in ${count} branch(es)`;
};

/**
 * Formats auto-send status based on testing group IDs
 * @param testingGroupIds Testing group IDs array
 * @returns Auto-send status string
 */
export const formatAutoSendStatus = (testingGroupIds?: any[]): string => {
  return testingGroupIds && testingGroupIds.length > 0 ? 'Enabled' : 'Disabled';
};

/**
 * Command output utilities
 */

/**
 * Creates console info message
 * @param message Message to display
 */
export const logInfo = (message: string): void => {
  console.info(message);
};

/**
 * Creates console log message
 * @param message Message to display
 */
export const logMessage = (message: string): void => {
  console.log(message);
};

/**
 * Creates console table output
 * @param data Data to display in table
 */
export const logTable = (data: any): void => {
  console.table(data);
};

/**
 * Checks if data should be displayed
 * @param data Data to check
 * @param emptyMessage Message for empty data
 * @returns Whether to display data and message
 */
export const shouldDisplayTable = (
  data?: any[],
  emptyMessage?: string
): { shouldDisplay: boolean; message?: string } => {
  const validation = validateTableData(data, emptyMessage);
  return {
    shouldDisplay: validation.isValid,
    message: validation.message
  };
};

/**
 * Table data transformation utilities
 */

/**
 * Transforms distribution profile data for table display
 * @param profile Distribution profile object
 * @returns Transformed table data
 */
export const transformDistributionProfile = (profile: any) => {
  return {
    'Profile Id': profile.id,
    'Profile Name': profile.name,
    Pinned: profile.pinned,
    'iOS Version': profile.iOSVersion || 'No versions available',
    'Android Version': profile.androidVersion || 'No versions available',
    'Last Updated': formatRelativeDate(profile.updateDate),
    'Last Shared': profile.lastAppVersionSharedDate 
      ? formatRelativeDate(profile.lastAppVersionSharedDate) 
      : 'Not Shared',
    Authentication: mapAuthenticationType(profile.settings?.authenticationType),
    'Auto Send': formatAutoSendStatus(profile.testingGroupIds)
  };
};

/**
 * Transforms build profile data for table display
 * @param profile Build profile object
 * @returns Transformed table data
 */
export const transformBuildProfile = (profile: any) => {
  return {
    'Profile Id': profile.id,
    'Profile Name': profile.name,
    Pinned: profile.pinned,
    'Target OS': mapOperatingSystem(profile.os),
    'Target Platform': mapPlatformType(profile.buildPlatformType),
    Repository: profile.repositoryName || 'No repository connected',
    'Last Build': formatDate(profile.lastBuildDate, 'No previous builds'),
    'Auto Distribute': formatAutoDistributeStatus(profile.autoDistributeCount),
    'Auto Build': formatEnabledStatus(profile.autoBuildCount)
  };
};

/**
 * Transforms branch data for table display
 * @param branch Branch object
 * @returns Transformed table data
 */
export const transformBranch = (branch: any) => {
  return {
    'Branch Id': branch.id,
    'Branch Name': branch.name,
    'Last Build': formatDate(branch.lastBuildDate, 'No previous builds'),
    'Build Status': mapBuildStatus(branch.buildStatus)
  };
};

/**
 * Transforms commit data for table display
 * @param commit Commit object
 * @returns Transformed table data
 */
export const transformCommit = (commit: any) => {
  return {
    'Commit Id': commit.id,
    Hash: commit.hash,
    Date: formatDate(commit.commitDate, 'Could not find date'),
    Author: commit.author || '',
    Message: commit.message || ''
  };
};

/**
 * Transforms build data for table display
 * @param build Build object
 * @returns Transformed table data
 */
export const transformBuild = (build: any) => {
  return {
    'Build Id': build.id,
    Hash: build.hash,
    'Has Warning': !!build.hasWarning,
    Status: build.status,
    'Start Date': formatDate(build.startDate, 'Could not find date'),
    'End Date': formatDate(build.endDate, 'Could not find date')
  };
};

/**
 * Transforms build details for single build view
 * @param build Build object
 * @returns Transformed table data
 */
export const transformBuildDetails = (build: any) => {
  return {
    'Build Id': build.id,
    'Commit Id': build.commitId,
    'Hash': build.hash || '-',
    'Has Warning': !!build.hasWarning,
    'Status': mapBuildStatus(build.status),
    'Duration': formatDuration(build.duration),
    'Is Distributable': build.isDistributable || '-',
    'Start Date': formatDate(build.startDate, 'Could not find date'),
    'End Date': formatDate(build.endDate, 'Could not find date')
  };
};

/**
 * Transforms environment variable data for table display
 * @param variable Environment variable object
 * @returns Transformed table data
 */
export const transformEnvironmentVariable = (variable: any) => {
  return {
    'Key Name': variable.key,
    'Key Value': variable.isSecret ? '********' : variable.value
  };
};

/**
 * Transforms active build data for table display
 * @param build Active build object
 * @returns Transformed table data
 */
export const transformActiveBuild = (build: any) => {
  return {
    'Build Id': build.id,
    'Commit Id': build.commitId,
    'Commit Hash': build.commitHash || '-',
    'Profile Name': build.profileName || '-',
    'Branch Name': build.branchName || '-',
    'Status': mapQueueItemStatus(build.queueItemStatus)
  };
};

/**
 * Organization data transformers
 */

/**
 * Transforms organization data for list view
 * @param organization Organization object
 * @returns Transformed table data
 */
export const transformOrganizationList = (organization: any) => {
  return {
    Name: organization.name,
    Id: organization.id,
    'Given Id': organization.givenId || '-',
    'SSO Enabled': formatBoolean(organization.ssoEnabled),
    Disabled: formatBoolean(organization.disabled),
    'Root Organization': organization.rootOrganizationName || '-',
    'Root Organization Id': organization.rootOrganizationId || '-',
    'Created Date': formatDate(organization.createdDate)
  };
};

/**
 * Transforms organization data for single view
 * @param organization Organization object
 * @returns Transformed table data
 */
export const transformOrganizationDetails = (organization: any) => {
  return {
    Name: organization.name,
    Id: organization.id,
    'Given Id': organization.givenId,
    Members: organization.memberCount || '-',
    SSO: formatBoolean(organization.ssoEnabled),
    'Created': formatDate(organization.createdDate),
    'Root Org.': organization.rootOrganizationName || '-',
    'Root Org. Id': organization.rootOrganizationId || '-',
    'Logo Url': organization.logoUrl || '-'
  };
};

/**
 * Transforms user data for table display
 * @param user User object
 * @returns Transformed table data
 */
export const transformUser = (user: any) => {
  return {
    'User Name': user.username,
    Id: user.id,
    'InRootOrg': formatBoolean(!user.isSubOrganizationMember),
    Email: user.email || '-',
    Roles: user.roles ? user.roles.join(',') : '-'
  };
};

/**
 * Transforms invitation data for table display
 * @param invitation Invitation object
 * @returns Transformed table data
 */
export const transformInvitation = (invitation: any) => {
  return {
    'User Email': invitation.userEmail,
    'Root Organization ID': invitation.rootOrganizationId,
    'InRootOrg': formatBoolean(!invitation.isSubOrganizationMember),
    Roles: safeGet(invitation, 'organizationsAndRoles.0.roles', []).join(',') || '-',
    Status: invitation.status || '-'
  };
};

/**
 * String manipulation utilities
 */

/**
 * Truncates text to specified length
 * @param text Text to truncate
 * @param maxLength Maximum length
 * @param suffix Suffix to add when truncated
 * @returns Truncated text
 */
export const truncateText = (text?: string, maxLength: number = 50, suffix: string = '...'): string => {
  if (!text) return '-';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - suffix.length) + suffix;
};

/**
 * Joins array elements with separator
 * @param arr Array to join
 * @param separator Separator string
 * @param fallback Fallback for empty arrays
 * @returns Joined string
 */
export const joinArray = (arr?: any[], separator: string = ', ', fallback: string = '-'): string => {
  if (!Array.isArray(arr) || arr.length === 0) return fallback;
  return arr.filter(item => item !== null && item !== undefined).join(separator);
};

/**
 * Role processing utilities
 */

/**
 * Processes and sorts roles with inheritance information
 * @param roles Regular roles array
 * @param inheritedRoles Inherited roles array
 * @returns Processed roles with inheritance info
 */
export const processRolesWithInheritance = (roles?: string[], inheritedRoles?: string[]) => {
  if (!roles && !inheritedRoles) {
    return [];
  }
  
  const regularRoles = roles || [];
  const inherited = inheritedRoles || [];
  
  const allRoles = Array.from(new Set([...regularRoles, ...inherited]));
  
  // Sort roles: inherited roles go to the end
  const sortedRoles = allRoles.sort((a, b) => {
    const aIsInherited = inherited.includes(a);
    const bIsInherited = inherited.includes(b);
    
    if (aIsInherited && !bIsInherited) return 1;
    if (!aIsInherited && bIsInherited) return -1;
    return 0;
  });
  
  return sortedRoles.map(role => ({
    Role: role,
    Inheritance: inherited.includes(role) ? 'Inherit' : '-'
  }));
};