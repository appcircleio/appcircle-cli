# Changelog

### [1.0.3](https://github.com/appcircleio/appcircle-cli/compare/v1.0.2...v1.0.3) (2022-04-29)

**Added**

- Enterprise endpoints added
    - [x] List Enterprise profiles
    - [x] List Enterprise app versions
    - [x] Publish Enterprise app version
    - [x] Unpublish Enterprise app version
    - [x] Remove Enterprise app version
    - [x] Notify Enterprise app version
    - [x] Upload Enterprise app version for a profile
    - [x] Upload Enterprise app version without a profile
    - [x] Get enterprise app download link
- Logging requests as curl command added
- `Appcircle CLI` User Agent added for requests
- Upgraded *axios* to `0.27.1`
- Upgraded *minimist* to `1.2.5`
- Upgraded *moment* to `2.29.1`
- Upgraded *strip-ansi* to `6.0.1` with selective dependency resolution

**Removed**

- *yargs* package was removed since it's not being used.

**Fixed**

- Error handling code is updated to remove warnings.


### [1.0.2](https://github.com/appcircleio/appcircle-cli/compare/v1.0.1...v1.0.2) (2022-02-08)

**Added**

- Upgraded axios dependency
- Added listBuildProfileWorkflows command
- `workflow` parameter added for the build command
