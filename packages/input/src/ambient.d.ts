declare module "@lapis-notes/notebook-input/styles.css";

declare module "htl" {
  export const html: ((
    strings: TemplateStringsArray,
    ...values: unknown[]
  ) => Node | null) & {
    fragment: (
      strings: TemplateStringsArray,
      ...values: unknown[]
    ) => DocumentFragment;
  };
  export const svg: ((
    strings: TemplateStringsArray,
    ...values: unknown[]
  ) => Node | null) & {
    fragment: (
      strings: TemplateStringsArray,
      ...values: unknown[]
    ) => DocumentFragment;
  };
}
