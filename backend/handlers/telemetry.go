package handlers

import (
	"log"
	"net/http"
	"sync"
	"time"

	"todo-app/db"

	"github.com/gin-gonic/gin"
	"github.com/gocql/gocql"
)

type TelemetryPayload struct {
	UserID     string            `json:"user_id"`
	Attributes map[string]string `json:"attributes"`
	Timestamp  string            `json:"timestamp"` // ISO8601
}

var (
	// Worker Pool for High Speed Ingestion
	telemetryQueue = make(chan TelemetryPayload, 10000) // Buffer 10k items
	
	// Real-time server stats (In-Memory for Demo)
	serverStatsMutex sync.Mutex
	TotalReceived    int64
)

func init() {
	// Start 50 workers to process the queue
	for i := 0; i < 50; i++ {
		go telemetryWorker()
	}
}

func telemetryWorker() {
	for payload := range telemetryQueue {
		if db.Session == nil {
			continue
		}

		userID, err := gocql.ParseUUID(payload.UserID)
		if err != nil {
			continue
		}

		// Timestamp logic
		ts := time.Now()
		if payload.Timestamp != "" {
			if parsed, err := time.Parse(time.RFC3339, payload.Timestamp); err == nil {
				ts = parsed
			}
		}

		// Bucket
		bucketID := ts.Format("2006-01-02-15")

		// Prepare Query (Reuse logic)
		query := `INSERT INTO user_telemetry (user_id, bucket_id, timestamp, attributes) VALUES (?, ?, ?, ?)`
		
		// Execute synchronously within the worker (the worker IS the async part)
		err = db.Session.Query(query, userID, bucketID, ts, payload.Attributes).Exec()
		if err != nil {
			log.Printf("❌ Worker Write Failed: %v", err)
		} else {
			// Increment Real Counter
			serverStatsMutex.Lock()
			TotalReceived++
			serverStatsMutex.Unlock()
		}
	}
}

// GetStats returns the real server-side write count
// GET /api/demo/stats
func GetStats(c *gin.Context) {
	serverStatsMutex.Lock()
	count := TotalReceived
	serverStatsMutex.Unlock()

	c.JSON(200, gin.H{
		"total_writes": count,
		"active":       len(telemetryQueue) > 0, // Considered active if queue has items
	})
}

// StreamTelemetry handles high-frequency data ingestion
// POST /api/telemetry/stream
func StreamTelemetry(c *gin.Context) {
	var payload TelemetryPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Push to Queue (Non-blocking unless full)
	// log.Printf("Received Telemetry: %+v", payload) // Debugging
	select {
	case telemetryQueue <- payload:
		c.Status(http.StatusAccepted)
	default:
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Queue Full - Slow Down!"})
	}
}

// GetTelemetry fetches recent telemetry for a user
// GET /api/telemetry/:user_id
func GetTelemetry(c *gin.Context) {
	userIDStr := c.Param("user_id")
	userID, err := gocql.ParseUUID(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid User ID"})
		return
	}

	// Get current bucket
	bucketID := time.Now().Format("2006-01-02-15")

	// Check for ?node=node_2 query param to simulate reading from a specific replica
	nodeParam := c.Query("node")
	var session *gocql.Session

	if nodeParam == "node_2" {
		if db.SessionNode2 == nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Node 2 unavailable"})
			return
		}
		session = db.SessionNode2
	} else if nodeParam == "node_1" {
		if db.SessionNode1 == nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Node 1 unavailable"})
			return
		}
		session = db.SessionNode1
	} else {
		session = db.Session // Load balanced
	}

	var metrics []map[string]interface{}
	iter := session.Query(`
		SELECT timestamp, attributes 
		FROM user_telemetry 
		WHERE user_id = ? AND bucket_id = ? 
		LIMIT 50
	`, userID, bucketID).Iter()

	var timestamp time.Time
	var attributes map[string]string
	for iter.Scan(&timestamp, &attributes) {
		metrics = append(metrics, map[string]interface{}{
			"timestamp":   timestamp,
			"attributes":  attributes,
			"user_id":     userIDStr, // Include UserID for frontend
			"node":        nodeParam, // Return which node was queried
		})
	}

	if err := iter.Close(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch telemetry from " + nodeParam})
		return
	}

	c.JSON(http.StatusOK, metrics)
}
