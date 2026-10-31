/** Bound production build old space within the CI container's 7 GiB budget. */
export function productionBuildArguments(vite) {
  return ["--max-old-space-size=4096", vite, "build"];
}
