import { useId, useState } from "react";
import { Button } from "@neoread/ui/components/button";
import { Input } from "@neoread/ui/components/input";
import { Textarea } from "@neoread/ui/components/textarea";
import { toast } from "sonner";
import { savePrompts, useCustomPrompts } from "./chat/custom-prompts";

export function CustomPromptSettings() {
  const id = useId();
  const prompts = useCustomPrompts();
  const [editing, setEditing] = useState<string>();
  const [description, setDescription] = useState("");
  const [prompt, setPrompt] = useState("");
  function reset() {
    setEditing(undefined);
    setDescription("");
    setPrompt("");
  }
  const failed = () => toast.error("无法保存常用 prompt，请检查本机存储空间");
  return (
    <section className="space-y-4">
      <h3 className="text-sm font-medium">常用 prompt</h3>
      <div className="space-y-2">
        {prompts.map((p) => (
          <div key={p.id} className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate" title={p.description}>
              {p.description}
            </span>
            <Button
              variant="ghost"
              size="sm"
              aria-label={`编辑 ${p.description}`}
              onClick={() => {
                setEditing(p.id);
                setDescription(p.description);
                setPrompt(p.prompt);
              }}
            >
              编辑
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label={`删除 ${p.description}`}
              onClick={() => {
                if (savePrompts(prompts.filter((x) => x.id !== p.id))) {
                  if (editing === p.id) reset();
                } else failed();
              }}
            >
              删除
            </Button>
          </div>
        ))}
      </div>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!description.trim() || !prompt.trim()) return;
          const next = {
            id: editing ?? crypto.randomUUID(),
            description: description.trim(),
            prompt: prompt.trim(),
          };
          if (
            savePrompts(
              editing
                ? prompts.map((p) => (p.id === editing ? next : p))
                : [...prompts, next],
            )
          )
            reset();
          else failed();
        }}
      >
        <div className="space-y-2">
          <label htmlFor={`${id}-description`} className="text-sm">
            功能描述
          </label>
          <Input
            id={`${id}-description`}
            maxLength={80}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor={`${id}-prompt`} className="text-sm">
            具体 prompt
          </label>
          <Textarea
            id={`${id}-prompt`}
            rows={6}
            maxLength={20000}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          {editing && (
            <Button type="button" variant="ghost" onClick={reset}>
              取消编辑
            </Button>
          )}
          <Button
            type="submit"
            disabled={!description.trim() || !prompt.trim()}
          >
            {editing ? "保存修改" : "添加"}
          </Button>
        </div>
      </form>
    </section>
  );
}
