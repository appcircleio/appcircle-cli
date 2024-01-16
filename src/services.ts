import https from 'https';
import qs from 'querystring';
import fs from 'fs';
import FormData from 'form-data';
import axios, { AxiosRequestConfig } from 'axios';
import moment from 'moment';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import os from 'os';
import CurlHelper from './curlhelper';
import { readVariable, writeVariable, EnvironmentVariables } from './data';

if (process.env.CURL_LOGGING) {
    axios.interceptors.request.use((config) => {
        const data = new CurlHelper(config);
        let curl = data.generateCommand();
        console.log(chalk.green(curl));
        return config;
    });
}

const API_HOSTNAME = readVariable(EnvironmentVariables.API_HOSTNAME);
const AUTH_HOSTNAME = readVariable(EnvironmentVariables.AUTH_HOSTNAME);

const BuildStatus = {
    "0": "Success",
    "1": "Failed",
    "2": "Canceled",
    "3": "Timeout",
    "90": "Waiting",
    "91": "Running",
    "92": "Completing",
    "99": "Unknown"
};
const AuthenticationTypes = {
    1: "None",
    2: "Individual Enrollment",
    3: "Static Username and Password"
};
const OperatingSystems = {
    0: 'None',
    1: 'iOS',
    2: 'Android'
};
const PlatformTypes = {
    0: "None",
    1: "Swift/Objective-C",
    2: "Java/Kotlin",
    3: "Smartface",
    4: "React Native",
    5: "Xamarin",
    6: "Flutter"
};
const PublishTypes = {
    0: "None",
    1: "Beta",
    2: "Live"
};
const EnvironmentVariableTypes = {
    TEXT: 'text',
    FILE: 'file'
};

function getHeaders(withToken = true): AxiosRequestConfig['headers'] {
    let response: AxiosRequestConfig['headers'] = {
        accept: "application/json",
        "User-Agent": "Appcircle CLI/1.0.3"
    }
    if (withToken) {
        response.Authorization = `Bearer ${readVariable(EnvironmentVariables.AC_ACCESS_TOKEN)}`
    }
    return response;
}

export async function getToken(options: { pat: string }) {
    try {
        const response = await axios.post(`${AUTH_HOSTNAME}/auth/v1/token`, qs.stringify(options), {
            headers: {
                "accept": "application/json",
                "content-type": "application/x-www-form-urlencoded"
            }
        });
        if (response.data.access_token) {
            writeVariable(EnvironmentVariables.AC_ACCESS_TOKEN, response.data.access_token);
            console.log(chalk.italic(`export AC_ACCESS_TOKEN="${response.data.access_token}"\n`));
            console.info(chalk.green(`Login is successful. If you keep getting 401 error, execute the command above to set your token manually to your environment variable`));
        } else {
            console.error(`An error occurred during login.\nDetails: ${JSON.stringify(response)}`);
        }
        return response.data;
    }
    catch (error) {
        handleError(error);
    }
}

export async function getDistributionProfiles(options: { }) {
    try {
        const distributionProfiles = await axios.get(`${API_HOSTNAME}/distribution/v2/profiles`,
            {
                headers: getHeaders()
            });

        if (distributionProfiles.data.length === 0) {
            console.info('No distribution profiles available.');
            return;
        }

        console.table(distributionProfiles.data
            .map((distributionProfile: any) => ({
                'Profile Id': distributionProfile.id,
                'Profile Name': distributionProfile.name,
                'Pinned': distributionProfile.pinned,
                'iOS Version': distributionProfile.iOSVersion ? distributionProfile.iOSVersion : 'No versions available',
                'Android Version': distributionProfile.androidVersion ? distributionProfile.androidVersion : 'No versions available',
                'Last Updated': moment(distributionProfile.updateDate).fromNow(),
                'Last Shared': distributionProfile.lastAppVersionSharedDate ?
                    moment(distributionProfile.lastAppVersionSharedDate).fromNow() : 'Not Shared',
                'Authentication': (AuthenticationTypes as any)[distributionProfile.settings.authenticationType],
                'Auto Send': distributionProfile.testingGroupIds ? 'Enabled' : 'Disabled'
            }))
        );

        return distributionProfiles.data
    } catch (error) {
        handleError(error);
    }
}

