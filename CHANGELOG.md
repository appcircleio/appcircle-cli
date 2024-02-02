# [1.1.0](https://github.com/appcircleio/appcircle-cli/compare/v1.0.7-beta.2...v1.1.0) (2024-01-29)



### Bug Fixes

* **doc:** version label ([072435e](https://github.com/appcircleio/appcircle-cli/commit/072435e20fd041524a2807a26e2e23831deda19d))
* **build:** add get configurations list step for build command ([8dbe764](https://github.com/appcircleio/appcircle-cli/commit/8dbe764279f96bf854ede7fb1baed068b625e261))
* **commands:** exit with code 0 when help command runs ([26a9a26](https://github.com/appcircleio/appcircle-cli/commit/26a9a260d1f7b6f17f4dd4ad5d41fe59b39a80cc))
* **help:** build commands optinal params check if need one of them ([b67518e](https://github.com/appcircleio/appcircle-cli/commit/b67518ee7bea3cb49df181514c4184b41e0253dc))



### Features

* **command:** Add missing builds of commit command &  download artifact command params description and order ([a34fc4c](https://github.com/appcircleio/appcircle-cli/commit/a34fc4cf4a99363746fd1fc8d4356666cb15d1b5))
* **command:** Add config commands ([54b3adc](https://github.com/appcircleio/appcircle-cli/commit/54b3adc8605a771a8ddbc3323d4e4e346c7b85a5))
* **core:** BE-2553 Add commander for help command ([cba319b](https://github.com/appcircleio/appcircle-cli/commit/cba319bc3de595cdcf836ec97e68abbb24d42023))
* **core:** Separate services ( writer, command runner, interactive runner) ([567de5f](https://github.com/appcircleio/appcircle-cli/commit/567de5f8d79fddfb25d6497639226fbe38da3635))
* **prompt:** Add autocomplete promt inteadof select ([713df4e](https://github.com/appcircleio/appcircle-cli/commit/713df4ee219d08ae985e5c2fe93e88c47b5cab01))
* **scripts:** Add npm package checker script ([bc4eff4](https://github.com/appcircleio/appcircle-cli/commit/bc4eff468b113fd0b534610a941d85e781edf264))



## [1.0.7-beta.2](https://github.com/appcircleio/appcircle-cli/compare/v1.0.7-beta.1...v1.0.7-beta.2) (2024-01-29)


### Bug Fixes

* **build:** add get configurations list step for build command ([8dbe764](https://github.com/appcircleio/appcircle-cli/commit/8dbe764279f96bf854ede7fb1baed068b625e261))



## [1.0.7-beta.1](https://github.com/appcircleio/appcircle-cli/compare/v1.0.7-alpha.0...v1.0.7-beta.1) (2024-01-29)


### Bug Fixes

* **commands:** exit with code 0 when help command runs ([26a9a26](https://github.com/appcircleio/appcircle-cli/commit/26a9a260d1f7b6f17f4dd4ad5d41fe59b39a80cc))
* **help:** build commands optinal params check if need one of them ([b67518e](https://github.com/appcircleio/appcircle-cli/commit/b67518ee7bea3cb49df181514c4184b41e0253dc))




### Features

* **compiler:** change target as es2015 ([230e2a5](https://github.com/appcircleio/appcircle-cli/commit/230e2a537ec0f494374917e61ff9cf194b5e0daf))



## [1.0.5](https://github.com/appcircleio/appcircle-cli/compare/v1.0.4...v1.0.5) (2024-01-25)


### Bug Fixes

* **interactive:** BE-2552 adding missing experiences in interactive mode ([a920471](https://github.com/appcircleio/appcircle-cli/commit/a920471ea637a5fd18417958d5e40e0124f8f65e))


### Features

* **command:** Add missing builds of commit command &  download artifact command params description and order ([a34fc4c](https://github.com/appcircleio/appcircle-cli/commit/a34fc4cf4a99363746fd1fc8d4356666cb15d1b5))
* **config:** Add config commands ([54b3adc](https://github.com/appcircleio/appcircle-cli/commit/54b3adc8605a771a8ddbc3323d4e4e346c7b85a5))
* **core:** BE-2553 Add commander for help command ([cba319b](https://github.com/appcircleio/appcircle-cli/commit/cba319bc3de595cdcf836ec97e68abbb24d42023))
* **core:** Separate services ( writer, command runner, interactive runner) ([567de5f](https://github.com/appcircleio/appcircle-cli/commit/567de5f8d79fddfb25d6497639226fbe38da3635))
* **prompt:** Add autocomplete promt inteadof select ([713df4e](https://github.com/appcircleio/appcircle-cli/commit/713df4ee219d08ae985e5c2fe93e88c47b5cab01))
* **scripts:** Add npm package checker script ([bc4eff4](https://github.com/appcircleio/appcircle-cli/commit/bc4eff468b113fd0b534610a941d85e781edf264))



## [1.0.4](https://github.com/appcircleio/appcircle-cli/compare/v1.0.3...v1.0.4) (2022-05-16)


### Features

- Enterprise endpoints added
    - [x] List Enterprise app versions by publish type (Beta, Live)




## [1.0.3](https://github.com/appcircleio/appcircle-cli/compare/v1.0.2...v1.0.3) (2022-05-09)


### Bug Fixes

- Error handling code is updated to remove warnings.



### Features

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

### Removed

- *yargs* package was removed since it's not being used.




## [1.0.2](https://github.com/appcircleio/appcircle-cli/compare/v1.0.1...v1.0.2) (2022-02-08)


### Features

- Upgraded axios dependency
- Added listBuildProfileWorkflows command
- `workflow` parameter added for the build command



## [1.0.1](https://github.com/appcircleio/appcircle-cli/compare/c5814fb7e124b4ae8081b7da42f26887d79486ef...v1.0.1) (2021-07-01)


### Bug Fixes

* **package.json:** Add publish config ([425a3a3](https://github.com/appcircleio/appcircle-cli/commit/425a3a35bf6ad8741fe154f9af41d5b531d84c25))
* **services.js:** Change path typo ([c5814fb](https://github.com/appcircleio/appcircle-cli/commit/c5814fb7e124b4ae8081b7da42f26887d79486ef))

