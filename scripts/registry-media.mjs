import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve, extname, sep } from "node:path";
import { captureSubjectWithBrowser } from "@lapismd/storybook-addon-visual-delta/node";
import {
  composeRegistryMedia,
  composeRegistryProductMedia,
  defaultRegistryMediaFontPath,
} from "./vendor/lapis-plugins/scripts/registry-media-compositor.mjs";

export function mediaCaptures(source, name) {
  const roles = Object.entries(source.media ?? {}).map(([role, item]) => ({
    role,
    ...item,
  }));
  const captures = [
    ...roles,
    ...(source.gallery ?? []).map((item) => ({ role: "gallery", ...item })),
  ];
  if (
    !source.media?.banner ||
    !source.gallery?.length ||
    source.gallery.length > 5
  )
    throw Error(
      "Registry media requires a banner and one to five distinct gallery cards",
    );
  for (const item of captures) {
    const base = item.role === "gallery" ? `gallery/${item.id}` : item.role;
    if (
      !item.alt?.trim() ||
      !item.capture?.storyId?.startsWith(
        `plugins-${name.toLowerCase()}-registry-screenshots--`,
      )
    )
      throw Error(
        "Registry media must declare alt text and a fixed owned story",
      );
    for (const variant of ["preview", "full", "light", "dark"])
      if (
        item.images?.[variant]?.path !==
        `registry-assets/${base}.${variant}.webp`
      )
        throw Error("Unsafe or inconsistent registry media output");
  }
  return captures;
}

async function run() {
  const check = process.argv.includes("--check");
  const root = process.cwd();
  const source = JSON.parse(await readFile("registry.json", "utf8"));
  const manifest = JSON.parse(await readFile("manifest.json", "utf8"));
  const captures = mediaCaptures(source, manifest.name);
  await new Promise((done, reject) => {
    const child = spawn(
      "pnpm",
      [
        "exec",
        "storybook",
        "build",
        "--output-dir",
        "storybook-static",
        "--quiet",
      ],
      { stdio: "inherit" },
    );
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? done() : reject(Error(`Storybook build exited ${code}`)),
    );
  });
  const directory = resolve("storybook-static");
  const catalog = JSON.parse(
    await readFile(resolve(directory, "index.json"), "utf8"),
  );
  const server = createServer(async (request, response) => {
    try {
      const file = resolve(
        directory,
        "." +
          decodeURIComponent(new URL(request.url, "http://localhost").pathname),
      );
      if (!file.startsWith(directory + sep)) throw Error("Unsafe static path");
      const bytes = await readFile(file);
      response.setHeader(
        "Content-Type",
        {
          ".js": "text/javascript",
          ".mjs": "text/javascript",
          ".css": "text/css",
          ".html": "text/html",
          ".json": "application/json",
          ".wasm": "application/wasm",
          ".svg": "image/svg+xml",
          ".woff2": "font/woff2",
        }[extname(file)] ?? "application/octet-stream",
      );
      response.end(bytes);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const cached = new Map();
  const capture = async (storyId, theme) => {
    const key = `${storyId}:${theme}`;
    if (!cached.has(key)) {
      const result = await captureSubjectWithBrowser({
        origin,
        storyId,
        viewport: { width: 1200, height: 800 },
        deviceScaleFactor: 2,
        cropToViewport: true,
        globals: `colorMode:${theme};theme:lapis`,
        browser: "chromium",
      });
      if (!result.ok) throw Error(result.error);
      if (result.width !== 2400 || result.height !== 1600)
        throw Error("Unexpected registry capture dimensions");
      cached.set(key, Buffer.from(result.pngBase64, "base64"));
    }
    return cached.get(key);
  };
  try {
    await stat(defaultRegistryMediaFontPath(root));
    for (const item of captures) {
      const story = catalog.entries[item.capture.storyId];
      if (
        story?.type !== "story" ||
        story.title !== `Plugins/${manifest.name}/Registry Screenshots` ||
        !["registry-media", "visual-pending"].every((tag) =>
          story.tags.includes(tag),
        )
      )
        throw Error(`Missing governed registry story: ${item.capture.storyId}`);
      const lightSource = await capture(story.id, "light");
      const darkSource = await capture(story.id, "dark");
      if (lightSource.equals(darkSource))
        throw Error("Light and dark captures are identical");
      const images =
        item.role === "gallery"
          ? await composeRegistryMedia({
              lightSource,
              darkSource,
              focus: item.capture.focus,
              card: item.card,
              fontPath: defaultRegistryMediaFontPath(root),
            })
          : await composeRegistryProductMedia({ lightSource, darkSource });
      for (const [variant, bytes] of Object.entries(images)) {
        const file = item.images[variant].path;
        if (check) {
          const current = await readFile(file);
          if (!bytes.equals(current))
            throw Error(`Stale registry media: ${file}`);
        } else {
          await mkdir(dirname(file), { recursive: true });
          await writeFile(file, bytes);
        }
        console.log(`${check ? "Verified" : "Generated"} ${file}`);
      }
    }
  } finally {
    server.closeAllConnections();
    await new Promise((done) => server.close(done));
  }
}
if (process.argv[1]?.endsWith("/registry-media.mjs"))
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