export async function createDistributionProfile(options: { name: string }) {
    try {
        await axios.post(`${API_HOSTNAME}/distribution/v1/profiles`,
            { name: options.name },
            {
                headers: getHeaders()
            }
        );
        console.info(`\n${options.name} distribution profile created successfully!`);
    } catch (error) {
        handleError(error);
    }
}

export async function getTestingGroups(options: { }) {
    try {
        const response = await axios.get(`${API_HOSTNAME}/distribution/v2/testing-groups`, {
            headers: getHeaders()
        });
        console.table(response.data
            .map((testingGroup: any) => ({
                'ID': testingGroup.id,
                'Name': testingGroup.name,
                'Organization ID': testingGroup.organizationId,
                'Created': testingGroup.createDate ? moment(testingGroup.createDate).calendar() : 'No created data',
                'Last Updated': testingGroup.createDate ? moment(testingGroup.createDate).fromNow() : 'No update data',
            }))
        );
        return response.data;
    }
    catch (error) {
        handleError(error);
    }
}

export async function getBuildProfiles(options: { }) {
    try {
        const buildProfiles = await axios.get(`${API_HOSTNAME}/build/v2/profiles`,
            {
                headers: getHeaders()
            });

        if (buildProfiles.data.length === 0) {
            console.info('No build profiles available.');
            return;
        }

        console.table(buildProfiles.data
            .map((buildProfile: any) => ({
                'Profile Id': buildProfile.id,
                'Profile Name': buildProfile.name,
                'Pinned': buildProfile.pinned,
                'Target OS': (OperatingSystems as any)[buildProfile.os],
                'Target Platform': (PlatformTypes as any)[buildProfile.buildPlatformType],
                'Repository': buildProfile.repositoryName ? buildProfile.repositoryName : 'No repository connected',
                'Last Build': buildProfile.lastBuildDate ? moment(buildProfile.lastBuildDate).calendar() : 'No previous builds',
                'Auto Distribute': buildProfile.autoDistributeCount === 0 ? 'Disabled' : `Enabled in ${buildProfile.autoDistributeCount} branch(es)`,
                'Auto Build': buildProfile.autoBuildCount === 0 ? 'Disabled' : 'Enabled'
            }))
        );
        return buildProfiles.data;
    } catch (error) {
        handleError(error);
    }
}

export async function getCommits(options: { branchId: string }) {
    try {
        const commits = await axios.get(`${API_HOSTNAME}/build/v2/commits?branchId=${options.branchId}`, {
            headers: getHeaders()
        });
        if (commits.data.length === 0) {
            console.info('No commits available.');
            return;
        }

        console.table(commits.data
            .map((commit: any) => ({
                'Commit Id': commit.id,
                'Hash': commit.hash,
                'Date': commit.commitDate ? moment(commit.commitDate).calendar() : 'Could not find date',
                'Author': commit.author || '',
                'Message': commit.message || ''
            }))
        );
        return commits.data;
    }
    catch (error) {
        handleError(error);
    }
}

export async function getBuildsOfCommit(options: { commitId: string }) {
    try {
      const commits = await axios.get(
        `${API_HOSTNAME}/build/v2/commits/${options.commitId}`,
        {
          headers: getHeaders(),
        }
      );
      if (commits.data.builds.length === 0) {
        console.info("No builds available.");
        return;
      }
      console.log("\n");
      console.table(
        commits.data.builds?.map((build: any) => ({
          "Build Id": build.id,
          Hash: build.hash,
  
          "Has Warning": !!build.hasWarning,
          Status: build.status,
          "Start Date": build.startDate
            ? moment(build.startDate).calendar()
            : "Could not find date",
          "End Date": build.endDate
            ? moment(build.endDate).calendar()
            : "Could not find date",
        }))
      );
      return commits.data;
    } catch (error) {
      handleError(error);
    }
  }

