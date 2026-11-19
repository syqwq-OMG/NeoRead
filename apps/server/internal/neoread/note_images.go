package neoread

import (
	"bytes"
	"encoding/json"
	"image/png"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

var noteAssetID = regexp.MustCompile(`^[0-9a-f]{32}$`)

func (s *Server) copyNoteImages(body, from, to string) (string, error) {
	prefix := "neoread-note-image://" + from + "/"
	refs := regexp.MustCompile(regexp.QuoteMeta(prefix)+`([0-9a-f]{32})`).FindAllStringSubmatch(body, -1)
	for _, ref := range refs {
		data, err := os.ReadFile(s.noteImagePath(from, ref[1]))
		if err != nil {
			return "", err
		}
		target := s.noteImagePath(to, ref[1])
		if err := os.MkdirAll(filepath.Dir(target), 0700); err != nil {
			return "", err
		}
		if err := os.WriteFile(target, data, 0600); err != nil {
			return "", err
		}
	}
	return strings.ReplaceAll(body, prefix, "neoread-note-image://"+to+"/"), nil
}

// Assets belong to the paper, not its cache. Keep them after annotation deletion
// because an existing note or annotation undo may still refer to the snapshot.
func (s *Server) noteImagePath(document, annotation string) string {
	return filepath.Join(s.Store.Root, "note-assets", document, annotation+".png")
}
func (s *Server) serveNoteImage(w http.ResponseWriter, r *http.Request, document, annotation string) {
	if !noteAssetID.MatchString(document) || !noteAssetID.MatchString(annotation) {
		http.NotFound(w, r)
		return
	}
	if _, err := s.Store.Document(document); err != nil {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "image/png")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	http.ServeFile(w, r, s.noteImagePath(document, annotation))
}
func (s *Server) saveNoteImage(w http.ResponseWriter, r *http.Request) {
	reject := func(message, reason string) {
		s.diagnosticEvent(slog.LevelError, "note.image.rejected", "requestId", requestID(r.Context()), "reasonCode", reason)
		fail(w, 400, message)
	}
	document, annotation := r.PathValue("id"), r.PathValue("annotation")
	if !noteAssetID.MatchString(document) || !noteAssetID.MatchString(annotation) {
		fail(w, 400, "截图编号无效")
		return
	}
	d, err := s.Store.Document(document)
	if err != nil || d.Type != "pdf" {
		fail(w, 404, "PDF 不存在")
		return
	}
	ctx, finish, err := s.beginDocumentTask(r.Context(), document)
	if err != nil {
		fail(w, 409, "文档不可写")
		return
	}
	defer finish()
	var raw string
	if err := s.Store.DB.QueryRow("SELECT body FROM annotations WHERE id=? AND document_id=?", annotation, document).Scan(&raw); err != nil {
		fail(w, 404, "区域批注不存在")
		return
	}
	var saved Annotation
	if json.Unmarshal([]byte(raw), &saved) != nil {
		fail(w, 500, "区域批注无效")
		return
	}
	var location struct {
		Region bool `json:"region"`
	}
	if json.Unmarshal(saved.Location, &location) != nil || !location.Region {
		fail(w, 400, "不是区域批注")
		return
	}
	data, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 8<<20))
	if err != nil {
		reject("截图不得超过 8 MiB", "body_limit")
		return
	}
	config, err := png.DecodeConfig(bytes.NewReader(data))
	if err != nil || config.Width < 1 || config.Height < 1 || config.Width > 8000000 || config.Height > 8000000 || int64(config.Width)*int64(config.Height) > 8000000 {
		reject("截图必须是最多 800 万像素的 PNG", "invalid_png_dimensions")
		return
	}
	if _, err := png.Decode(bytes.NewReader(data)); err != nil {
		reject("截图 PNG 无效", "invalid_png_data")
		return
	}
	path := s.noteImagePath(document, annotation)
	if ctx.Err() != nil {
		s.diagnosticEvent(slog.LevelInfo, "note.image.cancelled", "requestId", requestID(r.Context()), "reasonCode", "document_task_cancelled")
		fail(w, 409, "截图保存已取消")
		return
	}
	if err = os.MkdirAll(filepath.Dir(path), 0700); err == nil {
		var file *os.File
		file, err = os.CreateTemp(filepath.Dir(path), ".snapshot-*.tmp")
		if err == nil {
			defer os.Remove(file.Name())
			_, err = file.Write(data)
			if closeErr := file.Close(); err == nil {
				err = closeErr
			}
			if err == nil {
				if _, exists := os.Stat(path); os.IsNotExist(exists) {
					err = os.Rename(file.Name(), path)
				} else if exists != nil {
					err = exists
				}
			}
		}
	}
	if err != nil {
		s.diagnosticEvent(slog.LevelError, "note.image.save_failed", "requestId", requestID(r.Context()), "documentId", document, "reasonCode", "file_write_failed")
		fail(w, 500, "截图保存失败，区域批注已保留，可重新复制")
		return
	}
	s.diagnosticEvent(slog.LevelInfo, "note.image.saved", "requestId", requestID(r.Context()), "documentId", document, "bytes", len(data))
	respond(w, 200, map[string]bool{"saved": true})
}
