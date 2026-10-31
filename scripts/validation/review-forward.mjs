import { spawn, execFileSync } from "node:child_process";
/** Forward only this review's loopback endpoint when the daemon is remote. */
export async function forwardReview(config, port) {
  const endpoint = new URL(
    execFileSync(
      "docker",
      [
        ...(config.context ? ["--context", config.context] : []),
        "context",
        "inspect",
        ...(config.context ? [config.context] : []),
        "--format",
        "{{.Endpoints.docker.Host}}",
      ],
      { encoding: "utf8" },
    ).trim(),
  );
  if (endpoint.protocol !== "ssh:") {
    console.log(`Review: http://127.0.0.1:${port}`);
    return () => {};
  }
  if (
    !/^[\w.-]+$/.test(endpoint.hostname) ||
    !/^[\w.-]+$/.test(decodeURIComponent(endpoint.username)) ||
    endpoint.password
  )
    throw Error("Unsupported review SSH endpoint");
  const child = spawn(
    "ssh",
    [
      "-N",
      "-T",
      "-o",
      "BatchMode=yes",
      "-o",
      "ExitOnForwardFailure=yes",
      "-L",
      `127.0.0.1:${port}:127.0.0.1:${port}`,
      ...(endpoint.port ? ["-p", endpoint.port] : []),
      `${decodeURIComponent(endpoint.username)}@${endpoint.hostname}`,
    ],
    { stdio: ["ignore", "ignore", "inherit"] },
  );
  await new Promise((resolve, reject) => {
    const ready = setTimeout(resolve, 1000);
    child.once("error", (error) => {
      clearTimeout(ready);
      reject(error);
    });
    child.once("exit", (code) => {
      clearTimeout(ready);
      reject(Error(`Review tunnel exited ${code}`));
    });
  });
  console.log(`Review: http://127.0.0.1:${port}`);
  return () => child.kill("SIGTERM");
}
