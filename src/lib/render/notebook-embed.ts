import { diagnosticResourceForPath, type Plugin } from "@lapis-notes/api";
import { mount, unmount } from "svelte";
import { isNotebookFile } from "../notebook-file";
import NotebookEmbed from "./notebook-embed.svelte";

export function registerNotebookEmbeds(plugin: Plugin): void {
  const diagnostics = plugin.createDiagnosticCollection("embeds", {
    label: "Notebook embeds",
  });
  const active = new Set<() => Promise<void>>();
  plugin.registerMarkdownEmbedder(({ app, containerEl, file }) => {
    if (!isNotebookFile(file)) return false;
    let diagnosticPath = file.path;
    let component: ReturnType<typeof mount> | undefined;
    let observer: MutationObserver | undefined;
    let disposed = false;
    const start = () => {
      if (disposed || component || !containerEl.isConnected) return;
      observer?.disconnect();
      observer = undefined;
      let recursive = false;
      for (
        let parent = containerEl.parentElement;
        parent;
        parent = parent.parentElement
      ) {
        if (parent.dataset.notebookEmbed === file.path) {
          recursive = true;
          break;
        }
      }
      component = mount(NotebookEmbed, {
        target: containerEl,
        props: {
          app,
          file,
          recursive,
          onError: (path: string, error?: string) => {
            if (diagnosticPath !== path)
              diagnostics.delete(diagnosticResourceForPath(diagnosticPath));
            diagnosticPath = path;
            const resource = diagnosticResourceForPath(path);
            if (error)
              diagnostics.set(resource, [
                {
                  message: error,
                  severity: "error",
                  source: "Notebook",
                  code: "embed",
                },
              ]);
            else diagnostics.delete(resource);
          },
        },
      });
    };
    const destroy = async () => {
      if (disposed) return;
      disposed = true;
      active.delete(destroy);
      observer?.disconnect();
      await Promise.resolve();
      if (component) await unmount(component);
    };
    active.add(destroy);
    if (!containerEl.isConnected) {
      observer = new MutationObserver(start);
      observer.observe(containerEl.ownerDocument, {
        childList: true,
        subtree: true,
      });
    }
    queueMicrotask(start);
    return { destroy };
  });
  plugin.register(() => {
    for (const destroy of [...active]) void destroy();
  });
}
