package handlers

import (
	"fmt"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"todo-app/db"

	"github.com/gin-gonic/gin"
	"github.com/gocql/gocql"
)

// ─── GET /api/scale/status ────────────────────────────────────────────────────
// Returns topology: which nodes are online, their roles, RF, etc.

func GetScaleStatus(c *gin.Context) {
	type NodeInfo struct {
		Name    string `json:"name"`
		Port    int    `json:"port"`
		Status  string `json:"status"`
		Role    string `json:"role"`
		Address string `json:"address"`
	}

	nodes := []struct {
		session *gocql.Session
		info    NodeInfo
	}{
		{db.SessionNode1, NodeInfo{Name: "cassandra-vector", Port: 9042, Role: "Seed / Primary", Address: "localhost:9042"}},
		{db.SessionNode2, NodeInfo{Name: "cassandra-vector-2", Port: 9043, Role: "Replica", Address: "localhost:9043"}},
		{db.SessionNode3, NodeInfo{Name: "cassandra-vector-3", Port: 9044, Role: "Replica", Address: "localhost:9044"}},
	}

	var nodesResult []NodeInfo
	onlineCount := 0

	for _, n := range nodes {
		info := n.info
		if n.session != nil {
			if err := n.session.Query("SELECT now() FROM system.local").Exec(); err == nil {
				info.Status = "online"
				onlineCount++
			} else {
				info.Status = "unreachable"
			}
		} else {
			info.Status = "offline"
		}
		nodesResult = append(nodesResult, info)
	}

	// Determine cluster health
	health := "degraded"
	if onlineCount == 3 {
		health = "healthy"
	} else if onlineCount >= 2 {
		health = "quorum" // LOCAL_QUORUM still works
	} else if onlineCount == 1 {
		health = "partial"
	} else {
		health = "down"
	}

	c.JSON(http.StatusOK, gin.H{
		"nodes":              nodesResult,
		"online_count":       onlineCount,
		"replication_factor": 3,
		"cluster_health":     health,
		"consistency_levels": []map[string]interface{}{
			{"level": "ONE", "required_nodes": 1, "available": onlineCount >= 1, "description": "Fastest — only 1 replica must ack"},
			{"level": "LOCAL_QUORUM", "required_nodes": 2, "available": onlineCount >= 2, "description": "Balanced — majority (2/3) must ack"},
			{"level": "ALL", "required_nodes": 3, "available": onlineCount >= 3, "description": "Slowest — ALL 3 replicas must ack"},
		},
		"keyspace": "todo_app",
	})
}

// ─── POST /api/scale/benchmark ────────────────────────────────────────────────
// Runs a concurrent write benchmark and returns throughput metrics.

type BenchmarkRequest struct {
	NumClients  int    `json:"num_clients"`
	NumWrites   int    `json:"num_writes"`
	Consistency string `json:"consistency"`
	NodeTarget  string `json:"node_target"` // "node1", "node2", "node3", "cluster"
}

func RunBenchmark(c *gin.Context) {
	var req BenchmarkRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.NumClients <= 0 {
		req.NumClients = 10
	}
	if req.NumClients > 200 {
		req.NumClients = 200
	}
	if req.NumWrites <= 0 {
		req.NumWrites = 100
	}
	if req.NumWrites > 2000 {
		req.NumWrites = 2000
	}

	consistency := parseConsistency(req.Consistency)
	var session *gocql.Session

	switch req.NodeTarget {
	case "node1":
		session = db.SessionNode1
	case "node2":
		session = db.SessionNode2
	case "node3":
		session = db.SessionNode3
	default:
		session = db.Session
	}
	if session == nil {
		session = db.Session
	}

	var successCount int64
	var failCount int64
	var totalLatencyMs int64
	var wg sync.WaitGroup

	writesPerClient := req.NumWrites / req.NumClients
	if writesPerClient < 1 {
		writesPerClient = 1
	}

	startTime := time.Now()

	for i := 0; i < req.NumClients; i++ {
		wg.Add(1)
		go func(clientIdx int) {
			defer wg.Done()
			for j := 0; j < writesPerClient; j++ {
				t0 := time.Now()
				err := session.Query(`
					INSERT INTO scale_benchmarks
					(benchmark_id, timestamp, node_count, consistency, total_writes, duration_ms, throughput_per_sec, avg_latency_ms)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?)
				`,
					gocql.TimeUUID(), time.Now(), 3, req.Consistency, req.NumWrites, int64(0), float32(0), float32(0),
				).Consistency(consistency).Exec()
				lat := time.Since(t0).Milliseconds()
				if err != nil {
					atomic.AddInt64(&failCount, 1)
				} else {
					atomic.AddInt64(&successCount, 1)
					atomic.AddInt64(&totalLatencyMs, lat)
				}
			}
		}(i)
	}

	wg.Wait()
	duration := time.Since(startTime)
	success := atomic.LoadInt64(&successCount)
	throughput := float64(success) / duration.Seconds()
	var avgLat float64
	if success > 0 {
		avgLat = float64(atomic.LoadInt64(&totalLatencyMs)) / float64(success)
	}

	c.JSON(http.StatusOK, gin.H{
		"benchmark": gin.H{
			"num_clients":        req.NumClients,
			"total_writes":       req.NumClients * writesPerClient,
			"success":            success,
			"failed":             atomic.LoadInt64(&failCount),
			"duration_ms":        duration.Milliseconds(),
			"throughput_per_sec": fmt.Sprintf("%.1f", throughput),
			"avg_latency_ms":     fmt.Sprintf("%.2f", avgLat),
			"consistency":        consistencyLabel(req.Consistency),
			"node_target":        req.NodeTarget,
		},
		"scaling_insight": fmt.Sprintf(
			"%.0f writes/sec with %d clients at %s consistency",
			throughput, req.NumClients, consistencyLabel(req.Consistency),
		),
	})
}

