import { spawn } from "node:child_process";
/** Called inside the owned worker; graceful stop allows its receipt to finish. */
export function serveReview(root) {
  return new Promise((resolve, reject) => {
    let stopping = false;
    const child = spawn(
      "pnpm",
      ["storybook", "--host", "0.0.0.0", "--port", "6006"],
      {
        cwd: root,
        stdio: "inherit",
        detached: true,
        env: {
          ...process.env,
          STORYBOOK_PORT: "6006",
          STORYBOOK_DISABLE_TELEMETRY: "1",
        },
      },
    );
    const stop = () => {
      stopping = true;
      if (child.pid) {
        try {
          process.kill(-child.pid, "SIGTERM");
        } catch (error) {
          if (error.code !== "ESRCH") reject(error);
        }
      }
    };
    process.once("SIGTERM", stop);
    process.once("SIGINT", stop);
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      process.removeListener("SIGTERM", stop);
      process.removeListener("SIGINT", stop);
      if (stopping || code === 0) resolve();
      else reject(Error(`Review Storybook exited ${code ?? signal}`));
    });
  });
}
