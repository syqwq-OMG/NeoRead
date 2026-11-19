import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";
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
  Grip,
  Palette,
  Maximize2,
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
  const [showColors, setShowColors] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number }>();
  const host = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    pointer: number;
    x: number;
    y: number;
    offsetX: number;
    offsetY: number;
    moved: boolean;
  } | null>(null);
  const suppressClick = useRef(false);
  const close = () => {
    setExpanded(false);
    setShowColors(false);
  };
  useEffect(() => {
    if (!expanded) return;
    const outside = (event: globalThis.PointerEvent) => {
      if (event.target instanceof Node && !host.current?.contains(event.target))
        close();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [expanded]);
  const start = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || !event.isPrimary || !host.current) return;
    const rect = host.current.getBoundingClientRect();
    suppressClick.current = false;
    drag.current = {
      pointer: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      offsetX: floating ? event.clientX - (rect.left + rect.width / 2) : 0,
      offsetY: floating ? event.clientY - (rect.top + rect.height / 2) : 0,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const dragPosition = (event: PointerEvent<HTMLButtonElement>) => {
    const bounds = host.current?.parentElement?.getBoundingClientRect();
    const current = drag.current;
    if (!bounds?.width || !bounds.height || !current) return;
    const clamp = (value: number) => Math.max(0, Math.min(1, value));
    return {
      x: clamp((event.clientX - current.offsetX - bounds.left) / bounds.width),
      y: clamp((event.clientY - current.offsetY - bounds.top) / bounds.height),
    };
  };
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    const current = drag.current;
    if (!current || event.pointerId !== current.pointer) return;
    if (
      !current.moved &&
      Math.hypot(event.clientX - current.x, event.clientY - current.y) < 5
    )
      return;
    current.moved = true;
    suppressClick.current = true;
    close();
    setPosition(dragPosition(event));
  };
  const finish = (event: PointerEvent<HTMLButtonElement>) => {
    const current = drag.current;
    if (!current || current.pointer !== event.pointerId) return;
    const next = current.moved ? dragPosition(event) : undefined;
    drag.current = null;
    setPosition(undefined);
    if (!next || event.type !== "pointerup") return;
    if (floating) {
      setTheme({ annotationBallPosition: next });
    } else {
      const bounds = host.current!.parentElement!.getBoundingClientRect();
      const distances = [
        next.y * bounds.height,
        (1 - next.y) * bounds.height,
        next.x * bounds.width,
        (1 - next.x) * bounds.width,
      ];
      setTheme({
        annotationToolbarDock:
          docks[distances.indexOf(Math.min(...distances))][0],
      });
    }
  };
  const dragHandlers = {
    onPointerDown: start,
    onPointerMove: move,
    onPointerUp: finish,
    onPointerCancel: finish,
    onLostPointerCapture: finish,
  };
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
      <Button
        size="icon-sm"
        variant="ghost"
        className="annotation-drag-handle"
        aria-label="拖拽工具栏"
        title="拖拽到阅读区域边缘"
        {...dragHandlers}
      >
        <Grip />
      </Button>
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
  const point =
    position ??
    (floating
      ? (theme.annotationBallPosition ?? { x: 0.5, y: 0.18 })
      : undefined);
  const radialItems = [
    ...tools.map(([value, label, Icon]) => ({
      label,
      Icon,
      disabled,
      pressed: tool === value,
      action: () => {
        onTool(value);
        close();
      },
    })),
    {
      label: "批注颜色",
      Icon: Palette,
      disabled,
      pressed: showColors,
      action: () => setShowColors(!showColors),
    },
    {
      label: "展开为工具栏",
      Icon: Maximize2,
      disabled: false,
      pressed: false,
      action: () => {
        close();
        setTheme({ annotationToolbarMode: "docked" });
      },
    },
  ];
  return (
    <div
      ref={host}
      className="pdf-annotation-tools"
      data-dock={dock}
      data-ball={floating}
      data-positioned={!!point}
      data-expanded={floating && expanded}
      style={
        point
          ? ({
              "--tool-x": `${point.x * 100}%`,
              "--tool-y": `${point.y * 100}%`,
            } as CSSProperties)
          : undefined
      }
    >
      {floating ? (
        <>
          <Button
            className="annotation-drag-handle rounded-full shadow-sm"
            size="icon"
            variant="outline"
            aria-label={expanded ? "收起批注工具" : "展开批注工具"}
            aria-expanded={expanded}
            {...dragHandlers}
            onClick={(event) => {
              if (event.detail && suppressClick.current) {
                suppressClick.current = false;
                return;
              }
              if (expanded) close();
              else setExpanded(true);
            }}
          >
            <CircleDot />
          </Button>
          {expanded && (
            <div
              className="annotation-radial-menu"
              role="toolbar"
              aria-label="PDF 批注工具"
            >
              {radialItems.map(
                ({ label, Icon, pressed, action, disabled }, index) => {
                  const angle =
                    (index * 2 * Math.PI) / radialItems.length - Math.PI / 2;
                  return (
                    <Button
                      key={label}
                      size="icon-sm"
                      variant={pressed ? "secondary" : "outline"}
                      className="annotation-radial-item rounded-full"
                      aria-label={label}
                      title={label}
                      aria-pressed={pressed}
                      disabled={disabled}
                      onClick={action}
                      style={
                        {
                          "--radial-x": Math.cos(angle),
                          "--radial-y": Math.sin(angle),
                        } as CSSProperties
                      }
                    >
                      <Icon />
                    </Button>
                  );
                },
              )}
              {showColors && (
                <div className="annotation-radial-colors">
                  <ColorSwatches
                    action="颜色"
                    current={color}
                    onPick={(next) => {
                      onColor(next);
                      close();
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </>
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
      {theme.annotationToolbarMode !== "ball" && (
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
      )}
    </section>
  );
}
