package services

import (
	"log"
	"time"
	"todo-app/db"
	"todo-app/models"

	"github.com/gocql/gocql"
)

// LogHistory asynchronously adds an entry to the todo history timeline
// This function is designed to be "fire and forget" to demonstrate high-volume write capability
func LogHistory(todoID gocql.UUID, eventType string, description string, metadata map[string]string) {
	// In a real high-throughput scenario, you might send this to a queue first or buffer it.
	// Cassandra handles massive parallel writes well, so we can launch a goroutine.
	go func() {
		// Use a slight offset if multiple events happen same millisecond to preserve order if needed
		// But in this simple case, Time.Now() is fine.


		err := db.Session.Query(`
			INSERT INTO todo_history_v2 (todo_id, event_id, created_at, event_type, description, metadata)
			VALUES (?, ?, ?, ?, ?, ?)
		`, todoID, gocql.TimeUUID(), time.Now(), eventType, description, metadata).Exec()

		if err != nil {
			log.Printf("❌ Failed to log history event for %s: %v", todoID, err)
		} else {
			// Optional logging to confirm write happened
			// log.Printf("📝 History logged: %s - %s", eventType, description)
		}
	}()
}

// GetHistory retrieves the timeline for a Todo item
// Demonstrates efficient time-range queries (Partition Key + Clustering Key)
func GetHistory(todoID gocql.UUID, limit int) ([]models.HistoryEvent, error) {
	if limit <= 0 {
		limit = 50
	}

	var events []models.HistoryEvent
	iter := db.Session.Query(`
		SELECT todo_id, created_at, event_type, description, metadata
		FROM todo_history_v2
		WHERE todo_id = ?
		LIMIT ?
	`, todoID, limit).Iter()

	var event models.HistoryEvent
	for iter.Scan(&event.TodoID, &event.CreatedAt, &event.EventType, &event.Description, &event.Metadata) {
		events = append(events, event)
	}

	if err := iter.Close(); err != nil {
		return nil, err
	}

	if events == nil {
		events = []models.HistoryEvent{}
	}

	return events, nil
}
