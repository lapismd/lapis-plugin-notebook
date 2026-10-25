/// <reference path="./d3-shim.d.ts" />

export type NotebookHtlTemplateTag = ((
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Node | null) & {
  fragment: (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ) => DocumentFragment;
};

export interface NotebookDomUid {
  id: string;
  href: string;
  toString(): string;
}

export interface NotebookStdlibDomNamespace {
  canvas(width: number, height: number): HTMLCanvasElement;
  context2d(
    width: number,
    height: number,
    dpi?: number,
  ): CanvasRenderingContext2D;
  download(
    value: Blob | Promise<Blob> | (() => Blob | Promise<Blob>),
    name?: string,
    label?: string,
  ): HTMLAnchorElement;
  uid(name?: string): NotebookDomUid;
}

export interface NotebookStdlibDomRuntime {
  DOM: NotebookStdlibDomNamespace;
  html: NotebookHtlTemplateTag;
  svg: NotebookHtlTemplateTag;
}

let uidCount = 0;

export const DOM = Object.freeze({
  canvas,
  context2d,
  download,
  uid,
});

export async function loadNotebookStdlibDomRuntime(): Promise<NotebookStdlibDomRuntime> {
  const htl = await import("htl");

  return {
    DOM,
    html: htl.html,
    svg: htl.svg,
  };
}

export function canvas(width: number, height: number): HTMLCanvasElement {
  const element = requireDocument("DOM.canvas").createElement(
    "canvas",
  ) as HTMLCanvasElement;
  element.width = width;
  element.height = height;
  return element;
}

export function context2d(
  width: number,
  height: number,
  dpi = requireDevicePixelRatio(),
): CanvasRenderingContext2D {
  const element = canvas(width * dpi, height * dpi);
  element.style.width = `${width}px`;
  element.style.height = `${height}px`;
  const context = element.getContext("2d");
  if (!context) {
    throw new Error("DOM.context2d could not create a 2D rendering context");
  }
  context.scale(dpi, dpi);
  return context;
}

export function download(
  value: Blob | Promise<Blob> | (() => Blob | Promise<Blob>),
  name = "untitled",
  label = "Save",
): HTMLAnchorElement {
  const ownerDocument = requireDocument("DOM.download");
  const anchor = ownerDocument.createElement("a") as HTMLAnchorElement;
  const button = anchor.appendChild(ownerDocument.createElement("button"));
  button.textContent = label;
  anchor.download = name;

  async function reset(): Promise<void> {
    await deferAnimationFrame();
    if (anchor.href) {
      URL.revokeObjectURL(anchor.href);
    }
    anchor.removeAttribute("href");
    button.textContent = label;
    button.disabled = false;
  }

  anchor.onclick = async (event) => {
    button.disabled = true;
    if (anchor.href) {
      await reset();
      return;
    }
    button.textContent = "Saving...";
    try {
      const object = await (typeof value === "function" ? value() : value);
      button.textContent = "Download";
      anchor.href = URL.createObjectURL(object);
    } catch {
      button.textContent = label;
    }
    if (event.eventPhase) {
      await reset();
      return;
    }
    button.disabled = false;
  };

  return anchor;
}

export function uid(name?: string): NotebookDomUid {
  const id = `O-${name == null ? "" : `${name}-`}${++uidCount}`;
  const href = new URL(`#${id}`, requireLocationHref()).toString();
  return {
    id,
    href,
    toString() {
      return `url(${href})`;
    },
  };
}

function requireDocument(apiName: string): Document {
  if (typeof document === "undefined") {
    throw new Error(`${apiName} requires the notebook DOM runtime`);
  }
  return document;
}

function requireDevicePixelRatio(): number {
  return typeof devicePixelRatio === "number" ? devicePixelRatio : 1;
}

function requireLocationHref(): string {
  return typeof location === "undefined" ? "http://localhost/" : location.href;
}

function deferAnimationFrame(): Promise<void> {
  if (typeof requestAnimationFrame === "function") {
    return new Promise((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }
  return Promise.resolve();
}