export async function startBuild(options: { profileId: string, branch: string,workflow: string }) {
    const spinner = ora(`Try to start a new build with ${options.workflow}`).start();
    try {
        const branches = await getBranches({ profileId: options.profileId || '' }, false);
        const workflows = await getWorkflows({ profileId: options.profileId || '' }, false);
        const branchIndex = branches.findIndex((element: {[key:string]: any }) => element.name === options.branch);
        const branchId = branches[branchIndex].id;
        const workflowIndex = workflows.findIndex((element: {[key:string]: any }) => element.workflowName === options.workflow);
        const workflowId = workflows[workflowIndex].id;

        const allCommitsByBranchId = await axios.get(`${API_HOSTNAME}/build/v2/commits?branchId=${branchId}`,
            {
                headers: getHeaders()
            });
        const latestCommitId = allCommitsByBranchId.data[0].id;
        const buildResponse = await axios.post(`${API_HOSTNAME}/build/v2/commits/${latestCommitId}?workflowId=${workflowId}`,
            qs.stringify({ sample: 'test' }),
        {
                headers: {
                    ...getHeaders(),
                    "accept": "*/*",
                    "content-type": "application/x-www-form-urlencoded"
                }
            }
        );
        spinner.text = `Build added to queue successfully.\n\nTaskId: ${buildResponse.data.taskId}\nQueueItemId: ${buildResponse.data.queueItemId}`;
        spinner.succeed();
    } catch (error) {
        spinner.fail('Build failed');
        handleError(error);
    }
}

export async function downloadArtifact(options: { path: string, buildId: string, commitId: string}) {
    try {
        const downloadPath = path.resolve((options.path || '').replace('~', `${os.homedir}`));
        const spinner = ora(`Downloading file artifact.zip under ${downloadPath}`).start();
        const writer = fs.createWriteStream(`${downloadPath}/artifact.zip`);

        const data = new FormData();
        data.append('Path', downloadPath);
        data.append('Build Id', options.buildId);
        data.append('Commit Id', options.commitId);

        const downloadResponse = await axios.get(
            `${API_HOSTNAME}/build/v2/commits/${options.commitId}/builds/${options.buildId}`,
            {
                responseType: 'stream',
                headers: {
                    ...getHeaders(),
                    ...data.getHeaders()
                }
            }
        );
        return new Promise((resolve, reject) => {
            downloadResponse.data.pipe(writer);
            let error: any = null;
            writer.on('error', err => {
                error = err;
                writer.close();
                spinner.text = 'The file could not be downloaded.';
                spinner.fail();
                reject(err);
            });
            writer.on('close', () => {
                if (!error) {
                    spinner.text = `The file artifact.zip is downloaded successfully under path:\n\n ${downloadPath}`;
                    spinner.succeed();
                    resolve(true);
                }
                //no need to call the reject here, as it will have been called in the
                //'error' stream;
            });
          });

    } catch (error) {
        handleError(error);
    }
}

export async function uploadArtifact(options: { message: string, app: string, profileId: string }) {
    try {
        const spinner = ora('Try to upload the app').start();

        const data = new FormData();
        data.append('Message', options.message);
        data.append('File', fs.createReadStream(options.app));

        const uploadResponse = await axios.post(
            `${API_HOSTNAME}/distribution/v2/profiles/${options.profileId}/app-versions`,
            data,
            {
                headers: {
                    ...getHeaders(),
                    ...data.getHeaders()
                }
            }
        );
        spinner.text = `App uploaded successfully.\n\nTaskId: ${uploadResponse.data.taskId}`;
        spinner.succeed();
    } catch (error) {
        handleError(error);
    }
}

export async function getEnvironmentVariableGroups(options: {}) {
    try {
        const environmentVariableGroups = await axios.get(`${API_HOSTNAME}/build/v1/variable-groups`,
            {
                headers: getHeaders()
            }
        );
        console.table(environmentVariableGroups.data
            .map((x: any) => ({ 'Variable Groups ID': x.id, 'Variable Groups Name': x.name }))
        );
        return environmentVariableGroups.data;
    } catch (error) {
        handleError(error);
    }
}

export async function createEnvironmentVariableGroup(options: { name: string }) {
    try {
        await axios.post(`${API_HOSTNAME}/build/v1/variable-groups`,
            { name: options.name, variables: [] },
            {
                headers: getHeaders()
            }
        );
        console.info(`\n${options.name} environment variable group created successfully!`);
    } catch (error) {
        handleError(error);
    }
}

export async function getEnvironmentVariables(options: { variableGroupId: string }) {
    try {
        const environmentVariables =
            await axios.get(`${API_HOSTNAME}/build/v1/variable-groups/${options.variableGroupId}/variables`,
                {
                    headers: getHeaders()
                }
            );
        console.table(environmentVariables.data
            .map((environmentVariable: any) => (
                {
                    'Key Name': environmentVariable.key,
                    'Key Value': environmentVariable.isSecret ? '********' : environmentVariable.value
                }
            ))
        );
        return environmentVariables.data;
    } catch (error) {
        handleError(error);
    }
}

