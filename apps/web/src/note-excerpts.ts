import { locationLabel, neoreadLink, type Annotation } from "@neoread/core";
import { getPaperNote } from "./paper-note-state";
import { copyText } from "./chat/clipboard";

export const noteImageSource = (documentId: string, annotationId: string) =>
  `neoread-note-image://${documentId}/${annotationId}`;
export function parseNoteImage(source: string) {
  const match = /^neoread-note-image:\/\/([0-9a-f]{32})\/([0-9a-f]{32})$/.exec(
    source,
  );
  return match ? { documentId: match[1], annotationId: match[2] } : undefined;
}
const escape = (text: string) => text.replace(/[\\`*_[\]<>]/g, "\\$&");
export function excerptMarkdown(annotation: Annotation, image = false) {
  const content = image
    ? `![${escape(annotation.quote.trim().replace(/\s+/g, " ").slice(0, 120) || "区域截图")}](${noteImageSource(annotation.documentId, annotation.id)})`
    : annotation.quote
        .split(/\r?\n/)
        .map((line) => `> ${escape(line)}`)
        .join("\n");
  return `${content}${image ? "  \n" : "\n\n"}[${escape(locationLabel(annotation.location))} · 原文](${neoreadLink({ id: annotation.documentId, annotation: annotation.id })})\n`;
}
export async function appendExcerpt(documentId: string, markdown: string) {
  const note = getPaperNote(documentId);
  await note.load();
  const body = note.getSnapshot().body.trimEnd();
  note.edit(`${body ? body + "\n\n" : ""}${markdown}\n`);
  await note.flush();
}
export async function copyImageExcerpt(
  prepare: () => Promise<{ markdown: string; image: Blob }>,
) {
  if (window.neoreadDesktop?.writeClipboardImage) {
    const { markdown, image } = await prepare();
    await window.neoreadDesktop.writeClipboardImage(
      new Uint8Array(await image.arrayBuffer()),
      markdown,
    );
    return;
  }
  if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
    // Start the clipboard write during the click. Fetch and persistence may
    // finish after the browser's transient user activation expires.
    const pending = prepare();
    const text = pending.then(
      ({ markdown }) => new Blob([markdown], { type: "text/plain" }),
    );
    const png = pending.then(({ image }) => image);
    const write = navigator.clipboard.write([
      new ClipboardItem({ "text/plain": text, "image/png": png }),
    ]);
    await Promise.all([text, png, write]);
    return;
  }
  await copyExcerpt((await prepare()).markdown);
}
export async function copyExcerpt(markdown: string) {
  if (!(await copyText(markdown, "已复制摘录，可粘贴到笔记")))
    throw new Error("无法复制摘录");
}
