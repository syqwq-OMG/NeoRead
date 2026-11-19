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
    useReaderStore
      .getState()
      .setTheme({
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
      useReaderStore
        .getState()
        .setTheme({
          annotationToolbarDock: "right",
          annotationToolbarMode: "ball",
        }),
    );
    expect(
      host.querySelector(".pdf-annotation-tools")?.getAttribute("data-dock"),
    ).toBe("right");
    expect(host.querySelector('[aria-label="展开批注工具"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="矩形框选"]')).toBeNull();
  } finally {
    await act(async () => root.unmount());
    host.remove();
    useReaderStore.setState({ theme: original });
    vi.unstubAllGlobals();
  }
});
