
const { createCommand } = require('commander');
const program = createCommand();
import {
    getToken, getTestingGroups,
    getDistributionProfiles,
    createDistributionProfile,
    uploadArtifact,
    getBuildProfiles,
    startBuild
} from '../src/services';

const access_token = process.env.AC_ACCESS_TOKEN

export function cli(args) {
    program
        .description('Appcircle CLI helps you build and distribute your mobile apps.')
        .command('login <pat>')
        .description('Log in')
        .action((pat) => {
            console.log('pat: ' + pat);
            getToken(pat);
        });

    program
        .command('listBuildProfiles')
        .description('Get list of build profiles')
        .action(() => {
            console.log('listBuildProfiles');
            getBuildProfiles(access_token);
        });

    program
        .command('listDistributionProfiles')
        .description('Get list of distribution profiles')
        .action(() => {
            console.log('listDistributionProfiles');
            getDistributionProfiles(access_token);
        });

    program
        .command('build <id> <branch>')
        .description('Start a new build')
        .action((id, branch) => {
            console.log('build ', id, "   ", branch);
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
            console.log('upload ', app, "   ", profileId, "   ", release_notes);

            uploadArtifact({
                app: app,
                message: release_notes,
                profileId: profileId,
                access_token: access_token
            });
        });
    program.parse(args);
}
