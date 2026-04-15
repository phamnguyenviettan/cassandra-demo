package models

import (
	"time"

	"github.com/gocql/gocql"
)

type Priority string

const (
	PriorityLow    Priority = "Low"
	PriorityMedium Priority = "Medium"
	PriorityHigh   Priority = "High"
)

type Todo struct {
	ID          gocql.UUID `json:"id"`
	Title       string     `json:"title"`
	Description string     `json:"description"`
	IsCompleted bool       `json:"is_completed"`
	Priority    Priority   `json:"priority"`
	Status      string     `json:"status"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

type CreateTodoRequest struct {
	Title       string   `json:"title" binding:"required"`
	Description string   `json:"description"`
	Priority    Priority `json:"priority" binding:"required"`
}

type TodoEmbedding struct {
	ID        gocql.UUID `json:"id"`
	TodoID    gocql.UUID `json:"todo_id"`
	Title     string     `json:"title"`
	Embedding []float32  `json:"embedding"`
	CreatedAt time.Time  `json:"created_at"`
}

type GenerateTaskRequest struct {
	Prompt string `json:"prompt" binding:"required"`
}

type VectorSearchRequest struct {
	Query string `json:"query" binding:"required"`
	TopK  int    `json:"top_k"`
}

type SearchResult struct {
	Todo            Todo      `json:"todo"`
	Score           float32   `json:"score,omitempty"`
	Method          string    `json:"method"`
	EmbeddingPreview []float32 `json:"embedding_preview,omitempty"`
}

type CompareSearchResponse struct {
	Query         string         `json:"query"`
	NormalResults []SearchResult `json:"normal_results"`
	VectorResults []SearchResult `json:"vector_results"`
	QueryEmbedding []float32    `json:"query_embedding_preview"`
}
