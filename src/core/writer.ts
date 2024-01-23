import chalk from "chalk";
import { CommandTypes } from "./commands";
import { AuthenticationTypes, OperatingSystems, PlatformTypes, PublishTypes, BuildStatus } from "../constant";
import moment from "moment";
import { getConsoleOutputType } from "../config";

const writersMap: { [key in CommandTypes]: (data: any) => void } = {

  [CommandTypes.CONFIG]: (data: any) => {
    
  },
  [CommandTypes.LOGIN]: (data: any) => {
    console.log(chalk.italic(`export AC_ACCESS_TOKEN="${data.access_token}"\n`));
    console.info(
      chalk.green(
        `Login is successful. If you keep getting 401 error, execute the command above to set your token manually to your environment variable`
      )
    );
  },
  [CommandTypes.LIST_BUILD_PROFILES]: (data: any) => {
    if (data.length === 0) {
      console.info("No build profiles available.");
      return;
    }
    console.table(
      data.map((buildProfile: any) => ({
        "Profile Id": buildProfile.id,
        "Profile Name": buildProfile.name,
        Pinned: buildProfile.pinned,
        "Target OS": (OperatingSystems as any)[buildProfile.os],
        "Target Platform": (PlatformTypes as any)[buildProfile.buildPlatformType],
        Repository: buildProfile.repositoryName ? buildProfile.repositoryName : "No repository connected",
        "Last Build": buildProfile.lastBuildDate ? moment(buildProfile.lastBuildDate).calendar() : "No previous builds",
        "Auto Distribute": buildProfile.autoDistributeCount === 0 ? "Disabled" : `Enabled in ${buildProfile.autoDistributeCount} branch(es)`,
        "Auto Build": buildProfile.autoBuildCount === 0 ? "Disabled" : "Enabled",
      }))
    );
  },
  [CommandTypes.LIST_BUILD_PROFILE_BRANCHES]: (data: any) => {
    console.table(
      data.branches.map((branch: any) => ({
        "Branch Id": branch.id,
        "Branch Name": branch.name,
        "Last Build": branch.lastBuildDate ? moment(branch.lastBuildDate).calendar() : "No previous builds",
        //@ts-ignore
        "Build Status": BuildStatus[String(branch.buildStatus)] || "No previous builds",
      }))
    );
  },
  [CommandTypes.LIST_BUILD_PROFILE_WORKFLOWS]: (data: any) => {
    console.table(
      data.map((workflow: any) => ({
        "Workflow Id": workflow.id,
        "Workflow Name": workflow.workflowName,
        "Last Used": workflow.lastUsedTime ? moment(workflow.lastUsedTime).calendar() : "No previous builds",
      }))
    );
  },
  [CommandTypes.LIST_BUILD_PROFILE_COMMITS]: (data: any) => {
    if (data.length === 0) {
      console.info("No commits available.");
      return;
    }
    console.table(
      data.map((commit: any) => ({
        "Commit Id": commit.id,
        Hash: commit.hash,
        Date: commit.commitDate ? moment(commit.commitDate).calendar() : "Could not find date",
        Author: commit.author || "",
        Message: commit.message || "",
      }))
    );
  },
  [CommandTypes.LIST_BUILD_PROFILE_BUILDS_OF_COMMIT]: (data: any) => {
    if (data.builds.length === 0) {
      console.info("No builds available.");
      return;
    }
    console.table(
      data.builds?.map((build: any) => ({
        "Build Id": build.id,
        Hash: build.hash,

        "Has Warning": !!build.hasWarning,
        Status: build.status,
        "Start Date": build.startDate ? moment(build.startDate).calendar() : "Could not find date",
        "End Date": build.endDate ? moment(build.endDate).calendar() : "Could not find date",
      }))
    );
  },
  [CommandTypes.LIST_DISTRIBUTION_PROFILES]: (data: any) => {
    if (data.length === 0) {
      console.info("No distribution profiles available.");
      return;
    }
    console.table(
      data.map((distributionProfile: any) => ({
        "Profile Id": distributionProfile.id,
        "Profile Name": distributionProfile.name,
        Pinned: distributionProfile.pinned,
        "iOS Version": distributionProfile.iOSVersion ? distributionProfile.iOSVersion : "No versions available",
        "Android Version": distributionProfile.androidVersion ? distributionProfile.androidVersion : "No versions available",
        "Last Updated": moment(distributionProfile.updateDate).fromNow(),
        "Last Shared": distributionProfile.lastAppVersionSharedDate ? moment(distributionProfile.lastAppVersionSharedDate).fromNow() : "Not Shared",
        Authentication: (AuthenticationTypes as any)[distributionProfile.settings.authenticationType],
        "Auto Send": distributionProfile.testingGroupIds ? "Enabled" : "Disabled",
      }))
    );
  },
  [CommandTypes.BUILD]: (data: any) => {},
  [CommandTypes.DOWNLOAD]: (data: any) => {},
  [CommandTypes.UPLOAD]: (data: any) => {},
  [CommandTypes.CREATE_DISTRIBUTION_PROFILE]: (data: any) => {
    console.info(`\n${data.name} distribution profile created successfully!`);
  },
  [CommandTypes.LIST_ENVIRONMENT_VARIABLE_GROUPS]: (data: any) => {
    console.table(data.map((x: any) => ({ "Variable Groups ID": x.id, "Variable Groups Name": x.name })));
  },
  [CommandTypes.CREATE_ENVIRONMENT_VARIABLE_GROUP]: (data: any) => {
    console.info(`\n${data.name} environment variable group created successfully!`);
  },
  [CommandTypes.LIST_ENVIRONMENT_VARIABLES]: (data: any) => {
    console.table(
      data.map((environmentVariable: any) => ({
        "Key Name": environmentVariable.key,
        "Key Value": environmentVariable.isSecret ? "********" : environmentVariable.value,
      }))
    );
  },
  [CommandTypes.CREATE_ENVIRONMENT_VARIABLE]: (data: any) => {
    console.info(`\n${data.key} environment variable created successfully!`);
  },
  [CommandTypes.LIST_ENTERPRISE_PROFILES]: (data: any) => {
    if (data.length === 0) {
      console.info("No build profiles available.");
      return;
    }
    console.table(
      data.map((buildProfile: any) => ({
        "Profile Id": buildProfile.id,
        "Profile Name": buildProfile.name,
        Version: buildProfile.version,
        Downloads: buildProfile.totalDownloadCount,
        "Latest Publish": buildProfile.latestPublishDate ? moment(buildProfile.latestPublishDate).calendar() : "-",
        "Last Received": buildProfile.lastBinaryReceivedDate ? moment(buildProfile.lastBinaryReceivedDate).calendar() : "-",
      }))
    );
  },
  [CommandTypes.LIST_ENTERPRISE_APP_VERSIONS]: (data: any) => {
    if (data.length === 0) {
      console.info("No app versions available.");
      return;
    }
    console.table(
      data.map((buildProfile: any) => ({
        "Version Name": buildProfile.name,
        Summary: buildProfile.summary,
        Version: buildProfile.version,
        "Version Code": buildProfile.versionCode,
        "Publish Type": (PublishTypes as any)[buildProfile.publishType],
        "Latest Publish": buildProfile.publishDate ? moment(buildProfile.publishDate).calendar() : "-",
        "Target Platform": (OperatingSystems as any)[buildProfile.platformType],
        Downloads: buildProfile.downloadCount,
        Created: buildProfile.createDate ? moment(buildProfile.createDate).calendar() : "-",
        Updated: buildProfile.updateDate ? moment(buildProfile.updateDate).calendar() : "-",
      }))
    );
  },
  [CommandTypes.PUBLISH_ENTERPRISE_APP_VERSION]: (data: any) => {
    console.table(
      [data].map((buildProfile: any) => ({
        "Profile Name": buildProfile.name,
        Summary: buildProfile.summary,
        Version: buildProfile.version,
        "Version Code": buildProfile.versionCode,
        "Publish Type": (PublishTypes as any)[buildProfile.publishType],
        "Latest Publish": buildProfile.publishDate ? moment(buildProfile.publishDate).calendar() : "-",
        "Target Platform": (OperatingSystems as any)[buildProfile.platformType],
        Downloads: buildProfile.downloadCount,
        Created: buildProfile.createDate ? moment(buildProfile.createDate).calendar() : "-",
        Updated: buildProfile.updateDate ? moment(buildProfile.updateDate).calendar() : "-",
      }))
    );
  },
  [CommandTypes.UNPUBLISH_ENTERPRISE_APP_VERSION]: (data: any) => {
    if (data.length === 0) {
      console.info("No app versions available.");
      return;
    }
    console.table(
      [data].map((buildProfile: any) => ({
        "Profile Name": buildProfile.name,
        Summary: buildProfile.summary,
        Version: buildProfile.version,
        "Version Code": buildProfile.versionCode,
        "Publish Type": (PublishTypes as any)[buildProfile.publishType],
        "Latest Publish": buildProfile.publishDate ? moment(buildProfile.publishDate).calendar() : "-",
        "Target Platform": (OperatingSystems as any)[buildProfile.platformType],
        Downloads: buildProfile.downloadCount,
        Created: buildProfile.createDate ? moment(buildProfile.createDate).calendar() : "-",
        Updated: buildProfile.updateDate ? moment(buildProfile.updateDate).calendar() : "-",
      }))
    );
  },
  [CommandTypes.REMOVE_ENTERPRISE_APP_VERSION]: (data: any) => {},
  [CommandTypes.NOTIFY_ENTERPRISE_APP_VERSION]: (data: any) => {
    if (data.length === 0) {
      console.info("No app versions available.");
      return;
    }
  },
  [CommandTypes.UPLOAD_ENTERPRISE_APP]: (data: any) => {},
  [CommandTypes.UPLOAD_ENTERPRISE_APP_VERSION]: (data: any) => {},
  [CommandTypes.GET_ENTERPRISE_DOWNLOAD_LINK]: (data: any) => {
    console.log(`Download Link: ${data}`);
  },
};

export const commandWriter = (command: CommandTypes, data: any) => {
  if (getConsoleOutputType() === "json") {
    console.log(JSON.stringify(data));
  } else {
    const writer = writersMap[command];
    if (writer) {
      writer(data);
    }
  }
};

export const configWriter = (config: any) => {
  if (getConsoleOutputType() === "json") {
    console.log(JSON.stringify(config));
  } else {
    console.table(config);
  }
};
