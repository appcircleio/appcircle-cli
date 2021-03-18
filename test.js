const { createCommand } = require('commander');
const program = createCommand();

// program
//     .description('Appcircle CLI helps you build and distribute your mobile apps.')
//     .name("appcircle")
//     .command('login <source> [destination]')
//     .description('clone a repository into a newly created directory')
//     .action((source, destination) => {
//         console.log('clone command called');
//         console.log("Source: " + source);
//         console.log("destination: " + destination);
//     });

program
    .command('clone <source> [destination]')
    .description('clone a repository into a newly created directory')
    .action((source, destination) => {
        console.log('clone command called');
        console.log("Source: " + source);
        console.log("destination: " + destination);
    });
program.parse(process.argv);
// Command implemented using stand-alone executable file (description is second parameter to `.command`)
// Returns `this` for adding more commands.
// program
//     .command('start <service>', 'start named service')
//     .action((service) => {
//         console.log('start command called');
//         console.log("service: " + service);
//     })
//     .command('stop [service]', 'stop named service, or all if no name supplied')
//     .action((service) => {
//         console.log('stop command called');
//         console.log("service: " + service);
//     });

// Command prepared separately.
// Returns `this` for adding more commands.
// program
//     .addCommand(build.makeBuildCommand());

