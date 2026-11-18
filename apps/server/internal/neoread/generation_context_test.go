package neoread

import (
	"context"
	"testing"
	"time"
)

func TestInteractiveGenerationContext(t *testing.T) {
	parent, stop := context.WithCancel(context.Background())
	ctx, cancel := generationContext(parent, true, time.Nanosecond)
	defer cancel()
	if _, bounded := ctx.Deadline(); bounded {
		t.Fatal("chat must not have a total runtime deadline")
	}
	stop()
	<-ctx.Done()
	if ctx.Err() != context.Canceled {
		t.Fatal(ctx.Err())
	}
	parent, stop = context.WithTimeout(context.Background(), time.Second)
	defer stop()
	ctx, cancel = generationContext(parent, true, time.Hour)
	defer cancel()
	if deadline, ok := ctx.Deadline(); !ok {
		t.Fatal("caller deadline lost")
	} else if original, _ := parent.Deadline(); deadline != original {
		t.Fatal("caller deadline changed")
	}
	ctx, cancel = generationContext(context.Background(), false, time.Second)
	defer cancel()
	if _, ok := ctx.Deadline(); !ok {
		t.Fatal("background generation must remain bounded")
	}
}
