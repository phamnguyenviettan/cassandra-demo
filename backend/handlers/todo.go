package handlers

import (
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"todo-app/db"
	"todo-app/models"
	"todo-app/services"

	"github.com/gin-gonic/gin"
	"github.com/gocql/gocql"
)

// GetTodos returns all todos sorted by created_at DESC
func GetTodos(c *gin.Context) {
	var todos []models.Todo

	// Cassandra doesn't support ORDER BY on non-clustering columns easily,
	// so we fetch all and sort in application
	iter := db.Session.Query(`SELECT id, title, description, is_completed, priority, status, created_at, updated_at FROM todos`).Iter()

	var todo models.Todo
	for iter.Scan(&todo.ID, &todo.Title, &todo.Description, &todo.IsCompleted, &todo.Priority, &todo.Status, &todo.CreatedAt, &todo.UpdatedAt) {
		todos = append(todos, todo)
	}
	if err := iter.Close(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch todos"})
		return
	}

	// Sort by created_at DESC in-memory
	for i := 0; i < len(todos); i++ {
		for j := i + 1; j < len(todos); j++ {
			if todos[j].CreatedAt.After(todos[i].CreatedAt) {
				todos[i], todos[j] = todos[j], todos[i]
			}
		}
	}

	if todos == nil {
		todos = []models.Todo{}
	}

	c.JSON(http.StatusOK, todos)
}

// CreateTodo creates a new todo
func CreateTodo(c *gin.Context) {
	var req models.CreateTodoRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate priority
	if req.Priority != models.PriorityLow && req.Priority != models.PriorityMedium && req.Priority != models.PriorityHigh {
		req.Priority = models.PriorityMedium
	}

	id, _ := gocql.RandomUUID()
	now := time.Now()

	err := db.Session.Query(`
		INSERT INTO todos (id, title, description, is_completed, priority, status, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, id, req.Title, req.Description, false, string(req.Priority), "todo", now, now).Exec()

	if err != nil {
		log.Printf("Failed to create todo: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create todo"})
		return
	}

	todo := models.Todo{
		ID:          id,
		Title:       req.Title,
		Description: req.Description,
		IsCompleted: false,
		Priority:    req.Priority,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	// Async log history
	services.LogHistory(id, "created", "Todo created", map[string]string{
		"title":    req.Title,
		"priority": string(req.Priority),
	})

	c.JSON(http.StatusCreated, todo)
}

// ToggleTodo toggles the is_completed status
func ToggleTodo(c *gin.Context) {
	idStr := c.Param("id")
	id, err := gocql.ParseUUID(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	// Get current status
	var isCompleted bool
	err = db.Session.Query(`SELECT is_completed FROM todos WHERE id = ?`, id).Scan(&isCompleted)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Todo not found"})
		return
	}

	// Toggle
	newIsCompleted := !isCompleted
	newStatus := "todo"
	if newIsCompleted {
		newStatus = "completed"
	}
	now := time.Now()
	err = db.Session.Query(`UPDATE todos SET is_completed = ?, status = ?, updated_at = ? WHERE id = ?`, newIsCompleted, newStatus, now, id).Exec()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update todo"})
		return
	}

	// Async log history
	statusDesc := "Marked as incomplete"
	if newIsCompleted {
		statusDesc = "Marked as completed"
	}
	services.LogHistory(id, "status_change", statusDesc, map[string]string{
		"new_status": fmt.Sprintf("%v", newStatus),
	})

	c.JSON(http.StatusOK, gin.H{"id": id.String(), "is_completed": newIsCompleted, "status": newStatus})
}

// UpdateTodoStatus updates the status of a todo
func UpdateTodoStatus(c *gin.Context) {
	idStr := c.Param("id")
	id, err := gocql.ParseUUID(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var req struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Update completion based on status
	isCompleted := false
	if req.Status == "completed" {
		isCompleted = true
	}

	now := time.Now()
	err = db.Session.Query(`UPDATE todos SET status = ?, is_completed = ?, updated_at = ? WHERE id = ?`, req.Status, isCompleted, now, id).Exec()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update status"})
		return
	}

	services.LogHistory(id, "status_update", "Status changed to "+req.Status, map[string]string{
		"new_status": req.Status,
	})

	c.JSON(http.StatusOK, gin.H{"id": id.String(), "status": req.Status, "is_completed": isCompleted})
}

// DeleteTodo deletes a todo
func DeleteTodo(c *gin.Context) {
	idStr := c.Param("id")
	id, err := gocql.ParseUUID(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	// Also delete embedding if exists
	_ = db.Session.Query(`DELETE FROM todo_embeddings WHERE id = ?`, id).Exec()

	err = db.Session.Query(`DELETE FROM todos WHERE id = ?`, id).Exec()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete todo"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Todo deleted"})
}

// SearchTodos performs text-based search on todo titles
func SearchTodos(c *gin.Context) {
	query := c.Query("q")
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Search query is required"})
		return
	}

	var results []models.SearchResult
	queryLower := strings.ToLower(query)

	// Fetch all todos and filter in-memory (Cassandra text search)
	iter := db.Session.Query(`SELECT id, title, description, is_completed, priority, status, created_at, updated_at FROM todos`).Iter()

	var todo models.Todo
	for iter.Scan(&todo.ID, &todo.Title, &todo.Description, &todo.IsCompleted, &todo.Priority, &todo.Status, &todo.CreatedAt, &todo.UpdatedAt) {
		if strings.Contains(strings.ToLower(todo.Title), queryLower) ||
			strings.Contains(strings.ToLower(todo.Description), queryLower) {
			results = append(results, models.SearchResult{
				Todo:   todo,
				Method: "text",
			})
		}
	}
	iter.Close()

	if results == nil {
		results = []models.SearchResult{}
	}

	c.JSON(http.StatusOK, results)
}