async function createTextEnvironmentVariable(options: { variableGroupId: string, value: string, isSecret: boolean, key: string }) {
    try {
        await axios.post(`${API_HOSTNAME}/build/v1/variable-groups/${options.variableGroupId}/variables`,
            { Key: options.key, Value: options.value, IsSecret: options.isSecret },
            {
                headers: getHeaders()
            }
        );
        console.info(`\n${options.key} environment variable created successfully!`);
    } catch (error) {
        handleError(error);
    }
}

async function createFileEnvironmentVariable(options: {key: string, value: string, isSecret: boolean, filePath: string, variableGroupId: string }) {
    try {
        const form = new FormData();
        const file = fs.createReadStream(options.filePath);

        form.append('Key', options.key);
        form.append('Value', options.value);
        form.append('IsSecret', options.isSecret);
        form.append('Binary', file);

        const req = https.request(
            {
                host: removeHttp(API_HOSTNAME),
                path: `/build/v1/variable-groups/${options.variableGroupId}/variables/files`,
                method: 'POST',
                headers: {
                    ...getHeaders(),
                    ...form.getHeaders(),
                    "accept": "*/*",
                },
            },
            () => {
                console.info(`\n${options.key} environment variable created successfully!`);
            }
        );

        form.pipe(req);
    } catch (error) {
        handleError(error);
    }
}

export async function createEnvironmentVariable(options: { type: keyof typeof EnvironmentVariableTypes, variableGroupId: string, key: string, value: string, filePath: string, isSecret: boolean }) {
    if (options.type === EnvironmentVariableTypes.FILE) {
        createFileEnvironmentVariable({
            variableGroupId: options.variableGroupId,
            key: options.key,
            value: options.value,
            filePath: options.filePath,
            isSecret: options.isSecret,
        });
    } else if (options.type && options.type === EnvironmentVariableTypes.TEXT) {
        createTextEnvironmentVariable({
            variableGroupId: options.variableGroupId,
            key: options.key,
            value: options.value,
            isSecret: options.isSecret
        });
    } else if (options.type) {
        console.error('Environment variable type not found');
    } else {
        console.error('Environment variable is required');
    }
}

export async function getBranches(options: { profileId: string }, showConsole: boolean = true) {
    try {
        const branchResponse = await axios.get(`${API_HOSTNAME}/build/v2/profiles/${options.profileId}`,
            {
                headers: getHeaders()
            });
        if (showConsole) {
            console.table(branchResponse.data.branches
                .map((branch: any) => ({
                    'Branch Id': branch.id,
                    'Branch Name': branch.name,
                    'Last Build': branch.lastBuildDate ? moment(branch.lastBuildDate).calendar() : 'No previous builds',
                    //@ts-ignore
                    'Build Status': BuildStatus[String(branch.buildStatus)] || 'No previous builds'
                }))
            );
        }
        return branchResponse.data.branches;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response && error.response.status === 404) {
            return [];
        } else {
            handleError(error);
        }
    }
}

export async function getWorkflows(options: { profileId: string }, showConsole: boolean = true) {
    try {
        const workflowResponse = await axios.get(`${API_HOSTNAME}/build/v2/profiles/${options.profileId}/workflows`,
            {
                headers: getHeaders(),
            });
        if (showConsole) {
            console.table(workflowResponse.data
                .map((workflow: any) => ({
                    'Workflow Id': workflow.id,
                    'Workflow Name': workflow.workflowName,
                    'Last Used': workflow.lastUsedTime ? moment(workflow.lastUsedTime).calendar() : 'No previous builds',
                }))
            );    
        }
        return workflowResponse.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response && error.response.status === 404) {
            return [];
        } else {
            handleError(error);
        }
    }
}

export async function getBuildTaskStatus(options: { latestCommitId: string, taskId: string }) {
    try {
        const taskStatus = await axios.get(`${API_HOSTNAME}/build/v2/commits/${options.latestCommitId}/builds/${options.taskId}/status`,
            {
                headers: getHeaders()
            });
        return taskStatus.data;
    } catch (error) {
        handleError(error);
    }
}

