import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export const REGISTRY_MEDIA_DIMENSIONS = Object.freeze({
  capture: { width: 2400, height: 1600 },
  full: { width: 2400, height: 1600 },
  preview: { width: 1200, height: 800 },
});

export const REGISTRY_MEDIA_SCREENSHOT_RIGHT_GUTTER = 48;

export const REGISTRY_MEDIA_TONES = Object.freeze({
  neutral: "#F7F5FA",
  violet: "#B9A0FF",
  cyan: "#71E5F2",
  green: "#8EE6A8",
  amber: "#FFD477",
  rose: "#FFA1B7",
});

const CANVAS = REGISTRY_MEDIA_DIMENSIONS.full;
const FULL_SHELL_SCREENSHOT = Object.freeze({
  width: 1440,
  height: 960,
  radius: 16,
});
const FOCUSED_SCREENSHOT = Object.freeze({
  width: 1440,
  height: 1280,
  radius: 16,
});
const BACKGROUND = "#000000";
const MUTED = "#C7C0CC";
const DESCRIPTION_TONES = Object.freeze({
  ...REGISTRY_MEDIA_TONES,
  neutral: MUTED,
});
const FOCUS_CROPS = Object.freeze({
  "full-shell": { x: 0, y: 0, width: 1, height: 1 },
  "left-sidebar": { x: 0, y: 0, width: 0.75, height: 1 },
  "right-sidebar": { x: 0.25, y: 0, width: 0.75, height: 1 },
  "bottom-status": { x: 0, y: 0.2, width: 1, height: 0.8 },
});

export async function composeRegistryMedia({
  lightSource,
  darkSource,
  focus,
  card,
  fontPath,
}) {
  const { headline, description } = validateRegistryCardCopy(card);
  const light = await composeRegistryCardTheme({
    source: lightSource,
    focus,
    headline,
    description,
    fontPath,
  });
  const dark = await composeRegistryCardTheme({
    source: darkSource,
    focus,
    headline,
    description,
    fontPath,
  });
  const full = await composeDiagonalSplit({
    light,
    dark,
    bounds: resolveRegistryScreenshotBounds(focus),
  });
  const preview = await createPreview(full);

  for (const [variant, bytes] of Object.entries({
    preview,
    full,
    light,
    dark,
  })) {
    await assertDimensions(
      bytes,
      variant === "preview"
        ? REGISTRY_MEDIA_DIMENSIONS.preview
        : REGISTRY_MEDIA_DIMENSIONS.full,
      variant
    );
  }
  return { preview, full, light, dark };
}

export async function composeRegistryProductMedia({ lightSource, darkSource }) {
  await Promise.all([
    assertCapture(lightSource, "light"),
    assertCapture(darkSource, "dark"),
  ]);
  const light = await sharp(lightSource)
    .webp({ lossless: true, effort: 6 })
    .toBuffer();
  const dark = await sharp(darkSource)
    .webp({ lossless: true, effort: 6 })
    .toBuffer();
  const full = await composeDiagonalSplit({ light, dark });
  const preview = await createPreview(full);
  for (const [variant, bytes] of Object.entries({
    preview,
    full,
    light,
    dark,
  })) {
    await assertDimensions(
      bytes,
      variant === "preview"
        ? REGISTRY_MEDIA_DIMENSIONS.preview
        : REGISTRY_MEDIA_DIMENSIONS.full,
      variant
    );
  }
  return { preview, full, light, dark };
}

