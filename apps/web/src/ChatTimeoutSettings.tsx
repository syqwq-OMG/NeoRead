import { useEffect, useId, useState } from "react";
import { Button } from "@neoread/ui/components/button";
import { Input } from "@neoread/ui/components/input";

export function ChatTimeoutSettings({
  value,
  disabled,
  onSave,
}: {
  value: number;
  disabled: boolean;
  onSave: (minutes: number) => Promise<boolean>;
}) {
  const id = useId();
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const minutes = Number(draft);
  const valid =
    draft.trim() !== "" &&
    Number.isInteger(minutes) &&
    minutes >= 0 &&
    minutes <= 1440;
  return (
    <section>
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (valid) void onSave(minutes);
        }}
      >
        <label htmlFor={id} className="block text-sm font-medium">
          聊天等待时间上限（分钟）
        </label>
        <div className="flex items-center gap-2">
          <Input
            id={id}
            aria-describedby={`${id}-hint`}
            type="number"
            min={0}
            max={1440}
            step={1}
            value={draft}
            disabled={disabled}
            onChange={(event) => setDraft(event.target.value)}
          />
          <Button
            type="submit"
            size="sm"
            disabled={disabled || !valid || minutes === value}
          >
            保存
          </Button>
        </div>
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          0 表示不限时。保存后对新提问及继续运行生效；上游服务仍可能自行超时。
        </p>
      </form>
    </section>
  );
}
