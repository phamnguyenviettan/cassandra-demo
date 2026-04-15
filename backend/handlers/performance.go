package handlers

import (
	"fmt"
	"net/http"
	"sync"
	"time"
	"todo-app/db"

	"github.com/gin-gonic/gin"
	"github.com/gocql/gocql"
)

// StressWriteTest demonstrates Cassandra's massive write throughput
// It writes N records in parallel to the history table
func StressWriteTest(c *gin.Context) {
	idStr := c.Query("id")
	if idStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Todo ID is required"})
		return
	}

	todoID, err := gocql.ParseUUID(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	count := 100 // Number of parallel writes
	var wg sync.WaitGroup
	wg.Add(count)

	startTime := time.Now()

	for i := 0; i < count; i++ {
		go func(idx int) {
			defer wg.Done()
			
			// Each write is independent and sent to the cluster
			// No transactions, no locks = very fast
			db.Session.Query(`
				INSERT INTO todo_history_v2 (todo_id, event_id, created_at, event_type, description, metadata)
				VALUES (?, ?, ?, ?, ?, ?)
			`, todoID, gocql.TimeUUID(), time.Now(), "stress_test", 
			   fmt.Sprintf("Stress test record #%d", idx), 
			   map[string]string{"batch_id": "test_01"}).Exec()
		}(i)
	}

	wg.Wait()
	duration := time.Since(startTime)

	c.JSON(http.StatusOK, gin.H{
		"message":   fmt.Sprintf("Successfully wrote %d records", count),
		"count":     count,
		"duration_ms": duration.Milliseconds(),
		"avg_ms_per_write": float64(duration.Milliseconds()) / float64(count),
	})
}
