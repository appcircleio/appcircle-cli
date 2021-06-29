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

import { readVariable, writeVariable, EnvironmentVariables } from './data';


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
const EnvironmentVariableTypes = {
    TEXT: 'text',
    FILE: 'file'
};

function getHeaders(withToken = true): AxiosRequestConfig['headers'] {
    let response: AxiosRequestConfig['headers'] = {
        accept: "application/json"
    }
    if (withToken) {
        response.Authorization = `Bearer ${readVariable(EnvironmentVariables.AC_ACCESS_TOKEN)}`
    }
    return response;
}

function genericRequest(args: any) {
    let { options, data, onSuccess, onError } = args
    const req = https.request(options, function (res) {
        const chunks: any[] = [];

        res.on("data", function (chunk) {
            chunks.push(chunk);
        });

        res.on("end", function () {
            const body = Buffer.concat(chunks);
            onSuccess && onSuccess(body.toString());
        });

        req.on('error', error => {
            onError && onError(error);
        });
    });

    if (data) {
        req.write(data);
    }
    req.end();
}

export async function getToken(options: { pat: string }) {
    const requestOptions = {
        "method": "POST",
        "hostname": removeHttp(AUTH_HOSTNAME),
        "path": "/auth/v1/token",
        "headers": {
            "accept": "application/json",
            "content-type": "application/x-www-form-urlencoded"
        }
    };

    genericRequest({
        options: requestOptions,
        data: qs.stringify({ pat: options.pat }),
        onSuccess: (bodyString: string) => {
            const response = JSON.parse(bodyString);
            if (response.access_token) {
                writeVariable(EnvironmentVariables.AC_ACCESS_TOKEN, response.access_token);
                console.info(chalk.green(`Login is successful. If you keep getting 401 error, launch the following command to set your token manually to your environment variable:\n`));
                console.log(chalk.italic(`export AC_ACCESS_TOKEN="${response.access_token}"`));
            } else {
                console.error(`An error occurred during login.\nDetails: ${JSON.stringify(response)}`);
            }
        },
        onFailure: (error: any) => {
            console.error(error);
        }
    });
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

export function getTestingGroups(options: { }) {
    const requestOptions = {
        "hostname": removeHttp(AUTH_HOSTNAME),
        "path": "/distribution/v2/testing-groups",
        headers: getHeaders()
    };
    genericRequest({
        options: requestOptions,
        onSuccess: (bodyString: string) => {
            console.log('\x1b[36m', 'Testing Groups: ', '\x1b[0m');
            console.log((JSON.parse(bodyString)));
        },
        onFailure: (error: any) => {
            console.log(error);
        }
    });
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
    } catch (error) {
        handleError(error);
    }
}

export async function startBuild(options: { profileId: string, branch: string }) {
    try {
        const spinner = ora('Try to start a new build').start();

        const accessToken = readVariable(EnvironmentVariables.AC_ACCESS_TOKEN);
        const branches = await getBranches({ profileId: options.profileId || '' });
        const index = branches.findIndex((element: {[key:string]: any }) => element.name === options.branch);
        const branchId = branches[index].id;

        const allCommitsByBranchId = await axios.get(`${API_HOSTNAME}/build/v2/commits?branchId=${branchId}`,
            {
                headers: getHeaders()
            });
        const latestCommitId = allCommitsByBranchId.data[0].id;

        const buildResponse = await axios.post(`${API_HOSTNAME}/build/v2/commits/${latestCommitId}?purpose=1`,
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
        console.error(error);
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

export async function getBranches(options: { profileId: string }) {
    try {
        const branches = await axios.get(`${API_HOSTNAME}/build/v2/profiles/${options.profileId}`,
            {
                headers: getHeaders()
            });
        return branches.data.branches;
    } catch (error) {
        if (error.response && error.response.status === 404) {
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

function handleError(error: {[key:string]: any}) {
    if (error.response) {
        if (error.response.data) {
            if (error.response.data.message) {
                console.error(`${error.response.data.message} ${error.response.data.code}`);
            } else if (error.response.data.innerErrors && error.response.data.innerErrors.length > 0) {
                console.error(`${error.response.data.innerErrors[0].message} ${error.response.data.innerErrors[0].code}`);
            } else {
                console.error(error.response.data);
            }
        } else {
            console.error(error.response);
        }
    } else {
        console.error(error);
    }
}

function removeHttp(url: string) {
    return url.replace(/(^\w+:|^)\/\//, '');
}