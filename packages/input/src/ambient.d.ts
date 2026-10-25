declare module "@lapis-notes/ui/input" {
  export const Input: unknown;
}

declare module "@lapis-notes/ui/slider" {
  export const Slider: unknown;
}

declare module "@lapis-notes/ui/switch" {
  export const Switch: unknown;
}

declare module "@lapis-notes/ui/textarea" {
  export const Textarea: unknown;
}
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
