// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { defaultTheme, type ReaderTheme } from "@neoread/core";
import { ReadingTextControls } from "./ReadingTextControls";
import type { ReadingMode } from "./translation/reading-mode";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined, host: HTMLDivElement | undefined;
afterEach(() => {
  if (root) act(() => root!.unmount());
  host?.remove();
  root = host = undefined;
});
const render = (
  theme: Partial<ReaderTheme>,
  readingMode: ReadingMode = "parallel",
  docType: "pdf" | "epub" = "pdf",
  setTheme: (patch: Partial<ReaderTheme>) => void = () => {},
) => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() =>
    root!.render(
      <ReadingTextControls
        theme={{ ...defaultTheme, ...theme }}
        setTheme={setTheme}
        docType={docType}
        readingMode={readingMode}
      />,
    ),
  );
  return host;
};
const labels = (node: HTMLElement) =>
  [...node.querySelectorAll("[aria-label], [data-slot=slider] *")].map((e) =>
    e.getAttribute("aria-label"),
  );

it("changes the code font independently in the reading appearance panel", async () => {
  const setTheme = vi.fn();
  const node = render(
    { assistantFontFamily: "serif", assistantCodeFontFamily: "Consolas" },
    "parallel",
    "pdf",
    setTheme,
  );
  const trigger = node.querySelector<HTMLButtonElement>(
    '[aria-label="代码块字体"]',
  )!;
  expect(trigger.textContent).toContain("Consolas");
  await act(async () => trigger.click());
  const option = [
    ...document.querySelectorAll<HTMLElement>('[role="option"]'),
  ].find((item) => item.textContent === "默认等宽字体")!;
  expect(option).toBeTruthy();
  await act(async () => {
    option.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    option.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
  });
  expect(setTheme).toHaveBeenCalledWith({
    assistantCodeFontFamily: "monospace",
  });
});

it("gives reflowed PDF source the font, weight and size controls", () => {
  const node = render({ textReflow: true });
  expect(labels(node)).toEqual(
    expect.arrayContaining(["原文字体", "原文加粗", "译文字体"]),
  );
  expect(node.textContent).not.toContain("缩放");
});

it.each([true, false])(
  "keeps margin and line height in the layout section (reflow=%s)",
  (textReflow) => {
    const node = render({ textReflow });
    const layout = [...node.querySelectorAll("section")].find(
      (section) => section.querySelector("h4")?.textContent === "版面",
    )!;
    expect(labels(layout).filter(Boolean)).toEqual(["边距", "行距"]);
  },
);

it("keeps PDF page zoom without reflow", () => {
  const node = render({ textReflow: false });
  expect(node.textContent).toContain("缩放");
  expect(labels(node)).not.toContain("原文字体");
});

it("hides the layout section for the PDF page canvas but keeps it for EPUB source", () => {
  expect(render({}, "source").textContent).not.toContain("版面");
  act(() => root!.unmount());
  host!.remove();
  expect(render({}, "source", "epub").textContent).toContain("版面");
});

it("hides PDF source zoom in translation-only mode", () => {
  const node = render({ textReflow: false }, "translation");
  expect(node.textContent).not.toContain("缩放");
  expect(node.textContent).toContain("译文");
});