// ─── GET /api/scale/consistency-demo ─────────────────────────────────────────
// Reads the same key from all 3 nodes with different consistency levels.

func ConsistencyDemo(c *gin.Context) {
	type ReadResult struct {
		Node        string `json:"node"`
		Consistency string `json:"consistency"`
		Success     bool   `json:"success"`
		LatencyMs   int64  `json:"latency_ms"`
		Error       string `json:"error,omitempty"`
		RecordCount int    `json:"record_count"`
	}

	tests := []struct {
		session     *gocql.Session
		node        string
		consistency gocql.Consistency
		label       string
	}{
		{db.SessionNode1, "node-1 (9042)", gocql.One, "ONE"},
		{db.SessionNode2, "node-2 (9043)", gocql.LocalQuorum, "LOCAL_QUORUM"},
		{db.SessionNode3, "node-3 (9044)", gocql.All, "ALL"},
		{db.Session, "cluster (LB)", gocql.Quorum, "QUORUM"},
	}

	var results []ReadResult
	for _, t := range tests {
		result := ReadResult{
			Node:        t.node,
			Consistency: t.label,
		}

		if t.session == nil {
			result.Success = false
			result.Error = "Node session unavailable"
			results = append(results, result)
			continue
		}

		t0 := time.Now()
		var count int
		err := t.session.Query("SELECT COUNT(*) FROM todos").Consistency(t.consistency).Scan(&count)
		result.LatencyMs = time.Since(t0).Milliseconds()

		if err != nil {
			result.Success = false
			result.Error = err.Error()
		} else {
			result.Success = true
			result.RecordCount = count
		}

		results = append(results, result)
	}

	c.JSON(http.StatusOK, gin.H{
		"results": results,
		"explanation": map[string]string{
			"ONE":         "Read from 1 closest replica. Fastest but may return stale data.",
			"LOCAL_QUORUM": "Read from majority (2/3) in local DC. Strong consistency, still fast.",
			"QUORUM":      "Read from majority across all DCs.",
			"ALL":         "Read from ALL replicas. Slowest. Fails if any node is down.",
		},
	})
}

// ─── GET /api/scale/ha-test ───────────────────────────────────────────────────
// Tests which consistency levels succeed given current node availability.

func HATest(c *gin.Context) {
	type ConsistencyTest struct {
		Level       string `json:"level"`
		Required    int    `json:"required_nodes"`
		Success     bool   `json:"success"`
		LatencyMs   int64  `json:"latency_ms"`
		Error       string `json:"error,omitempty"`
		Description string `json:"description"`
	}

	tests := []struct {
		level       gocql.Consistency
		label       string
		required    int
		description string
	}{
		{gocql.One, "ONE", 1, "Fastest — survives if 2/3 nodes down"},
		{gocql.LocalQuorum, "LOCAL_QUORUM", 2, "Balanced — survives if 1/3 nodes down"},
		{gocql.All, "ALL", 3, "Strictest — fails if ANY node is down"},
	}

	var results []ConsistencyTest
	for _, t := range tests {
		result := ConsistencyTest{
			Level:       t.label,
			Required:    t.required,
			Description: t.description,
		}

		t0 := time.Now()
		err := db.Session.Query("SELECT COUNT(*) FROM todos").Consistency(t.level).Exec()
		result.LatencyMs = time.Since(t0).Milliseconds()

		if err != nil {
			result.Success = false
			result.Error = err.Error()
		} else {
			result.Success = true
		}

		results = append(results, result)
	}

	// Count online nodes
	onlineCount := 0
	for _, s := range []*gocql.Session{db.SessionNode1, db.SessionNode2, db.SessionNode3} {
		if s != nil {
			if err := s.Query("SELECT now() FROM system.local").Exec(); err == nil {
				onlineCount++
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"online_nodes":       onlineCount,
		"replication_factor": 3,
		"consistency_tests":  results,
		"ha_status": func() string {
			if onlineCount == 3 {
				return "FULL HA — All consistency levels work"
			} else if onlineCount == 2 {
				return "PARTIAL HA — ONE and LOCAL_QUORUM work; ALL will fail"
			} else if onlineCount == 1 {
				return "DEGRADED — Only ONE consistency works"
			}
			return "DOWN"
		}(),
	})
}
