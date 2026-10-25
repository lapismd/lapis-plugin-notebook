const { existsSync } = require("node:fs");
const path = require("node:path");

const localPackages = new Map([
  [
    "@lapis-notes/api",
    { protocol: "file:", path: "../lapis-notes/packages/api" },
  ],
  [
    "@lapis-notes/file-explorer",
    { protocol: "file:", path: "../lapis-notes/packages/file-explorer" },
  ],
  [
    "@lapis-notes/markdown",
    { protocol: "file:", path: "../lapis-plugins/packages/markdown" },
  ],
  [
    "@lapis-notes/search",
    { protocol: "file:", path: "../lapis-plugins/packages/search" },
  ],
  [
    "@lapis-notes/ui",
    { protocol: "file:", path: "../lapis-notes/packages/ui" },
  ],
  [
    "@lapis-notes/workspace",
    { protocol: "file:", path: "../lapis-notes/packages/workspace" },
  ],
]);

function createHooks({
  root = path.resolve(__dirname, ".."),
  fileExists = existsSync,
} = {}) {
  const availableLocalPackages = new Map(
    [...localPackages].flatMap(([packageName, localPackage]) => {
      const packagePath = path.resolve(root, localPackage.path);
      return fileExists(packagePath)
        ? [[packageName, `${localPackage.protocol}${packagePath}`]]
        : [];
    }),
  );

  return {
    hooks: {
      readPackage(packageManifest) {
        for (const field of [
          "dependencies",
          "devDependencies",
          "optionalDependencies",
        ]) {
          const dependencies = packageManifest[field];
          if (!dependencies) continue;
          for (const [packageName, localPackage] of availableLocalPackages) {
            if (dependencies[packageName]) {
              dependencies[packageName] = localPackage;
            }
          }
        }
        return packageManifest;
      },
    },
  };
}

module.exports = { createHooks };
