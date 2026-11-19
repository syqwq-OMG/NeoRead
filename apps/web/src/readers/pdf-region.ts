import type { ReaderSelection } from "@neoread/core";
export function regionRect(
  start: { x: number; y: number },
  end: { x: number; y: number },
) {
  const clamp = (n: number) => Math.max(0, Math.min(1, n));
  const x = Math.min(clamp(start.x), clamp(end.x)),
    y = Math.min(clamp(start.y), clamp(end.y));
  return {
    x,
    y,
    width: Math.abs(clamp(start.x) - clamp(end.x)),
    height: Math.abs(clamp(start.y) - clamp(end.y)),
  };
}
export class PDFRegionTool {
  private enabled = false;
  private callback?: (selection: ReaderSelection) => void;
  private drag?: {
    page: HTMLElement;
    pointer: number;
    start: { x: number; y: number };
    preview: HTMLDivElement;
  };
  constructor(private host: HTMLElement) {
    host.addEventListener("pointerdown", this.down, true);
    host.addEventListener("pointermove", this.move, true);
    host.addEventListener("pointerup", this.up, true);
    host.addEventListener("pointercancel", this.cancel, true);
    host.addEventListener("click", this.click, true);
    host.addEventListener("scroll", this.cancel, { passive: true });
    document.addEventListener("keydown", this.key);
  }
  set(enabled: boolean, callback?: (selection: ReaderSelection) => void) {
    this.cancel();
    this.enabled = enabled;
    this.callback = callback;
    this.host.classList.toggle("pdf-region-mode", enabled);
  }
  private point = (event: PointerEvent, page: HTMLElement) => {
    const rect = page.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    };
  };
  private down = (event: PointerEvent) => {
    if (
      !this.enabled ||
      this.drag ||
      event.isPrimary === false ||
      event.button !== 0 ||
      !(event.target instanceof Element)
    )
      return;
    const page = event.target.closest<HTMLElement>(".page[data-page-number]");
    if (!page || !this.host.contains(page)) return;
    const bounds = page.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    event.preventDefault();
    event.stopPropagation();
    const preview = document.createElement("div");
    preview.className = "pdf-region-draft";
    page.append(preview);
    this.drag = {
      page,
      pointer: event.pointerId,
      start: this.point(event, page),
      preview,
    };
    page.setPointerCapture(event.pointerId);
  };
  private move = (event: PointerEvent) => {
    if (!this.drag || event.pointerId !== this.drag.pointer) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = regionRect(this.drag.start, this.point(event, this.drag.page));
    Object.assign(this.drag.preview.style, {
      left: `${rect.x * 100}%`,
      top: `${rect.y * 100}%`,
      width: `${rect.width * 100}%`,
      height: `${rect.height * 100}%`,
    });
  };
  private up = (event: PointerEvent) => {
    if (!this.drag || event.pointerId !== this.drag.pointer) return;
    event.preventDefault();
    event.stopPropagation();
    const { page, start } = this.drag;
    const rect = regionRect(start, this.point(event, page));
    const size = page.getBoundingClientRect();
    this.cancel();
    if (rect.width * size.width < 6 || rect.height * size.height < 6) return;
    this.callback?.({
      text: "",
      location: {
        type: "pdf",
        page: Number(page.dataset.pageNumber),
        region: true,
        rects: [rect],
      },
    });
  };
  private cancel = () => {
    if (this.drag) {
      const { page, pointer, preview } = this.drag;
      if (page.hasPointerCapture(pointer)) page.releasePointerCapture(pointer);
      preview.remove();
      this.drag = undefined;
    }
  };
  private click = (event: MouseEvent) => {
    if (this.enabled) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
  private key = (event: KeyboardEvent) => {
    if (event.key === "Escape") this.cancel();
  };
  destroy() {
    this.set(false);
    this.host.removeEventListener("pointerdown", this.down, true);
    this.host.removeEventListener("pointermove", this.move, true);
    this.host.removeEventListener("pointerup", this.up, true);
    this.host.removeEventListener("pointercancel", this.cancel, true);
    this.host.removeEventListener("click", this.click, true);
    this.host.removeEventListener("scroll", this.cancel);
    document.removeEventListener("keydown", this.key);
  }
}
