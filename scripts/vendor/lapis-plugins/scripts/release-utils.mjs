import fs from "node:fs/promises";
import path from "node:path";

const RELEASE_VERSION_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*))*))?$/;

export function assertReleaseVersion(version) {
  if (typeof version !== "string" || version.trim() !== version || !version) {
    throw new Error("Release version must be a non-empty trimmed string.");
  }

  if (version.startsWith("v")) {
    throw new Error("Release version must not include a leading v prefix.");
  }

  if (!RELEASE_VERSION_PATTERN.test(version)) {
    throw new Error(
      "Release version must be semver like 1.2.3 or 1.2.3-beta.1, without build metadata.",
    );
  }

  return version;
}

export async function readPackageVersion(packageJsonPath) {
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8"));
  if (typeof packageJson.version !== "string") {
    throw new Error(`Missing version in ${packageJsonPath}`);
  }
  return packageJson.version;
}

export async function assertPackageVersionMatches(version, packageJsonPath) {
  const expectedVersion = assertReleaseVersion(version);
  const packageVersion = await readPackageVersion(packageJsonPath);

  if (packageVersion !== expectedVersion) {
    throw new Error(
      `Release version ${expectedVersion} does not match ${packageJsonPath} version ${packageVersion}.`,
    );
  }

  return expectedVersion;
}

export async function resolveReleaseVersion(version, packageJsonPath) {
  const trimmed = typeof version === "string" ? version.trim() : "";
  if (!trimmed) {
    return assertReleaseVersion(await readPackageVersion(packageJsonPath));
  }

  return assertPackageVersionMatches(trimmed, packageJsonPath);
}

export function buildDesktopReleaseAssetNames(version) {
  const releaseVersion = assertReleaseVersion(version);

  return {
    macArm64Dmg: `Lapis-Notes-${releaseVersion}-mac-arm64.dmg`,
    macX64Dmg: `Lapis-Notes-${releaseVersion}-mac-x64.dmg`,
    macArm64Zip: `Lapis-Notes-${releaseVersion}-mac-arm64.zip`,
    macX64Zip: `Lapis-Notes-${releaseVersion}-mac-x64.zip`,
    linuxX64TarGz: `Lapis-Notes-${releaseVersion}-linux-x64.tar.gz`,
    linuxX64AppImage: `Lapis-Notes-${releaseVersion}-linux-x64.AppImage`,
  };
}

export function buildLinuxX64AppImageAliases(version) {
  const names = buildDesktopReleaseAssetNames(version);

  return {
    canonical: names.linuxX64AppImage,
    x86_64: `Lapis-Notes-${assertReleaseVersion(version)}-linux-x86_64.AppImage`,
  };
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function normalizeLinuxAppImageArtifact(
  releaseDir,
  version,
  artifactPaths = null,
) {
  const { canonical, x86_64 } = buildLinuxX64AppImageAliases(version);
  const canonicalPath = path.join(releaseDir, canonical);

  if (await pathExists(canonicalPath)) {
    return canonicalPath;
  }

  const x86Path = path.join(releaseDir, x86_64);
  if (await pathExists(x86Path)) {
    await fs.rename(x86Path, canonicalPath);
    if (Array.isArray(artifactPaths)) {
      const index = artifactPaths.indexOf(x86Path);
      if (index !== -1) {
        artifactPaths[index] = canonicalPath;
      }
    }
    return canonicalPath;
  }

  const entries = await fs.readdir(releaseDir);
  const fallbackName = entries.find((entry) => entry.endsWith(".AppImage"));
  if (!fallbackName) {
    throw new Error(
      `Linux AppImage artifact is missing from ${releaseDir}. Found: ${entries.join(", ") || "(empty)"}`,
    );
  }

  const fallbackPath = path.join(releaseDir, fallbackName);
  if (fallbackName !== canonical) {
    await fs.rename(fallbackPath, canonicalPath);
    if (Array.isArray(artifactPaths)) {
      const index = artifactPaths.indexOf(fallbackPath);
      if (index !== -1) {
        artifactPaths[index] = canonicalPath;
      }
    }
  }

  return canonicalPath;
}

export async function stageLinuxDesktopArtifacts({
  version,
  releaseDir,
  artifactDir,
}) {
  const names = buildDesktopReleaseAssetNames(version);
  await fs.mkdir(artifactDir, { recursive: true });

  const tarGzSource = path.join(releaseDir, names.linuxX64TarGz);
  if (!(await pathExists(tarGzSource))) {
    const entries = await fs.readdir(releaseDir);
    throw new Error(
      `Linux tarball artifact is missing from ${releaseDir}. Found: ${entries.join(", ") || "(empty)"}`,
    );
  }

  await fs.copyFile(tarGzSource, path.join(artifactDir, names.linuxX64TarGz));

  const appImageSource = await normalizeLinuxAppImageArtifact(
    releaseDir,
    version,
  );
  const stagedAppImagePath = path.join(artifactDir, names.linuxX64AppImage);
  if (appImageSource === stagedAppImagePath) {
    return;
  }

  await fs.copyFile(appImageSource, stagedAppImagePath);
}

export function parseGithubRepository(repository) {
  if (typeof repository !== "string" || !repository.trim()) {
    throw new Error("GitHub repository must be owner/name.");
  }

  const parts = repository.trim().split("/");
  if (parts.length !== 2 || parts.some((part) => !part)) {
    throw new Error("GitHub repository must be owner/name.");
  }

  return { owner: parts[0], name: parts[1] };
}

const defaultGithubReleasesRepository = "lapis-notes/releases";

export function defaultGithubReleasesRepositorySlug() {
  return defaultGithubReleasesRepository;
}

export function buildGithubReleaseTag({ kind, version, releaseTag }) {
  if (kind === "desktop") {
    return `app-v${assertReleaseVersion(version)}`;
  }

  if (kind === "plugin-batch") {
    if (typeof releaseTag !== "string" || !releaseTag.trim()) {
      throw new Error("Plugin batch GitHub tag requires releaseTag.");
    }
    return releaseTag.trim();
  }

  throw new Error(`Unsupported GitHub release tag kind: ${kind}`);
}

export function buildGithubReleaseDownloadUrl(options) {
  const repository =
    options.repository ??
    process.env["LAPIS_RELEASES_GITHUB_REPOSITORY"] ??
    defaultGithubReleasesRepository;
  const { owner, name } = parseGithubRepository(repository);
  const tag = options.tag;
  if (typeof tag !== "string" || !tag.trim()) {
    throw new Error("GitHub release tag is required.");
  }

  if (typeof options.assetName !== "string" || !options.assetName) {
    throw new Error("Asset name is required.");
  }

  return [
    "https://github.com",
    encodeURIComponent(owner),
    encodeURIComponent(name),
    "releases",
    "download",
    encodeURIComponent(tag),
    encodeURIComponent(options.assetName),
  ].join("/");
}

export function parseBooleanInput(value, defaultValue = false) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "n", "off"].includes(normalized)) {
    return false;
  }

  throw new Error(`Invalid boolean input: ${value}`);
}

export function logProgress(message) {
  process.stderr.write(`${message}\n`);
}

export function formatByteSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "0 B";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ["KiB", "MiB", "GiB", "TiB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${Number.isInteger(value) || value >= 10 ? Math.round(value).toString() : value.toFixed(1)} ${units[unitIndex]}`;
}
