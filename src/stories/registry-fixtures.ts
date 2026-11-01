const results = [
  ":::cell{#results lang=\"js\" folded}",
  "```js",
  "lapis.table({ columns: ['Region', 'Revenue', 'Growth'], columnMeta: [{key:'Region',type:'string'},{key:'Revenue',type:'string'},{key:'Growth',type:'string'}], rows: [['North', '$128,400', '18%'], ['West', '$96,200', '24%'], ['Central', '$84,700', '12%'], ['South', '$72,100', '16%']] });",
  "```",
  ":::",
].join("\n");

export const researchNotebook = [
  "---", "notebook:", "  version: 1", "  autorun: false", "  mode: lazy", "---",
  "# From questions to evidence",
  "Keep the reasoning, live calculations, and results together in one portable Markdown notebook.",
  "Regional performance · Q3 2026. North led revenue; West grew fastest.",
  results,
  "## A reproducible conclusion",
  ":::cell{#summary lang=\"js\" folded}", "```js",
  "const total = 128400 + 96200 + 84700 + 72100;",
  "display(`Total revenue: $${total.toLocaleString('en-US')} — every result stays connected to its source.`);",
  "```", ":::",
].join("\n\n");

export const interactiveNotebook = [
  "---", "notebook:", "  version: 1", "  autorun: false", "  mode: lazy", "---",
  "# Explore the next quarter",
  "Adjust a live input and let dependent cells recompute. Your analysis stays readable alongside the controls.",
  ":::cell{#growth lang=\"js\" folded}", "```js",
  "const growth = view(Inputs.range([0, 40], { label: 'Growth', value: 18, step: 1 }));",
  "```", ":::",
  results,
  ":::cell{#forecast lang=\"js\" folded}", "```js",
  "display(`North forecast: $${Math.round(128400 * (1 + growth / 100)).toLocaleString('en-US')}`);",
  "```", ":::",
].join("\n\n");
