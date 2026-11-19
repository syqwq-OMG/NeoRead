// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import {
  PDFAnnotationTools,
  AnnotationToolbarSettings,
} from "./PDFAnnotationTools";
import { useReaderStore } from "./store";
it("keeps tool selection separate from persistent docking and menu mode", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host),
    tool = vi.fn();
  const original = useReaderStore.getState().theme;
  try {
    useReaderStore.getState().setTheme({
      annotationToolbarMode: "docked",
      annotationToolbarDock: "top",
    });
    await act(async () =>
      root.render(
        <>
          <PDFAnnotationTools
            tool="select"
            color="#e6b94c"
            disabled={false}
            onTool={tool}
            onColor={() => {}}
          />
          <AnnotationToolbarSettings />
        </>,
      ),
    );
    expect(
      host.querySelector(".pdf-annotation-tools")?.getAttribute("data-dock"),
    ).toBe("top");
    await act(async () =>
      host.querySelector<HTMLButtonElement>('[aria-label="矩形框选"]')!.click(),
    );
    expect(tool).toHaveBeenCalledWith("region");
    await act(async () =>
      useReaderStore.getState().setTheme({
        annotationToolbarDock: "right",
        annotationToolbarMode: "ball",
      }),
    );
    expect(
      host.querySelector(".pdf-annotation-tools")?.getAttribute("data-dock"),
    ).toBe("right");
    expect(host.querySelector('[aria-label="展开批注工具"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="矩形框选"]')).toBeNull();
    const ball = host.querySelector<HTMLButtonElement>(
      '[aria-label="展开批注工具"]',
    )!;
    const toolbar = host.querySelector<HTMLElement>(".pdf-annotation-tools")!;
    host.getBoundingClientRect = () => new DOMRect(0, 0, 400, 400);
    toolbar.getBoundingClientRect = () => new DOMRect(180, 80, 40, 40);
    ball.setPointerCapture = vi.fn();
    const pointer = (type: string, x: number, y: number) => {
      const event = new MouseEvent(type, {
        bubbles: true,
        clientX: x,
        clientY: y,
      });
      Object.defineProperties(event, {
        pointerId: { value: 1 },
        isPrimary: { value: true },
      });
      ball.dispatchEvent(event);
    };
    await act(async () => {
      pointer("pointerdown", 200, 100);
      pointer("pointermove", 280, 240);
      pointer("pointerup", 280, 240);
      ball.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
    });
    expect(useReaderStore.getState().theme.annotationBallPosition).toEqual({
      x: 0.7,
      y: 0.6,
    });
    expect(host.querySelector(".annotation-radial-menu")).toBeNull();
    await act(async () => ball.click());
    expect(host.querySelectorAll(".annotation-radial-item")).toHaveLength(6);
  } finally {
    await act(async () => root.unmount());
    host.remove();
    useReaderStore.setState({ theme: original });
    vi.unstubAllGlobals();
  }
});
