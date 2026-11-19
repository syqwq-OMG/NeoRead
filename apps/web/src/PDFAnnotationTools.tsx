import { useState } from "react";
import {
  MousePointer2,
  Highlighter,
  Underline,
  SquareDashed,
  PanelTop,
  PanelBottom,
  PanelLeft,
  PanelRight,
  CircleDot,
  Minimize2,
} from "lucide-react";
import { Button } from "@neoread/ui/components/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@neoread/ui/components/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@neoread/ui/components/select";
import { ColorSwatches } from "./ColorSwatches";
import { useReaderStore } from "./store";
import type { ReaderTheme } from "@neoread/core";
export type AnnotationTool = "select" | "highlight" | "underline" | "region";
export type AnnotationDock = "top" | "bottom" | "left" | "right";
const docks = [
  ["top", "顶部", PanelTop],
  ["bottom", "底部", PanelBottom],
  ["left", "左侧", PanelLeft],
  ["right", "右侧", PanelRight],
] as const;
export function PDFAnnotationTools({
  tool,
  color,
  disabled,
  onTool,
  onColor,
}: {
  tool: AnnotationTool;
  color: string;
  disabled: boolean;
  onTool: (tool: AnnotationTool) => void;
  onColor: (color: string) => void;
}) {
  const theme = useReaderStore((state) => state.theme),
    setTheme = useReaderStore((state) => state.setTheme);
  const dock = theme.annotationToolbarDock ?? "top";
  const floating = theme.annotationToolbarMode === "ball";
  const [expanded, setExpanded] = useState(false);
  const tools = [
    ["select", "选择文字", MousePointer2],
    ["highlight", "高亮", Highlighter],
    ["underline", "下划线", Underline],
    ["region", "矩形框选", SquareDashed],
  ] as const;
  const menu = (
    <div
      role="toolbar"
      aria-label="PDF 批注工具"
      className="flex flex-wrap items-center gap-1"
      onPointerDown={(event) => event.preventDefault()}
    >
      {tools.map(([value, label, Icon]) => (
        <Button
          key={value}
          size="icon-sm"
          variant={tool === value ? "secondary" : "ghost"}
          aria-label={label}
          title={label}
          aria-pressed={tool === value}
          disabled={disabled}
          onClick={() => {
            onTool(value);
            if (floating) setExpanded(false);
          }}
        >
          <Icon />
        </Button>
      ))}
      <ColorSwatches
        action="颜色"
        current={color}
        onPick={onColor}
        disabled={disabled}
      />
      <Popover>
        <PopoverTrigger
          render={
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="工具栏位置"
              title="工具栏位置"
            >
              <PanelTop />
            </Button>
          }
        />
        <PopoverContent className="w-auto">
          <div className="flex gap-1">
            {docks.map(([value, label, Icon]) => (
              <Button
                key={value}
                size="icon-sm"
                variant={dock === value ? "secondary" : "ghost"}
                aria-label={`吸附到${label}`}
                title={label}
                onClick={() => setTheme({ annotationToolbarDock: value })}
              >
                <Icon />
              </Button>
            ))}
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="缩成悬浮球"
              onClick={() => {
                setTheme({ annotationToolbarMode: "ball" });
                setExpanded(false);
              }}
            >
              <Minimize2 />
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
  return (
    <div className="pdf-annotation-tools" data-dock={dock} data-ball={floating}>
      {floating ? (
        <Popover open={expanded} onOpenChange={setExpanded}>
          <PopoverTrigger
            render={
              <Button
                className="rounded-full shadow-sm"
                size="icon"
                variant="outline"
                aria-label="展开批注工具"
              >
                <CircleDot />
              </Button>
            }
          />
          <PopoverContent className="w-auto max-w-[min(32rem,90vw)]">
            {menu}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTheme({ annotationToolbarMode: "docked" })}
            >
              展开为工具栏
            </Button>
          </PopoverContent>
        </Popover>
      ) : (
        menu
      )}
    </div>
  );
}
export function AnnotationToolbarSettings() {
  const theme = useReaderStore((state) => state.theme),
    setTheme = useReaderStore((state) => state.setTheme);
  return (
    <section className="space-y-4">
      <h3 className="text-sm font-medium">PDF 批注工具栏</h3>
      <div className="space-y-2">
        <label id="annotation-toolbar-mode" className="block text-sm">
          显示方式
        </label>
        <Select
          value={theme.annotationToolbarMode ?? "docked"}
          onValueChange={(value) =>
            setTheme({
              annotationToolbarMode:
                value as ReaderTheme["annotationToolbarMode"],
            })
          }
        >
          <SelectTrigger aria-labelledby="annotation-toolbar-mode">
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false} align="start">
            <SelectItem value="docked">独立工具栏</SelectItem>
            <SelectItem value="ball">悬浮菜单球</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <label id="annotation-toolbar-dock" className="block text-sm">
          吸附位置
        </label>
        <Select
          value={theme.annotationToolbarDock ?? "top"}
          onValueChange={(value) =>
            setTheme({ annotationToolbarDock: value as AnnotationDock })
          }
        >
          <SelectTrigger aria-labelledby="annotation-toolbar-dock">
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false} align="start">
            {docks.map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </section>
  );
}
