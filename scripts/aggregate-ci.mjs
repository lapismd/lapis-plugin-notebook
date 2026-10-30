import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function validateCiResults(jobs) {
  if (!jobs || Object.keys(jobs).length === 0)
    throw Error("No CI lane results supplied");
  for (const [name, job] of Object.entries(jobs)) {
    if (job.result !== "success")
      throw Error(`Required CI lane ${name}: ${job.result}`);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  validateCiResults(JSON.parse(process.env.CI_JOB_RESULTS));
  console.log("All blocking Notebook validation lanes passed.");
}
