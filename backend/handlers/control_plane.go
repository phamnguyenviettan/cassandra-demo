package handlers

import (
	"net/http"

	"todo-app/db"

	"github.com/gin-gonic/gin"
)

// GetClusterStatus checks connection to all 3 individual nodes
// GET /api/demo/cluster/status
func GetClusterStatus(c *gin.Context) {
	type NodeStatus struct {
		Status string `json:"status"`
		Port   int    `json:"port"`
		Name   string `json:"name"`
		DC     string `json:"dc"`
	}

	// Node 1
	status1 := NodeStatus{Port: 9042, Name: "cassandra-vector", DC: "datacenter1"}
	if db.SessionNode1 != nil {
		if err := db.SessionNode1.Query("SELECT now() FROM system.local").Exec(); err == nil {
			status1.Status = "online"
		} else {
			status1.Status = "unreachable"
		}
	} else {
		status1.Status = "offline"
	}

	// Node 2
	status2 := NodeStatus{Port: 9043, Name: "cassandra-vector-2", DC: "datacenter1"}
	if db.SessionNode2 != nil {
		if err := db.SessionNode2.Query("SELECT now() FROM system.local").Exec(); err == nil {
			status2.Status = "online"
		} else {
			status2.Status = "unreachable"
		}
	} else {
		status2.Status = "offline"
	}

	// Node 3
	status3 := NodeStatus{Port: 9044, Name: "cassandra-vector-3", DC: "datacenter1"}
	if db.SessionNode3 != nil {
		if err := db.SessionNode3.Query("SELECT now() FROM system.local").Exec(); err == nil {
			status3.Status = "online"
		} else {
			status3.Status = "unreachable"
		}
	} else {
		status3.Status = "offline"
	}

	result := map[string]NodeStatus{
		"node_1": status1,
		"node_2": status2,
		"node_3": status3,
	}

	// Count online
	onlineCount := 0
	for _, v := range result {
		if v.Status == "online" {
			onlineCount++
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"nodes":              result,
		"online_count":       onlineCount,
		"replication_factor": 3,
		"quorum_available":   onlineCount >= 2,
		"all_available":      onlineCount == 3,
	})
}
