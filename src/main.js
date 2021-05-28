
const { createCommand } = require('commander');
const program = createCommand();
import {
    getToken,
    getTestingGroups,
    getDistributionProfiles,
    createDistributionProfile,
    uploadArtifact,
    getBuildProfiles,
    startBuild,
    getEnvironmentVariableGroups,
    createEnvironmentVariableGroup,
    getEnvironmentVariables,
    createEnvironmentVariable
} from '../src/services';

const access_token = process.env.AC_ACCESS_TOKEN

export function cli(args) {
    program
        .description('Appcircle CLI helps you build and distribute your mobile apps.')
        .command('login <pat>')
        .description('Log in')
        .action((pat) => {
            getToken(pat);
        });

    program
        .command('listBuildProfiles')
        .description('Get list of build profiles')
        .action(() => {
            getBuildProfiles(access_token);
        });

    program
        .command('listDistributionProfiles')
        .description('Get list of distribution profiles')
        .action(() => {
            getDistributionProfiles(access_token);
        });

    program
        .command('build <id> <branch>')
        .description('Start a new build')
        .action((id, branch) => {
            startBuild({
                branch: branch,
                profileId: id,
                access_token: access_token
            })
        });

    program
        .command('upload <app> <profileId> [release_notes]')
        .description('Upload your mobile app to selceted distribution profile')
        .action((app, profileId, release_notes,) => {
            uploadArtifact({
                app: app,
                message: release_notes,
                profileId: profileId,
                access_token: access_token
            });
        });

    program.command('createDistributionProfile <name>')
        .description('Create a distribution profile')
        .action((name) => {
            createDistributionProfile({ access_token: access_token, name });
        });

    program.command('listEnvironmentVariableGroups')
        .description('Get list of environment variable groups')
        .action(() => {
            getEnvironmentVariableGroups(access_token);
        });

    program.command('createEnvironmentVariableGroup <name>')
        .description('Create an environment variable group')
        .action((name) => {
            createEnvironmentVariableGroup({ access_token: access_token, name });
        });

    program.command('listEnvironmentVariables <variableGroupId>')
        .description('Get list of environment variables')
        .action((variableGroupId) => {
            getEnvironmentVariables({ access_token: access_token, variableGroupId });
        });

    program.command('createEnvironmentVariable <type> <variableGroupId> <key> <value> <filePath> <isSecret>')
        .description('Create a file or text environment variable')
        .action((type, variableGroupId, key, value, filePath, isSecret) => {
            createEnvironmentVariable({
                access_token: access_token,
                type,
                variableGroupId,
                key,
                value,
                filePath,
                isSecret
            });
        });

    program.parse(args);
}