async function composeRegistryCardTheme({
  source,
  focus,
  headline,
  description,
  fontPath,
}) {
  const metadata = await assertCapture(source, "registry");
  const crop = resolveFocusCrop(focus);
  const pixels = {
    left: Math.round(crop.x * metadata.width),
    top: Math.round(crop.y * metadata.height),
    width: Math.round(crop.width * metadata.width),
    height: Math.round(crop.height * metadata.height),
  };
  pixels.width = Math.min(pixels.width, metadata.width - pixels.left);
  pixels.height = Math.min(pixels.height, metadata.height - pixels.top);
  const screenshotFrame = resolveRegistryScreenshotFrame(focus);
  const screenshotBounds = resolveRegistryScreenshotBounds(focus);
  const coverScale = Math.max(
    screenshotFrame.width / pixels.width,
    screenshotFrame.height / pixels.height
  );
  if (coverScale > 1) {
    throw new Error(
      `Focus crop ${pixels.width}x${pixels.height} would upscale to ${screenshotFrame.width}x${screenshotFrame.height}.`
    );
  }

  const positions = {
    copyX: 80,
    screenshotX: screenshotBounds.left,
  };
  const screenshotY = screenshotBounds.top;

  const screenshot = await sharp(source)
    .extract(pixels)
    .resize(screenshotFrame.width, screenshotFrame.height, {
      fit: "cover",
      position: focusPosition(focus),
      withoutEnlargement: true,
      kernel: sharp.kernel.lanczos3,
    })
    .composite([
      {
        input: Buffer.from(
          `<svg width="${screenshotFrame.width}" height="${screenshotFrame.height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" rx="${screenshotFrame.radius}" fill="#fff"/></svg>`
        ),
        blend: "dest-in",
      },
    ])
    .png({ compressionLevel: 9, adaptiveFiltering: false })
    .toBuffer();

  const font = await readFile(fontPath);
  const background = Buffer.from(
    renderCardSvg({
      fontBase64: font.toString("base64"),
      headline,
      description,
      copyX: positions.copyX,
      screenshotX: positions.screenshotX,
      screenshotY,
      screenshotFrame,
    })
  );
  return sharp(background, {
    density: 72,
    limitInputPixels: 4_000_000,
  })
    .composite([
      {
        input: screenshot,
        left: positions.screenshotX,
        top: screenshotY,
      },
      {
        input: Buffer.from(
          `<svg width="${screenshotFrame.width}" height="${
            screenshotFrame.height
          }" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="${
            screenshotFrame.width - 2
          }" height="${screenshotFrame.height - 2}" rx="${
            screenshotFrame.radius
          }" fill="none" stroke="#FFFFFF" stroke-opacity="0.16" stroke-width="2"/></svg>`
        ),
        left: positions.screenshotX,
        top: screenshotY,
      },
    ])
    .webp({ lossless: true, effort: 6 })
    .toBuffer();
}

async function assertCapture(source, label) {
  const metadata = await sharp(source, {
    failOn: "warning",
    limitInputPixels: 4_000_000,
  }).metadata();
  if (
    metadata.width !== REGISTRY_MEDIA_DIMENSIONS.capture.width ||
    metadata.height !== REGISTRY_MEDIA_DIMENSIONS.capture.height
  ) {
    throw new Error(
      `${label} capture is ${metadata.width}x${metadata.height}; expected 2400x1600.`
    );
  }
  return metadata;
}

async function composeDiagonalSplit({
  light,
  dark,
  bounds = {
    left: 0,
    top: 0,
    width: REGISTRY_MEDIA_DIMENSIONS.full.width,
    height: REGISTRY_MEDIA_DIMENSIONS.full.height,
  },
}) {
  const { width, height } = REGISTRY_MEDIA_DIMENSIONS.full;
  const right = bounds.left + bounds.width;
  const bottom = bounds.top + bounds.height;
  const mask = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><polygon points="${right},${bounds.top} ${right},${bottom} ${bounds.left},${bottom}" fill="#fff"/></svg>`
  );
  const lightRegion = await sharp(light)
    .ensureAlpha()
    .composite([{ input: mask, blend: "dest-in" }])
    .png({ compressionLevel: 9, adaptiveFiltering: false })
    .toBuffer();
  return sharp(dark)
    .composite([{ input: lightRegion, left: 0, top: 0 }])
    .webp({ lossless: true, effort: 6 })
    .toBuffer();
}

async function createPreview(full) {
  return sharp(full)
    .resize(
      REGISTRY_MEDIA_DIMENSIONS.preview.width,
      REGISTRY_MEDIA_DIMENSIONS.preview.height,
      { kernel: sharp.kernel.lanczos3 }
    )
    .webp({ lossless: true, effort: 6 })
    .toBuffer();
}

export function resolveFocusCrop(focus) {
  if (typeof focus === "string") {
    const preset = FOCUS_CROPS[focus];
    if (!preset)
      throw new Error(`Unknown registry media focus preset ${focus}.`);
    return preset;
  }
  const values = focus && typeof focus === "object" ? focus : {};
  const crop = {
    x: values.x,
    y: values.y,
    width: values.width,
    height: values.height,
  };
  for (const [key, value] of Object.entries(crop)) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(`Custom focus ${key} must be a finite number.`);
    }
  }
  if (
    crop.x < 0 ||
    crop.y < 0 ||
    crop.width <= 0 ||
    crop.height <= 0 ||
    crop.x + crop.width > 1 ||
    crop.y + crop.height > 1
  ) {
    throw new Error(
      "Custom focus must be a normalized rectangle inside the capture."
    );
  }
  return crop;
}

export function resolveRegistryScreenshotFrame(focus) {
  return focus === "full-shell" ? FULL_SHELL_SCREENSHOT : FOCUSED_SCREENSHOT;
}

export function resolveRegistryScreenshotBounds(focus) {
  const frame = resolveRegistryScreenshotFrame(focus);
  return {
    left: CANVAS.width - frame.width - REGISTRY_MEDIA_SCREENSHOT_RIGHT_GUTTER,
    top: Math.round((CANVAS.height - frame.height) / 2),
    width: frame.width,
    height: frame.height,
  };
}

export function validateRegistryCardCopy(card) {
  return {
    headline: layoutHeadline(card.headline),
    description: layoutDescription(card.description),
  };
}

function focusPosition(focus) {
  if (focus === "full-shell") return "centre";
  if (focus === "left-sidebar") return "left";
  if (focus === "right-sidebar") return "right";
  if (focus === "bottom-status") return "southeast";
  return "centre";
}

function layoutHeadline(segments) {
  const lines = [];
  for (const segment of segments) {
    if (
      !segment ||
      typeof segment.text !== "string" ||
      !segment.text.trim() ||
      segment.text.length > 60 ||
      /[#*`<>]/.test(segment.text) ||
      !Object.hasOwn(REGISTRY_MEDIA_TONES, segment.tone)
    ) {
      throw new Error("Headline contains an invalid text segment.");
    }
    for (const text of wrapText(segment.text, 11, 3)) {
      lines.push({ text, tone: segment.tone });
    }
  }
  if (lines.length < 1 || lines.length > 4) {
    throw new Error(
      `Headline requires 1-4 rendered lines; found ${lines.length}.`
    );
  }
  return lines;
}

