import {
    getToken, getTestingGroups,
    getDistributionProfiles,
    createDistributionProfile,
    uploadArtifact,
    getBuildProfiles,
    startBuild
} from './services';

function parseArguments(args) {
    const task = args._[0];
    const access_token = process.env.AC_ACCESS_TOKEN
    if (task === "login") {
        if (args.pat) {
            getToken(args.pat);
        } else {
            // write help
        }
    } else if (task === "listDistributionProfiles") {
        if (access_token) {
            getDistributionProfiles(access_token);
        } else {
            // write help
        }
    } else if (task === "upload") {
        if (args.app && args.profileId) {
            uploadArtifact({
                app: args.app,
                message: args["release-notes"],
                profileId: args.profileId,
                access_token: access_token
            });
        } else {
            // write help
        }
    } else if (task == "listBuildProfiles") {
        if (access_token) {
            getBuildProfiles(access_token);
        } else {
            // write help
        }
    } else if (task == "build") {
        if (args.id && args.branch) {
            startBuild({
                branch: args.branch,
                profileId: args.id,
                access_token: access_token
            });
        } else {
            // write help
        }
    }
}

export function cli(args) {
    parseArguments(args);
}