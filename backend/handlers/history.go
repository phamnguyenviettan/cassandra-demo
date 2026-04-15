package handlers

import (
	"fmt"
	"net/http"
	"todo-app/services"

	"github.com/gin-gonic/gin"
	"github.com/gocql/gocql"
)

// GetTodoHistory retrieves the activity log for a specific todo
func GetTodoHistory(c *gin.Context) {
	idStr := c.Param("id")
	id, err := gocql.ParseUUID(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	history, err := services.GetHistory(id, 50)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to fetch history: %v", err)})
		return
	}

	c.JSON(http.StatusOK, history)
}
