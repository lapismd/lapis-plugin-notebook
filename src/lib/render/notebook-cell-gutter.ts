/** Align the cell's action rail to the owning document's line-number gutter. */
export function alignNotebookCellToGutter(cell: HTMLElement): () => void {
  const editor = cell.closest<HTMLElement>(".cm-editor.cm-live-preview");
  const gutter = editor?.querySelector<HTMLElement>(
    ":scope > .cm-scroller > .cm-gutters .cm-lineNumbers",
  );
  const action = cell.querySelector<HTMLElement>(".notebook-cell__action");
  if (!editor || !gutter || !action) return () => {};
  let frame = 0;
  let offset = 0;
  const measure = () => {
    frame = 0;
    const target = gutter.getBoundingClientRect();
    const button = action.getBoundingClientRect();
    if (!target.width || !button.width) return;
    const next =
      offset + (target.left + target.right - button.left - button.right) / 2;
    if (Math.abs(next - offset) < 0.5) return;
    offset = next;
    cell.style.setProperty("--notebook-cell-gutter-offset", `${offset}px`);
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(measure);
  };
  const observer = new ResizeObserver(schedule);
  observer.observe(editor);
  observer.observe(gutter);
  observer.observe(cell);
  schedule();
  return () => {
    observer.disconnect();
    cancelAnimationFrame(frame);
    cell.style.removeProperty("--notebook-cell-gutter-offset");
  };
}
