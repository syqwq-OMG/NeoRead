import { Badge } from "@neoread/ui/components/badge";
import { Button } from "@neoread/ui/components/button";
import { useCustomPrompts } from "./custom-prompts";
export function CustomPrompts({
  disabled,
  onSend,
}: {
  disabled: boolean;
  onSend: (prompt: string) => void;
}) {
  const prompts = useCustomPrompts();
  if (!prompts.length) return null;
  return (
    <div
      className="flex max-h-28 flex-wrap gap-2 overflow-y-auto px-3 py-2"
      aria-label="常用 prompt"
    >
      {prompts.map((p) => (
        <Badge
          key={p.id}
          variant="outline"
          className="max-w-full h-auto min-h-6 py-1"
          render={
            <Button
              variant="outline"
              size="sm"
              disabled={disabled}
              title={p.description}
              onClick={() => onSend(p.prompt)}
            />
          }
        >
          <span className="truncate">{p.description}</span>
        </Badge>
      ))}
    </div>
  );
}
