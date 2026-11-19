import { useEffect, useState, type ReactNode, type RefObject } from "react";
import type { Annotation } from "@neoread/core";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
} from "@neoread/ui/components/context-menu";
export function RegionContextMenu({
  children,
  pane,
  annotations,
  active,
  busy,
  onCopy,
  onInsert,
  onDelete,
}: {
  children: ReactNode;
  pane: RefObject<HTMLDivElement | null>;
  annotations: Annotation[];
  active: boolean;
  busy: boolean;
  onCopy: (annotation: Annotation) => void;
  onInsert: (annotation: Annotation) => void;
  onDelete: (annotation: Annotation) => void;
}) {
  const [target, setTarget] = useState<Annotation | null>(null);
  useEffect(() => {
    if (!active) setTarget(null);
  }, [active]);
  return (
    <ContextMenu
      open={active && !!target}
      onOpenChange={(open) => {
        if (!open) setTarget(null);
      }}
    >
      <ContextMenuTrigger
        render={
          <div
            className="reading-pane select-text"
            ref={pane}
            onContextMenuCapture={(event) => {
              const page =
                event.target instanceof Element
                  ? event.target.closest<HTMLElement>(".page[data-page-number]")
                  : null;
              let found: Annotation | undefined;
              if (page) {
                const box = page.getBoundingClientRect(),
                  x = (event.clientX - box.left) / box.width,
                  y = (event.clientY - box.top) / box.height;
                found = [...annotations]
                  .reverse()
                  .find(
                    (item) =>
                      item.location.type === "pdf" &&
                      item.location.region &&
                      item.location.page === Number(page.dataset.pageNumber) &&
                      item.location.rects?.some(
                        (rect) =>
                          x >= rect.x &&
                          y >= rect.y &&
                          x <= rect.x + rect.width &&
                          y <= rect.y + rect.height,
                      ),
                  );
              }
              setTarget(found ?? null);
              // Preserve native text/image context menus outside region annotations.
              if (!found) event.stopPropagation();
            }}
          />
        }
      >
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          disabled={busy}
          onClick={() => {
            if (target) onCopy(target);
          }}
        >
          复制区域截图
        </ContextMenuItem>
        <ContextMenuItem
          disabled={busy}
          onClick={() => {
            if (target) onInsert(target);
          }}
        >
          添加截图到笔记
        </ContextMenuItem>
        <ContextMenuItem
          disabled={busy}
          variant="destructive"
          onClick={() => {
            if (target) onDelete(target);
          }}
        >
          删除矩形批注
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
