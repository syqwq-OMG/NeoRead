package neoread

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func TestChatTimeoutConfigPreservesOmissionAndExplicitUnlimited(t *testing.T) {
	s := testServer(t)
	for _, step := range []struct {
		body string
		want int
	}{
		{`{"chatTimeoutMinutes":30}`, 30}, {`{}`, 30}, {`{"chatTimeoutMinutes":0}`, 0}, {`{"chatTimeoutMinutes":1440}`, 1440},
	} {
		out := request(t, s, "PUT", "/api/ai/config", strings.NewReader(step.body))
		if out.Code != 200 {
			t.Fatal(out.Code, out.Body.String())
		}
		var returned AIConfig
		if err := json.Unmarshal(out.Body.Bytes(), &returned); err != nil {
			t.Fatal(err)
		}
		stored := s.aiConfig().ChatTimeoutMinutes
		if stored == nil || *stored != step.want || returned.ChatTimeoutMinutes == nil || *returned.ChatTimeoutMinutes != step.want {
			t.Fatalf("timeout not preserved: %+v", returned)
		}
	}
	for _, value := range []string{"-1", "1441", "1.5", `"60"`} {
		out := request(t, s, "PUT", "/api/ai/config", strings.NewReader(`{"chatTimeoutMinutes":`+value+`}`))
		if out.Code != 400 {
			t.Fatal(value, out.Code)
		}
		if *s.aiConfig().ChatTimeoutMinutes != 1440 {
			t.Fatal("invalid save changed the existing preference")
		}
	}
}

func TestChatRunFreezesConfiguredTimeoutAndRespectsCancellation(t *testing.T) {
	for _, minutes := range []int{0, 10, 120, 1440} {
		config := AIConfig{ChatTimeoutMinutes: &minutes}
		ctx, cancel := chatRunContext(context.Background(), config)
		deadline, bounded := ctx.Deadline()
		if bounded != (minutes > 0) {
			t.Fatalf("minutes=%d deadline=%v", minutes, deadline)
		}
		if bounded && (time.Until(deadline) > time.Duration(minutes)*time.Minute || time.Until(deadline) < time.Duration(minutes)*time.Minute-time.Second) {
			t.Fatal("wrong timeout", deadline)
		}
		config.ChatTimeoutMinutes = new(int)
		if got, _ := ctx.Deadline(); got != deadline {
			t.Fatal("in-flight limit changed")
		}
		cancel()
		<-ctx.Done()
		if ctx.Err() != context.Canceled {
			t.Fatal(ctx.Err())
		}
	}
	parent, stop := context.WithTimeout(context.Background(), time.Millisecond)
	defer stop()
	minutes := 60
	ctx, cancel := chatRunContext(parent, AIConfig{ChatTimeoutMinutes: &minutes})
	defer cancel()
	<-ctx.Done()
	if ctx.Err() != context.DeadlineExceeded {
		t.Fatal(ctx.Err())
	}
}
