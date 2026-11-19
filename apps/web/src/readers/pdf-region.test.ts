// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { PDFRegionTool, regionRect } from "./pdf-region";
it("normalizes backwards drags and clips to one page", () => {
  expect(regionRect({ x: 0.8, y: 0.9 }, { x: -1, y: 0.1 })).toEqual({
    x: 0,
    y: 0.1,
    width: 0.8,
    height: 0.8,
  });
});
it("captures a region and cancels drafts without leaving event handlers", () => {
  const host = document.createElement("div"),
    page = document.createElement("div");
  page.className = "page";
  page.dataset.pageNumber = "2";
  host.append(page);
  document.body.append(host);
  page.getBoundingClientRect = () => new DOMRect(10, 20, 100, 200);
  page.setPointerCapture = vi.fn();
  page.hasPointerCapture = () => true;
  page.releasePointerCapture = vi.fn();
  const tool = new PDFRegionTool(host),
    selected = vi.fn();
  tool.set(true, selected);
  const send = (type: string, x: number, y: number) =>
    page.dispatchEvent(
      new MouseEvent(type, {
        bubbles: true,
        button: 0,
        clientX: x,
        clientY: y,
      }),
    );
  try {
    send("pointerdown", 20, 40);
    send("pointermove", 70, 140);
    send("pointerup", 70, 140);
    expect(selected).toHaveBeenCalledWith(
      expect.objectContaining({
        location: {
          type: "pdf",
          page: 2,
          region: true,
          rects: [{ x: 0.1, y: 0.1, width: 0.5, height: 0.5 }],
        },
      }),
    );
    send("pointerdown", 20, 40);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(host.querySelector(".pdf-region-draft")).toBeNull();
    expect(selected).toHaveBeenCalledTimes(1);
    tool.destroy();
    send("pointerdown", 20, 40);
    expect(host.querySelector(".pdf-region-draft")).toBeNull();
  } finally {
    tool.destroy();
    host.remove();
  }
});
