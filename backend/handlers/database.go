package handlers

import (
	"encoding/json"
	"log"
	"net/http"

	"todo-app/db"
	"todo-app/models"

	"github.com/gin-gonic/gin"
	"github.com/gocql/gocql"
)

// GetDatabaseInfo returns raw data from todos and todo_embeddings tables
func GetDatabaseInfo(c *gin.Context) {
	// Get todos
	var todos []models.Todo
	iter := db.Session.Query(`SELECT id, title, description, is_completed, priority, created_at, updated_at FROM todos`).Iter()
	var todo models.Todo
	for iter.Scan(&todo.ID, &todo.Title, &todo.Description, &todo.IsCompleted, &todo.Priority, &todo.CreatedAt, &todo.UpdatedAt) {
		todos = append(todos, todo)
	}
	iter.Close()
	if todos == nil {
		todos = []models.Todo{}
	}

	// Get embeddings using MapScan to handle VECTOR type
	type EmbeddingRow struct {
		ID         string    `json:"id"`
		TodoID     string    `json:"todo_id"`
		Title      string    `json:"title"`
		Embedding  []float32 `json:"embedding"`
		Dimensions int       `json:"dimensions"`
	}

	// Fetch embeddings directly in one query using toJson to avoid gocql VectorType issues
	var embeddings []EmbeddingRow
	embIter := db.Session.Query(`SELECT id, todo_id, title, toJson(embedding) FROM todo_embeddings`).Iter()
	var embID, todoID gocql.UUID
	var title, embeddingJson string

	for embIter.Scan(&embID, &todoID, &title, &embeddingJson) {
		var fullEmbedding []float32
		if err := json.Unmarshal([]byte(embeddingJson), &fullEmbedding); err != nil {
			log.Printf("⚠️ Failed to parse embedding JSON for %s: %v", title, err)
			continue
		}

		dims := len(fullEmbedding)
		preview := fullEmbedding
		if len(preview) > 50 {
			preview = preview[:50]
		}

		embeddings = append(embeddings, EmbeddingRow{
			ID:         embID.String(),
			TodoID:     todoID.String(),
			Title:      title,
			Embedding:  preview,
			Dimensions: dims,
		})
	}
	
	if err := embIter.Close(); err != nil {
		log.Printf("⚠️ Failed to scan embeddings: %v", err)
	}

	if embeddings == nil {
		embeddings = []EmbeddingRow{}
	}

	// Get history sample
	var history []models.HistoryEvent
	histIter := db.Session.Query(`SELECT todo_id, created_at, event_type, description, metadata FROM todo_history_v2 LIMIT 50`).Iter()
	var h models.HistoryEvent
	for histIter.Scan(&h.TodoID, &h.CreatedAt, &h.EventType, &h.Description, &h.Metadata) {
		history = append(history, h)
	}
	histIter.Close()
	if history == nil {
		history = []models.HistoryEvent{}
	}

	// Table info
	type TableInfo struct {
		Name    string   `json:"name"`
		Count   int      `json:"count"`
		Columns []string `json:"columns"`
	}

	tables := []TableInfo{
		{
			Name:    "todos",
			Count:   len(todos),
			Columns: []string{"id (UUID)", "title (TEXT)", "description (TEXT)", "is_completed (BOOLEAN)", "priority (TEXT)", "status (TEXT)", "created_at (TIMESTAMP)", "updated_at (TIMESTAMP)"},
		},
		{
			Name:    "todo_embeddings",
			Count:   len(embeddings),
			Columns: []string{"id (UUID)", "todo_id (UUID)", "title (TEXT)", "embedding (VECTOR<FLOAT,1536>)", "created_at (TIMESTAMP)"},
		},
		{
			Name:    "todo_history_v2",
			Count:   -1,
			Columns: []string{"todo_id (PK)", "event_id (CK/TIMEUUID)", "created_at (TIMESTAMP)", "event_type (TEXT)", "description (TEXT)", "metadata (MAP)"},
		},
	}

	c.JSON(http.StatusOK, gin.H{
		"keyspace":   "todo_app",
		"tables":     tables,
		"todos":      todos,
		"embeddings": embeddings,
		"history":    history,
	})
}

