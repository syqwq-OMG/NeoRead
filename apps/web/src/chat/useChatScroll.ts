import { useCallback, useLayoutEffect, useRef, useState } from "react";
export const BOTTOM_THRESHOLD = 24;
export function nearBottom(
  scrollTop: number,
  height: number,
  clientHeight: number,
) {
  return height - clientHeight - scrollTop <= BOTTOM_THRESHOLD;
}
export function useChatScroll(identity: unknown, active = true) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const followRef = useRef(true);
  const activeRef = useRef(active);
  activeRef.current = active;
  const positionRef = useRef(0);
  const [following, setFollowing] = useState(true);
  const setFollow = useCallback((value: boolean) => {
    followRef.current = value;
    setFollowing(value);
  }, []);
  const bottom = useCallback(() => {
    setFollow(true);
    const viewport = viewportRef.current;
    if (viewport && activeRef.current)
      positionRef.current = viewport.scrollTop = Math.max(
        0,
        viewport.scrollHeight - viewport.clientHeight,
      );
  }, [setFollow]);
  useLayoutEffect(() => {
    bottom();
  }, [identity, bottom]);
  useLayoutEffect(() => {
    if (!active) return;
    const viewport = viewportRef.current,
      content = contentRef.current;
    if (!viewport || !content) return;
    viewport.scrollTop = followRef.current
      ? Math.max(0, viewport.scrollHeight - viewport.clientHeight)
      : positionRef.current;
    let previous = viewport.scrollTop,
      programmatic = -1,
      frame = 0,
      touchY = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (
          activeRef.current &&
          viewport.clientHeight > 0 &&
          followRef.current
        ) {
          programmatic = Math.max(
            0,
            viewport.scrollHeight - viewport.clientHeight,
          );
          viewport.scrollTop = programmatic;
          positionRef.current = viewport.scrollTop;
          previous = viewport.scrollTop;
        }
      });
    };
    const scroll = () => {
      const next = viewport.scrollTop;
      if (!viewport.clientHeight) return;
      positionRef.current = next;
      if (Math.abs(next - programmatic) < 1) {
        programmatic = -1;
        previous = next;
        return;
      }
      if (next < previous) setFollow(false);
      else if (nearBottom(next, viewport.scrollHeight, viewport.clientHeight))
        setFollow(true);
      previous = next;
    };
    const wheel = (event: WheelEvent) => {
      if (event.deltaY < 0) setFollow(false);
    };
    const key = (event: KeyboardEvent) => {
      if (
        ["ArrowUp", "PageUp", "Home"].includes(event.key) ||
        (event.key === " " && event.shiftKey)
      )
        setFollow(false);
    };
    const touchStart = (event: TouchEvent) => {
      touchY = event.touches[0]?.clientY || 0;
    };
    const touchMove = (event: TouchEvent) => {
      const y = event.touches[0]?.clientY || 0;
      if (y > touchY) setFollow(false);
      touchY = y;
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(content);
    observer.observe(viewport);
    viewport.addEventListener("scroll", scroll);
    viewport.addEventListener("wheel", wheel, { passive: true });
    viewport.addEventListener("keydown", key);
    viewport.addEventListener("touchstart", touchStart, { passive: true });
    viewport.addEventListener("touchmove", touchMove, { passive: true });
    schedule();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      viewport.removeEventListener("scroll", scroll);
      viewport.removeEventListener("wheel", wheel);
      viewport.removeEventListener("keydown", key);
      viewport.removeEventListener("touchstart", touchStart);
      viewport.removeEventListener("touchmove", touchMove);
    };
  }, [setFollow, active]);
  return { viewportRef, contentRef, following, bottom };
}
