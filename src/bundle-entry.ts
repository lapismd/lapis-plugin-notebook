// Publication bundle entry: the plugin runtime plus its stylesheet, built by
// `pnpm build:bundle` into `dist/main.mjs` + `dist/app.css` with the private
// sub-packages inlined and the host-shared modules kept external
// (LN-NB-006). This is also the npm runtime entry; the package build emits a
// separate bundled declaration entry without unpublished support imports.
import "./lib/styles.css";

export * from "./lib";
export { default } from "./lib";
