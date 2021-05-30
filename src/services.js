import https from 'https';
import qs from 'querystring';
import fs from 'fs';
import FormData from 'form-data';
import axios from 'axios';
import moment from 'moment';
import chalk from 'chalk';
import ora from 'ora';

const API_HOSTNAME = process.env.API_HOSTNAME || "https://api.appcircle.io";
const AUTH_HOSTNAME = process.env.AUTH_HOSTNAME || "https://auth.appcircle.io";

const sleep = (waitTimeInMs) => new Promise(resolve => setTimeout(resolve, waitTimeInMs));

const buildStatus = {
    "0": "Success",
    "1": "Failed",
    "2": "Canceled",
    "3": "Timeout",
    "90": "Waiting",
    "91": "Running",
    "92": "Completing",
    "99": "Unknown"
};
const authenticationTypes = {
    1: "None",
    2: "Individual Enrollment",
    3: "Static Username and Password"
};
const operatingSystems = {
    1: 'iOS',
    2: 'Android'
};
const platformTypes = {
    0: "None",
    1: "Swift/Objective-C",
    2: "Java/Kotlin",
    3: "Smartface",
    4: "React Native",
    5: "Xamarin",
    6: "Flutter"
};
const environmentVariableTypes = {
    TEXT: 'text',
    FILE: 'file'
};

