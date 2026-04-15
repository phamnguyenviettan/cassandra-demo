package handlers

import (
	"log"
	"net/http"
	"time"

	"todo-app/db"

	"github.com/gin-gonic/gin"
	"github.com/gocql/gocql"
)

type SmartTodoRequest struct {
	Type        string            `json:"type" binding:"required"` // e.g., "meeting", "iot_trigger"
	Title       string            `json:"title" binding:"required"`
	Description string            `json:"description"`
	Attributes  map[string]string `json:"attributes"` // Dynamic fields
}

// CreateSmartTodo handles creation of polymorphic todos
// POST /api/todos/smart
func CreateSmartTodo(c *gin.Context) {
	var req SmartTodoRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	id := gocql.TimeUUID()
	created := time.Now()

	log.Printf("creating smart todo: %+v", req)

	// Insert with dynamic attributes map
	err := db.Session.Query(`
		INSERT INTO todos (id, title, description, status, type, attributes, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, id, req.Title, req.Description, "pending", req.Type, req.Attributes, created, created).Exec()

	if err != nil {
		log.Printf("❌ Failed to create smart todo: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create smart todo"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":         id,
		"type":       req.Type,
		"attributes": req.Attributes,
		"message":    "Smart Todo Created with Dynamic Schema!",
	})
}

// UpdateTodoAttributes updates just the dynamic attributes
// PATCH /api/todos/:id/attributes
func UpdateTodoAttributes(c *gin.Context) {
	idStr := c.Param("id")
	id, err := gocql.ParseUUID(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var attrs map[string]string
	if err := c.BindJSON(&attrs); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid attributes"})
		return
	}

	// In Cassandra, updating a map adds/updates keys. To replace entirely, you might delete first, 
	// but normally "UPDATE todos SET attributes = attributes + ?" merges.
	// We will use the overwriting behavior for specific keys.
	 err = db.Session.Query(`
		UPDATE todos SET attributes = attributes + ? WHERE id = ?
	`, attrs, id).Exec()

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update attributes"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Attributes updated"})
}
