import https from 'https';
import qs from 'querystring';
import fs from 'fs';
import FormData from 'form-data';
import axios from 'axios';

const HOSTNAME = "https://api.appcircle.io";
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

export async function getToken(pat) {
    var options = {
        "method": "POST",
        "hostname": "auth.appcircle.io",
        "path": "/auth/v1/token",
        "headers": {
            "accept": "application/json",
            "content-type": "application/x-www-form-urlencoded"
        }
    };

    genericRequest({
        options: options,
        data: qs.stringify({ pat }),
        onSuccess: (bodyString) => {
            console.log((JSON.parse(bodyString).access_token));
        },
        onFailure: (error) => {
            console.log(error);
        }
    });
}

export async function getDistributionProfiles(access_token) {
    try {
        const distProfiles = await axios.get(`${HOSTNAME}/distribution/v2/profiles`,
            {
                headers: {
                    "accept": "application/json",
                    "Authorization": `Bearer ${access_token}`
                }
            });
        console.log("Distribution profiles: ", distProfiles);
    } catch (error) {
        console.error(error);
    }
}

export async function createDistributionProfile(options) {
    try {
        await axios.post(`${HOSTNAME}/distribution/v1/profiles`,
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

export function getTestingGroups(access_token) {
    var options = {
        "hostname": "auth.appcircle.io",
        "path": "/distribution/v2/testing-groups",
        "headers": {
            "accept": "application/json",
            "Authorization": `Bearer ${access_token}`
        }
    };
    genericRequest({
        options: options,
        onSuccess: (bodyString) => {
            console.log('\x1b[36m', 'Testing Groups: ', '\x1b[0m');
            console.log((JSON.parse(bodyString)));
        },
        onFailure: (error) => {
            console.log(error);
        }
    });
}

export async function getBuildProfiles(access_token) {
    let buildProfiles = await axios.get(`${HOSTNAME}/build/v2/profiles`,
        {
            headers: {
                "accept": "application/json",
                "Authorization": `Bearer ${access_token}`
            }
        });
    console.log("Build profiles: ", buildProfiles);
}

// branch: args.branch,
// profileId: args.id,
// access_token: access_token
export async function startBuild(options) {
    try {
        let getBranchListResponse = await axios.get(`${HOSTNAME}/build/v2/profiles/${options.profileId}`,
            {
                headers: {
                    "accept": "application/json",
                    "Authorization": `Bearer ${options.access_token}`
                }
            });

        const branches = getBranchListResponse.data.branches;
        const index = branches.findIndex(element => element.name === options.branch);
        const branchId = branches[index].id;
        console.log("branchId: ", branchId);

        const allCommitsByBranchId = await axios.get(`${HOSTNAME}/build/v2/commits?branchId=${branchId}`,
            {
                headers: {
                    "accept": "application/json",
                    "Authorization": `Bearer ${options.access_token}`
                }
            });
        const latestCommitId = allCommitsByBranchId.data[0].id;
        console.log("Latest commit by branch id: ", latestCommitId);

        const buildResponse = await axios.post(`${HOSTNAME}/build/v2/commits/${latestCommitId}?purpose=1`,
            qs.stringify({ sample: 'test' }),
            {
                headers: {
                    "accept": "*/*",
                    "authorization": `Bearer ${options.access_token}`,
                    "content-type": "application/x-www-form-urlencoded"
                }
            }
        );
        console.log("Build task response: ", buildResponse.data);

        let buildStateValue = 1000;
        while (buildStateValue > 3) { // 3 = Completed
            console.log("Waiting for 30 seconds...");
            await sleep(30000); // sleep for 30 seconds

            const taskStatus = await axios.get(`${HOSTNAME}/build/v2/commits/${latestCommitId}/builds/${buildResponse.data.taskId}/status`,
                {
                    headers: {
                        "accept": "application/json",
                        "Authorization": `Bearer ${options.access_token}`
                    }
                });
            console.log("Build status: ", buildStatus[taskStatus.data.status]);
            buildStateValue = taskStatus.data.status;
        }
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
            host: 'api.appcircle.io',
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

export async function createEnvironmentVariableGroup(options) {
    try {
        await axios.post(`${HOSTNAME}/build/v1/variable-groups`,
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

export async function createTextEnvironmentVariable(options) {
    try {
        await axios.post(`${HOSTNAME}/build/v1/variable-groups/${options.environmentVariableGroupId}/variables`,
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

export async function createFileEnvironmentVariable(options) {
    try {
        const form = new FormData();
        const file = fs.createReadStream(options.filePath);

        form.append('Key', options.key);
        form.append('Value', options.value);
        form.append('IsSecret', options.isSecret);
        form.append('Binary', file);

        const req = https.request(
            {
                host: 'api.appcircle.io',
                path: `/build/v1/variable-groups/${options.environmentVariableGroupId}/variables/files`,
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