function genericRequest(args) {
    let { options, data, onSuccess, onError } = args
    const req = https.request(options, function (res) {
        var chunks = [];

        res.on("data", function (chunk) {
            chunks.push(chunk);
        });

        res.on("end", function () {
            var body = Buffer.concat(chunks);
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

export async function getToken(options) {
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
        onSuccess: (bodyString) => {
            const access_token = (JSON.parse(bodyString)).access_token;
            console.info(`Login successful.\n\nAppCircle has generated a token for you.\nYou should add this token to your environment variables.\n\nYou can add like this:\n`);
            console.log(chalk.bold(`export AC_ACCESS_TOKEN="${access_token}"`));
        },
        onFailure: (error) => {
            console.log(error);
        }
    });
}

export async function getDistributionProfiles(options) {
    try {
        const distributionProfiles = await axios.get(`${API_HOSTNAME}/distribution/v2/profiles`,
            {
                headers: {
                    "accept": "application/json",
                    "Authorization": `Bearer ${options.access_token}`
                }
            });
        console.table(distributionProfiles.data
            .map(distributionProfile => ({
                'Profile Name': distributionProfile.name,
                'Pinned': distributionProfile.pinned,
                'iOS Version': distributionProfile.iOSVersion ? distributionProfile.iOSVersion : 'No versions available',
                'Android Version': distributionProfile.androidVersion ? distributionProfile.androidVersion : 'No versions available',
                'Last Updated': moment(distributionProfile.updateDate).fromNow(),
                'Last Shared': distributionProfile.lastAppVersionSharedDate ?
                    moment(distributionProfile.lastAppVersionSharedDate).fromNow() : 'Not Shared',
                'Authentication': authenticationTypes[distributionProfile.settings.authenticationType],
                'Auto Send': distributionProfile.testingGroupIds ? 'Enabled' : 'Disabled'
            }))
        );
    } catch (error) {
        handleError(error);
    }
}

export async function createDistributionProfile(options) {
    try {
        await axios.post(`${API_HOSTNAME}/distribution/v1/profiles`,
            { name: options.name },
            {
                headers: {
                    "content-type": "application/json-patch+json",
                    "Authorization": `Bearer ${options.access_token}`
                }
            }
        );
        console.info(`\n${options.name} distribution profile created successfully!`);
    } catch (error) {
        handleError(error);
    }
}

export function getTestingGroups(options) {
    const requestOptions = {
        "hostname": removeHttp(AUTH_HOSTNAME),
        "path": "/distribution/v2/testing-groups",
        "headers": {
            "accept": "application/json",
            "Authorization": `Bearer ${options.access_token}`
        }
    };
    genericRequest({
        options: requestOptions,
        onSuccess: (bodyString) => {
            console.log('\x1b[36m', 'Testing Groups: ', '\x1b[0m');
            console.log((JSON.parse(bodyString)));
        },
        onFailure: (error) => {
            console.log(error);
        }
    });
}

export async function getBuildProfiles(options) {
    try {
        const buildProfiles = await axios.get(`${API_HOSTNAME}/build/v2/profiles`,
            {
                headers: {
                    "accept": "application/json",
                    "Authorization": `Bearer ${options.access_token}`
                }
            });
        console.table(buildProfiles.data
            .map(buildProfile => ({
                'Profile Name': buildProfile.name,
                'Pinned': buildProfile.pinned,
                'Target OS': operatingSystems[buildProfile.os],
                'Target Platform': platformTypes[buildProfile.buildPlatformType],
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

// branch: args.branch,
// profileId: args.id,
// access_token: access_token
export async function startBuild(options) {
    try {
        const spinner = ora('Try to start a new build').start();

        const branches = await getBranches({ access_token: options.access_token, profileId: options.profileId });
        const index = branches.findIndex(element => element.name === options.branch);
        const branchId = branches[index].id;

        const allCommitsByBranchId = await axios.get(`${API_HOSTNAME}/build/v2/commits?branchId=${branchId}`,
            {
                headers: {
                    "accept": "application/json",
                    "Authorization": `Bearer ${options.access_token}`
                }
            });
        const latestCommitId = allCommitsByBranchId.data[0].id;

        const buildResponse = await axios.post(`${API_HOSTNAME}/build/v2/commits/${latestCommitId}?purpose=1`,
            qs.stringify({ sample: 'test' }),
            {
                headers: {
                    "accept": "*/*",
                    "authorization": `Bearer ${options.access_token}`,
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

export function uploadArtifact(options) {
    const form = new FormData();
    const apkFile = fs.createReadStream(options.app);

    form.append('File', apkFile);
    if (options.message) {
        form.append('Message', options.message);
    }
    const req = https.request(
        {
            host: removeHttp(API_HOSTNAME),
            path: `/distribution/v2/profiles/${options.profileId}/app-versions`,
            method: 'POST',
            headers: {
                ...form.getHeaders(),
                "accept": "*/*",
                "authorization": `Bearer ${options.access_token}`
            },
        },
        response => {
            console.log("statusCode:", response.statusCode);
        }
    );

    form.pipe(req);
}

export async function getEnvironmentVariableGroups(options) {
    try {
        const environmentVariableGroups = await axios.get(`${API_HOSTNAME}/build/v1/variable-groups`,
            {
                headers: {
                    "Authorization": `Bearer ${options.access_token}`
                }
            }
        );
        console.table(environmentVariableGroups.data
            .map(x => ({ 'Variable Groups ID': x.id, 'Variable Groups Name': x.name }))
        );
    } catch (error) {
        handleError(error);
    }
}

export async function createEnvironmentVariableGroup(options) {
    try {
        await axios.post(`${API_HOSTNAME}/build/v1/variable-groups`,
            { name: options.name, variables: [] },
            {
                headers: {
                    "Authorization": `Bearer ${options.access_token}`
                }
            }
        );
        console.info(`\n${options.name} environment variable group created successfully!`);
    } catch (error) {
        handleError(error);
    }
}

export async function getEnvironmentVariables(options) {
    try {
        const environmentVariables =
            await axios.get(`${API_HOSTNAME}/build/v1/variable-groups/${options.variableGroupId}/variables`,
                {
                    headers: {
                        "Authorization": `Bearer ${options.access_token}`
                    }
                }
            );
        console.table(environmentVariables.data
            .map(environmentVariable => (
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

async function createTextEnvironmentVariable(options) {
    try {
        await axios.post(`${API_HOSTNAME}/build/v1/variable-groups/${options.variableGroupId}/variables`,
            { Key: options.key, Value: options.value, IsSecret: options.isSecret },
            {
                headers: {
                    "Authorization": `Bearer ${options.access_token}`
                }
            }
        );
        console.info(`\n${options.key} environment variable created successfully!`);
    } catch (error) {
        handleError(error);
    }
}

async function createFileEnvironmentVariable(options) {
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
                    ...form.getHeaders(),
                    "accept": "*/*",
                    "authorization": `Bearer ${options.access_token}`
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

export async function createEnvironmentVariable(options) {
    if (options.type && options.type === environmentVariableTypes.FILE) {
        createFileEnvironmentVariable({
            access_token: options.access_token,
            variableGroupId: options.variableGroupId,
            key: options.key,
            value: options.value,
            filePath: options.filePath,
            isSecret: options.isSecret,
        });
    } else if (options.type && options.type === environmentVariableTypes.TEXT) {
        createTextEnvironmentVariable({
            access_token: options.access_token,
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

export async function getBranches(options) {
    try {
        const branches = await axios.get(`${API_HOSTNAME}/build/v2/profiles/${options.profileId}`,
            {
                headers: {
                    "accept": "application/json",
                    "Authorization": `Bearer ${options.access_token}`
                }
            });
        return branches.data.branches;
    } catch (error) {
        handleError(error);
    }
}

export async function getBuildTaskStatus(options) {
    try {
        const taskStatus = await axios.get(`${HOSTNAME}/build/v2/commits/${options.latestCommitId}/builds/${options.taskId}/status`,
            {
                headers: {
                    "accept": "application/json",
                    "Authorization": `Bearer ${options.access_token}`
                }
            });
        return taskStatus.data;
    } catch (error) {
        handleError(error);
    }
}

function handleError(error) {
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

function removeHttp(url) {
    return url.replace(/(^\w+:|^)\/\//, '');
}