function layoutDescription(segments) {
  if (!Array.isArray(segments) || segments.length < 1 || segments.length > 6) {
    throw new Error("Description requires 1-6 rendered segments.");
  }
  let sourceLength = Math.max(0, segments.length - 1);
  const words = [];
  for (const segment of segments) {
    if (
      !segment ||
      typeof segment.text !== "string" ||
      !segment.text.trim() ||
      segment.text.length > 120 ||
      /[#*`<>]/.test(segment.text) ||
      !Object.hasOwn(DESCRIPTION_TONES, segment.tone)
    ) {
      throw new Error("Description contains an invalid text segment.");
    }
    sourceLength += segment.text.length;
    for (const text of segment.text.trim().split(/\s+/).filter(Boolean)) {
      words.push({ text, tone: segment.tone });
    }
  }
  if (sourceLength > 180) {
    throw new Error("Description exceeds 180 characters.");
  }

  const lines = [];
  let line = [];
  let lineText = "";
  for (const word of words) {
    if (textUnits(word.text) > 21) {
      throw new Error(
        `Text token ${JSON.stringify(word.text)} is too wide for the card.`
      );
    }
    const candidate = lineText ? `${lineText} ${word.text}` : word.text;
    if (line.length && textUnits(candidate) > 21) {
      lines.push(line);
      line = [];
      lineText = "";
    }
    const previous = line.at(-1);
    if (previous?.tone === word.tone) {
      previous.text += ` ${word.text}`;
    } else {
      line.push({
        text: line.length ? ` ${word.text}` : word.text,
        tone: word.tone,
      });
    }
    lineText = lineText ? `${lineText} ${word.text}` : word.text;
  }
  if (line.length) lines.push(line);
  if (lines.length > 4) {
    throw new Error(
      `Text overflows the card (${lines.length} lines, maximum 4).`
    );
  }
  return lines;
}

function wrapText(value, maximumUnits, maximumLines) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  for (const word of words) {
    if (textUnits(word) > maximumUnits) {
      throw new Error(
        `Text token ${JSON.stringify(word)} is too wide for the card.`
      );
    }
    const candidate = current ? `${current} ${word}` : word;
    if (textUnits(candidate) <= maximumUnits) current = candidate;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  if (lines.length > maximumLines) {
    throw new Error(
      `Text overflows the card (${lines.length} lines, maximum ${maximumLines}).`
    );
  }
  return lines;
}

function textUnits(value) {
  return [...value].reduce((total, character) => {
    if (character === " ") return total + 0.42;
    if (/[MW@%]/.test(character)) return total + 1.3;
    if (/[ilI1.,'!]/.test(character)) return total + 0.42;
    if (/[A-Z0-9]/.test(character)) return total + 0.95;
    return total + 0.78;
  }, 0);
}

function renderCardSvg({
  fontBase64,
  headline,
  description,
  copyX,
  screenshotX,
  screenshotY,
  screenshotFrame,
}) {
  const headlineStep = 132;
  const descriptionStep = 68;
  const eyebrowToHeadline = 170;
  const headlineToDescription = 126;
  const finalBaselineOffset =
    eyebrowToHeadline +
    (headline.length - 1) * headlineStep +
    headlineToDescription +
    (description.length - 1) * descriptionStep;
  const eyebrowY = CANVAS.height / 2 - (finalBaselineOffset - 10) / 2;
  const headlineStart = eyebrowY + eyebrowToHeadline;
  const headlineSvg = headline
    .map(
      (line, index) =>
        `<text x="${copyX}" y="${headlineStart + index * headlineStep}" fill="${
          REGISTRY_MEDIA_TONES[line.tone]
        }" class="headline">${escapeXml(line.text)}</text>`
    )
    .join("");
  const descriptionStart =
    headlineStart +
    (headline.length - 1) * headlineStep +
    headlineToDescription;
  const descriptionSvg = description
    .map(
      (line, index) =>
        `<text x="${copyX}" y="${
          descriptionStart + index * descriptionStep
        }" class="description" xml:space="preserve">${line
          .map(
            (segment) =>
              `<tspan fill="${DESCRIPTION_TONES[segment.tone]}">${escapeXml(
                segment.text
              )}</tspan>`
          )
          .join("")}</text>`
    )
    .join("");
  const shadowX = screenshotX + 16;
  const shadowY = screenshotY + 26;
  return `<svg width="${CANVAS.width}" height="${CANVAS.height}" viewBox="0 0 ${
    CANVAS.width
  } ${CANVAS.height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <style>
        @font-face { font-family: "Registry Inter"; src: url(data:font/woff2;base64,${fontBase64}) format("woff2"); font-style: normal; font-weight: 100 900; }
        .eyebrow { font-family: "Registry Inter"; font-size: 28px; font-weight: 700; letter-spacing: 4.5px; }
        .headline { font-family: "Registry Inter"; font-size: 112px; font-weight: 700; letter-spacing: -4px; }
        .description { font-family: "Registry Inter"; font-size: 52px; font-weight: 600; }
      </style>
      <radialGradient id="glow" cx="50%" cy="50%" r="50%">
        <stop offset="0" stop-color="#7C3AED" stop-opacity="0.2"/>
        <stop offset="1" stop-color="#7C3AED" stop-opacity="0"/>
      </radialGradient>
      <filter id="shadow" x="-30%" y="-30%" width="160%" height="170%">
        <feGaussianBlur stdDeviation="30"/>
      </filter>
    </defs>
    <rect width="2400" height="1600" fill="${BACKGROUND}"/>
    <ellipse cx="${screenshotX + screenshotFrame.width / 2}" cy="${
    screenshotY + screenshotFrame.height / 2
  }" rx="940" ry="760" fill="url(#glow)"/>
    <rect x="${shadowX}" y="${shadowY}" width="${
    screenshotFrame.width
  }" height="${screenshotFrame.height}" rx="${
    screenshotFrame.radius
  }" fill="#000" fill-opacity="0.72" filter="url(#shadow)"/>
    <text x="${copyX}" y="${eyebrowY}" fill="#8F8798" class="eyebrow">LAPIS PLUGIN</text>
    ${headlineSvg}
    ${descriptionSvg}
  </svg>`;
}

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

async function assertDimensions(bytes, expected, label) {
  const metadata = await sharp(bytes).metadata();
  if (metadata.format !== "webp") {
    throw new Error(`${label} registry media is not WebP.`);
  }
  if (
    metadata.width !== expected.width ||
    metadata.height !== expected.height
  ) {
    throw new Error(
      `${label} registry media is ${metadata.width}x${metadata.height}; expected ${expected.width}x${expected.height}.`
    );
  }
}

export function defaultRegistryMediaFontPath(root) {
  return path.join(
    root,
    "node_modules",
    "@fontsource-variable",
    "inter",
    "files",
    "inter-latin-wght-normal.woff2"
  );
}
