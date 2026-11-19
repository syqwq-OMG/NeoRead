// @vitest-environment jsdom
import { act, createRef } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import type { Annotation } from "@neoread/core";
import { RegionContextMenu } from "./RegionContextMenu";
it("opens on a saved region and preserves native context menus elsewhere", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host),
    copy = vi.fn();
  const annotation = {
    id: "b".repeat(32),
    documentId: "a".repeat(32),
    location: {
      type: "pdf",
      page: 1,
      region: true,
      rects: [{ x: 0.1, y: 0.1, width: 0.3, height: 0.3 }],
    },
  } as Annotation;
  try {
    await act(async () =>
      root.render(
        <RegionContextMenu
          pane={createRef()}
          annotations={[annotation]}
          active
          busy={false}
          onCopy={copy}
          onInsert={() => {}}
          onDelete={() => {}}
        >
          <div className="page" data-page-number="1">
            sample
          </div>
        </RegionContextMenu>,
      ),
    );
    const page = host.querySelector<HTMLElement>(".page")!;
    page.getBoundingClientRect = () => new DOMRect(0, 0, 100, 100);
    const outside = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: 90,
      clientY: 90,
      button: 2,
    });
    await act(async () => {
      page.dispatchEvent(outside);
    });
    expect(outside.defaultPrevented).toBe(false);
    await act(async () => {
      page.dispatchEvent(
        new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
          clientX: 20,
          clientY: 20,
          button: 2,
        }),
      );
    });
    const item = [
      ...document.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    ].find((node) => node.textContent === "复制区域截图");
    expect(item).toBeDefined();
    await act(async () => item!.click());
    expect(copy).toHaveBeenCalledWith(annotation);
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});