function handleError(error: unknown) {
    if (axios.isAxiosError(error)) {
        console.error(`${error.message} ${error.code}`)
   } else {
        console.error(error);
    }
}

function removeHttp(url: string) {
    return url.replace(/(^\w+:|^)\/\//, '');
}

export async function getEnterpriseProfiles() {
    try {
        const buildProfiles = await axios.get(`${API_HOSTNAME}/store/v2/profiles`,
            {
                headers: getHeaders()
            });
        if (buildProfiles.data.length === 0) {
            console.info('No build profiles available.');
            return;
        }
        console.table(buildProfiles.data
            .map((buildProfile: any) => ({
                'Profile Id': buildProfile.id,
                'Profile Name': buildProfile.name,
                'Version': buildProfile.version,
                'Downloads': buildProfile.totalDownloadCount,
                'Latest Publish': buildProfile.latestPublishDate ? moment(buildProfile.latestPublishDate).calendar() :  '-',
                'Last Received': buildProfile.lastBinaryReceivedDate ? moment(buildProfile.lastBinaryReceivedDate).calendar() :  '-',
            }))
        );
        return buildProfiles.data;
    } catch (error) {
        handleError(error);
    }
}

export async function getEnterpriseAppVersions(options: { entProfileId: string,publishType: string }) {
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

    try {
        const profileResponse = await axios.get(`${API_HOSTNAME}/store/v2/profiles/${options.entProfileId}/app-versions${versionType}`,
            {
                headers: getHeaders()
            });
        if (profileResponse.data.length === 0) {
            console.info('No app versions available.');
            return;
        }
        console.table(profileResponse.data
            .map((buildProfile: any) => ({
                'Version Name': buildProfile.name,
                'Summary': buildProfile.summary,
                'Version': buildProfile.version,
                'Version Code': buildProfile.versionCode,
                'Publish Type':  (PublishTypes as any)[buildProfile.publishType],
                'Latest Publish': buildProfile.publishDate ? moment(buildProfile.publishDate).calendar() :  '-',
                'Target Platform': (OperatingSystems as any)[buildProfile.platformType],
                'Downloads': buildProfile.downloadCount,
                'Created': buildProfile.createDate ? moment(buildProfile.createDate).calendar() :  '-',
                'Updated': buildProfile.updateDate ? moment(buildProfile.updateDate).calendar() :  '-',
            }))
        );
        return profileResponse.data;
    } catch (error) {
        handleError(error);
    }
}

export async function publishEnterpriseAppVersion(options: { entProfileId: string, entVersionId: string, summary: string, releaseNotes: string, publishType: string }) {
    try {
        const versionResponse = await axios.patch(`${API_HOSTNAME}/store/v2/profiles/${options.entProfileId}/app-versions/${options.entVersionId}?action=publish`,
        { summary: options.summary, releaseNotes: options.releaseNotes, publishType: options.publishType },    
        {
                headers: getHeaders()
            });
        if (versionResponse.data.length === 0) {
            console.info('No app versions available.');
            return;
        }
        console.table([versionResponse.data]
            .map((buildProfile: any) => ({
                'Profile Name': buildProfile.name,
                'Summary': buildProfile.summary,
                'Version': buildProfile.version,
                'Version Code': buildProfile.versionCode,
                'Publish Type':  (PublishTypes as any)[buildProfile.publishType],
                'Latest Publish': buildProfile.publishDate ? moment(buildProfile.publishDate).calendar() :  '-',
                'Target Platform': (OperatingSystems as any)[buildProfile.platformType],
                'Downloads': buildProfile.downloadCount,
                'Created': buildProfile.createDate ? moment(buildProfile.createDate).calendar() :  '-',
                'Updated': buildProfile.updateDate ? moment(buildProfile.updateDate).calendar() :  '-',
            }))
        );
        return versionResponse.data;
    } catch (error) {
        handleError(error);
    }
}

export async function unpublishEnterpriseAppVersion(options: { entProfileId: string, entVersionId: string }) {
    try {
        const versionResponse = await axios.patch(`${API_HOSTNAME}/store/v2/profiles/${options.entProfileId}/app-versions/${options.entVersionId}?action=unpublish`,
        {  },    
        {
                headers: getHeaders()
            });
        if (versionResponse.data.length === 0) {
            console.info('No app versions available.');
            return;
        }
        console.table([versionResponse.data]
            .map((buildProfile: any) => ({
                'Profile Name': buildProfile.name,
                'Summary': buildProfile.summary,
                'Version': buildProfile.version,
                'Version Code': buildProfile.versionCode,
                'Publish Type':  (PublishTypes as any)[buildProfile.publishType],
                'Latest Publish': buildProfile.publishDate ? moment(buildProfile.publishDate).calendar() :  '-',
                'Target Platform': (OperatingSystems as any)[buildProfile.platformType],
                'Downloads': buildProfile.downloadCount,
                'Created': buildProfile.createDate ? moment(buildProfile.createDate).calendar() :  '-',
                'Updated': buildProfile.updateDate ? moment(buildProfile.updateDate).calendar() :  '-',
            }))
        );
        return versionResponse.data;
    } catch (error) {
        handleError(error);
    }
}

export async function removeEnterpriseAppVersion(options: { entProfileId: string, entVersionId: string }) {
    const spinner = ora('Try to delete the app version').start();
    try {
        const versionResponse = await axios.delete(`${API_HOSTNAME}/store/v2/profiles/${options.entProfileId}/app-versions/${options.entVersionId}`,
        {
                headers: getHeaders()
            });
        if (versionResponse.data.length === 0) {
            console.info('No app versions available.');
            return;
        }
        spinner.text = `App version deleted successfully.\n\nTaskId: ${versionResponse.data.taskId}`;
        spinner.succeed();
        return versionResponse.data;
    } catch (error) {
        spinner.fail('App version delete failed');
        handleError(error);
    }
}

export async function notifyEnterpriseAppVersion(options: { entProfileId: string, entVersionId: string, subject:string, message: string }) {
    const spinner = ora(`Notifying users with new version for ${options.entVersionId}`).start();
    try {
        const versionResponse = await axios.post(`${API_HOSTNAME}/store/v2/profiles/${options.entProfileId}/app-versions/${options.entVersionId}?action=notify`,
        { subject: options.subject, message: options.message },    
        {
                headers: getHeaders()
            });
        if (versionResponse.data.length === 0) {
            console.info('No app versions available.');
            return;
        }
        spinner.text = `Version notification sent successfully.\n\nTaskId: ${versionResponse.data.taskId}`;
        spinner.succeed();
        return versionResponse.data;
    } catch (error) {
        spinner.fail('Notification failed');
        handleError(error);
    }
}

export async function uploadEnterpriseAppVersion(options: { entProfileId: string, app: string }) {
    try {
        const spinner = ora('Try to upload the app').start();

        const data = new FormData();
        data.append('File', fs.createReadStream(options.app));

        const uploadResponse = await axios.post(
            `${API_HOSTNAME}/store/v2/profiles/${options.entProfileId}/app-versions`,
            data,
            {
                headers: {
                    ...getHeaders(),
                    ...data.getHeaders()
                }
            }
        );
        spinner.text = `App uploaded successfully.\n\nTaskId: ${uploadResponse.data.taskId}`;
        spinner.succeed();
    } catch (error) {
        handleError(error);
    }
}

export async function uploadEnterpriseApp(options: { app: string }) {
    try {
        const spinner = ora('Try to upload the app').start();

        const data = new FormData();
        data.append('File', fs.createReadStream(options.app));

        const uploadResponse = await axios.post(
            `${API_HOSTNAME}/store/v2/profiles/app-versions`,
            data,
            {
                headers: {
                    ...getHeaders(),
                    ...data.getHeaders()
                }
            }
        );
        spinner.text = `New profile created and app uploaded successfully.\n\nTaskId: ${uploadResponse.data.taskId}`;
        spinner.succeed();
    } catch (error) {
        handleError(error);
    }
}

export async function getEnterpriseDownloadLink(options: { entProfileId: string, entVersionId: string }) {
    try {
        const qrcodeStatus = await axios.get(`${API_HOSTNAME}/store/v2/profiles/${options.entProfileId}/app-versions/${options.entVersionId}?action=download`,
            {
                headers: getHeaders()
            });
        console.log(`Download Link: ${qrcodeStatus.data}`);
        return qrcodeStatus.data;
    } catch (error) {
        handleError(error);
    }
}
