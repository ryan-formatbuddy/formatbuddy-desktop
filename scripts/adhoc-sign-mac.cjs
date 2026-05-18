const { execFileSync } = require("node:child_process");
const { join } = require("node:path");

module.exports = async function adhocSignMac(context) {
  if (context.electronPlatformName !== "darwin") return;

  const appName =
    context.packager?.appInfo?.productFilename ||
    context.packager?.appInfo?.productName ||
    "FormatBuddy";
  const appPath = join(context.appOutDir, `${appName}.app`);

  execFileSync("/usr/bin/codesign", ["--force", "--deep", "--sign", "-", appPath], {
    stdio: "inherit"
  });
};
