package neoread

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"image"
	"image/png"
	"io"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestRegionSnapshotsStayWithTheirPaperUntilPurge(t *testing.T) {
	s := testServer(t)
	w := upload(t, s, "region.pdf", testPDF(1))
	if w.Code != 201 {
		t.Fatal(w.Body.String())
	}
	var d Document
	json.Unmarshal(w.Body.Bytes(), &d)
	location := `{"type":"pdf","page":1,"region":true,"rects":[{"x":0.1,"y":0.2,"width":0.5,"height":0.4}]}`
	w = request(t, s, "POST", "/api/documents/"+d.ID+"/annotations", strings.NewReader(`{"kind":"note","location":`+location+`,"color":"#e6b94c"}`))
	if w.Code != 201 {
		t.Fatal(w.Body.String())
	}
	var a Annotation
	json.Unmarshal(w.Body.Bytes(), &a)
	path := "/api/documents/" + d.ID + "/annotations/" + a.ID + "/image"
	var data bytes.Buffer
	png.Encode(&data, image.NewRGBA(image.Rect(0, 0, 20, 20)))
	if w = request(t, s, "PUT", path, bytes.NewReader(data.Bytes())); w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	expected := filepath.Join(s.Store.Root, "note-assets", d.ID, a.ID+".png")
	if actual, err := os.ReadFile(expected); err != nil || !bytes.Equal(actual, data.Bytes()) {
		t.Fatal("snapshot not stored under its document", err)
	}
	if w = request(t, s, "GET", path, nil); w.Code != 200 || !bytes.Equal(w.Body.Bytes(), data.Bytes()) {
		t.Fatal("snapshot read failed")
	}
	// Authentication and ownership apply independently of the PNG path.
	req := httptest.NewRequest("GET", path, nil)
	out := httptest.NewRecorder()
	s.Handler().ServeHTTP(out, req)
	if out.Code == 200 {
		t.Fatal("unauthenticated snapshot")
	}
	for _, body := range [][]byte{[]byte("not a PNG"), data.Bytes()[:24]} {
		if w = request(t, s, "PUT", path, bytes.NewReader(body)); w.Code != 400 {
			t.Fatal("invalid PNG accepted")
		}
	}
	// A note may still display a snapshot after its source annotation is removed.
	if w = request(t, s, "DELETE", "/api/documents/"+d.ID+"/annotations/"+a.ID, nil); w.Code != 204 {
		t.Fatal(w.Body.String())
	}
	if w = request(t, s, "GET", path, nil); w.Code != 200 {
		t.Fatal("annotation deletion broke existing note images")
	}
	if w = request(t, s, "POST", "/api/documents/"+d.ID+"/trash", nil); w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	if _, err := os.Stat(expected); err != nil {
		t.Fatal("trash deleted snapshot")
	}
	if w = request(t, s, "DELETE", "/api/documents/"+d.ID, nil); w.Code != 204 {
		t.Fatal(w.Body.String())
	}
	if _, err := os.Stat(filepath.Dir(expected)); !os.IsNotExist(err) {
		t.Fatal("purge left snapshot directory", err)
	}
}

func TestRegionGeometryRejectsInvalidRectangles(t *testing.T) {
	for _, rect := range []string{`[]`, `[{"x":-1,"y":0,"width":1,"height":1}]`, `[{"x":0,"y":0,"width":0,"height":1}]`, `[{"x":0.8,"y":0,"width":0.8,"height":1}]`} {
		if validLocation(json.RawMessage(`{"type":"pdf","page":1,"region":true,"rects":`+rect+`}`), "pdf") {
			t.Fatalf("accepted %s", rect)
		}
	}
}

func TestOriginalFigureCanBeStoredAsANoteImage(t *testing.T) {
	s := testServer(t)
	w := upload(t, s, "figure.pdf", testPDF(1))
	if w.Code != 201 {
		t.Fatal(w.Body.String())
	}
	var d Document
	if err := json.Unmarshal(w.Body.Bytes(), &d); err != nil {
		t.Fatal(err)
	}
	annotations := "/api/documents/" + d.ID + "/annotations"
	w = request(t, s, "POST", annotations, strings.NewReader(`{"kind":"note","sourceImageId":"p1-b1","location":{"type":"pdf","page":1},"quote":"Figure 1"}`))
	if w.Code != 201 {
		t.Fatal(w.Body.String())
	}
	var a Annotation
	if err := json.Unmarshal(w.Body.Bytes(), &a); err != nil || a.SourceImageID != "p1-b1" {
		t.Fatal("missing original figure reference", err)
	}
	var pngData bytes.Buffer
	if err := png.Encode(&pngData, image.NewRGBA(image.Rect(0, 0, 12, 12))); err != nil {
		t.Fatal(err)
	}
	asset := annotations + "/" + a.ID + "/image"
	if w = request(t, s, "PUT", asset, bytes.NewReader(pngData.Bytes())); w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	if w = request(t, s, "GET", asset, nil); w.Code != 200 || !bytes.Equal(w.Body.Bytes(), pngData.Bytes()) {
		t.Fatal("original figure snapshot unavailable")
	}
	note := "![Figure 1](neoread-note-image://" + d.ID + "/" + a.ID + ")"
	var archive bytes.Buffer
	if err := s.writeMarkdownArchive(&archive, "", []markdownExportDocument{{"notes.md", note}}, nil, note); err != nil {
		t.Fatal(err)
	}
	contents, err := zip.NewReader(bytes.NewReader(archive.Bytes()), int64(archive.Len()))
	if err != nil {
		t.Fatal(err)
	}
	imagePath := "assets/linked-" + d.ID + "-" + a.ID + ".png"
	markdown, err := contents.Open("notes.md")
	if err != nil {
		t.Fatal(err)
	}
	defer markdown.Close()
	body, err := io.ReadAll(markdown)
	if err != nil || !strings.Contains(string(body), imagePath) || strings.Contains(string(body), "neoread-note-image:") {
		t.Fatalf("invalid archived note: %s (%v)", body, err)
	}
	picture, err := contents.Open(imagePath)
	if err != nil {
		t.Fatal(err)
	}
	defer picture.Close()
	data, err := io.ReadAll(picture)
	if err != nil || !bytes.Equal(data, pngData.Bytes()) {
		t.Fatal("archived image differs", err)
	}
}

func TestMergedNoteSnapshotsAreCopiedToTheSurvivingPaper(t *testing.T) {
	s := testServer(t)
	from, to, asset := strings.Repeat("a", 32), strings.Repeat("b", 32), strings.Repeat("c", 32)
	source := s.noteImagePath(from, asset)
	os.MkdirAll(filepath.Dir(source), 0700)
	os.WriteFile(source, []byte("snapshot"), 0600)
	body := `![region](neoread-note-image://` + from + `/` + asset + `)`
	copied, err := s.copyNoteImages(body, from, to)
	if err != nil || !strings.Contains(copied, "neoread-note-image://"+to+"/") {
		t.Fatal(copied, err)
	}
	if data, err := os.ReadFile(s.noteImagePath(to, asset)); err != nil || string(data) != "snapshot" {
		t.Fatal("snapshot not copied", err)
	}
	if _, err := os.Stat(source); err != nil {
		t.Fatal("source snapshot removed", err)
	}
}
