package models

import (
	"time"

	"github.com/gocql/gocql"
)

type HistoryEvent struct {
	TodoID      gocql.UUID        `json:"todo_id"`
	CreatedAt   time.Time         `json:"created_at"`
	EventType   string            `json:"event_type"`
	Description string            `json:"description"`
	Metadata    map[string]string `json:"metadata"`
}
