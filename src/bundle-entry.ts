// Publication bundle entry: the plugin runtime plus its stylesheet, built by
// `pnpm build:bundle` into `dist/main.mjs` + `dist/app.css` with the private
// sub-packages inlined and the host-shared modules kept external
// (LN-NB-006). The package-level `dist/index.js` (svelte-package) remains the
// npm export surface.
import "./lib/styles.css";

export * from "./lib";
export { default } from "./lib";
