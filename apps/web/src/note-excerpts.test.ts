import { expect, it, vi } from "vitest";
import type { Annotation } from "@neoread/core";
import {
  excerptMarkdown,
  parseNoteImage,
  appendExcerpt,
} from "./note-excerpts";
const note = vi.hoisted(() => ({
  load: vi.fn(),
  getSnapshot: () => ({ body: "Existing note" }),
  edit: vi.fn(),
  flush: vi.fn(),
}));
vi.mock("./paper-note-state", () => ({ getPaperNote: () => note }));
const annotation = {
  id: "b".repeat(32),
  documentId: "a".repeat(32),
  quote: "[unsafe](https://example.org)\n<script>",
  location: { type: "pdf", page: 3 },
} as Annotation;
it("keeps source text literal and stores a durable annotation backlink", () => {
  const markdown = excerptMarkdown(annotation, "论文 [A]");
  expect(markdown).toContain("> \\[unsafe\\]");
  expect(markdown).not.toContain("<script>");
  expect(markdown).toContain(`annotation=${annotation.id}`);
  expect(markdown).toContain("[(论文 \\[A\\], 第 3 页)]");
});
it("only resolves document-scoped screenshot references", () => {
  expect(
    parseNoteImage(
      `neoread-note-image://${annotation.documentId}/${annotation.id}`,
    ),
  ).toEqual({ documentId: annotation.documentId, annotationId: annotation.id });
  expect(parseNoteImage("https://example.org/track.png")).toBeUndefined();
  expect(
    parseNoteImage("neoread-note-image://../../private/file"),
  ).toBeUndefined();
});
it("never replaces an unreadable note with an excerpt", async () => {
  note.load.mockRejectedValueOnce(new Error("read failed"));
  await expect(appendExcerpt(annotation.documentId, "excerpt")).rejects.toThrow(
    "read failed",
  );
  expect(note.edit).not.toHaveBeenCalled();
});
