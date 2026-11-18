// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { ChatTimeoutSettings } from "./ChatTimeoutSettings";

it("edits the chat limit, supports unlimited, and validates minutes", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host),
    save = vi.fn(async () => true);
  try {
    await act(async () =>
      root.render(
        <ChatTimeoutSettings value={0} disabled={false} onSave={save} />,
      ),
    );
    const input = host.querySelector("input")!,
      button = host.querySelector("button")!;
    expect(input.value).toBe("0");
    expect(button.disabled).toBe(true);
    const type = async (value: string) =>
      act(async () => {
        Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        )!.set!.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
    await type("60");
    await act(async () => button.click());
    expect(save).toHaveBeenCalledWith(60);
    await type("1441");
    expect(button.disabled).toBe(true);
    await type("1.5");
    expect(button.disabled).toBe(true);
    await act(async () =>
      root.render(
        <ChatTimeoutSettings value={60} disabled={false} onSave={save} />,
      ),
    );
    await type("0");
    await act(async () => button.click());
    expect(save).toHaveBeenLastCalledWith(0);
  } finally {
    act(() => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});
