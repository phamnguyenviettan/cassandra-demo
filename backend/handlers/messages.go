package handlers

import (
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"sync"
	"sync/atomic"
	"time"
	"strings"
	"net"

	"todo-app/db"
	"github.com/gin-gonic/gin"
	"github.com/gocql/gocql"
)

// ─── Model ───────────────────────────────────────────────────────────────────

type MessageRequest struct {
	RoomID      string            `json:"room_id" binding:"required"`
	Sender      string            `json:"sender" binding:"required"`
	Content     string            `json:"content" binding:"required"`
	Consistency string            `json:"consistency"` // ONE, QUORUM, LOCAL_QUORUM, ALL
	Metadata    map[string]string `json:"metadata"`
}

type Message struct {
	RoomID          string            `json:"room_id"`
	MessageID       string            `json:"message_id"`
	Sender          string            `json:"sender"`
	Content         string            `json:"content"`
	NodeWritten     string            `json:"node_written"`
	ConsistencyUsed string            `json:"consistency_used"`
	Timestamp       time.Time         `json:"timestamp"`
	Metadata        map[string]string `json:"metadata"`
}

type ConcurrentWriteRequest struct {
	RoomID        string `json:"room_id" binding:"required"`
	NumClients    int    `json:"num_clients"`
	MessagesEach  int    `json:"messages_each"`
	Consistency   string `json:"consistency"`
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

func parseConsistency(level string) gocql.Consistency {
	switch level {
	case "ALL":
		return gocql.All
	case "QUORUM":
		return gocql.Quorum
	case "LOCAL_QUORUM":
		return gocql.LocalQuorum
	case "TWO":
		return gocql.Two
	case "THREE":
		return gocql.Three
	default:
		return gocql.One
	}
}

func consistencyLabel(level string) string {
	if level == "" {
		return "ONE"
	}
	return level
}

func nodeForPort(port int) string {
	switch port {
	case 9042:
		return "node-1"
	case 9043:
		return "node-2"
	case 9044:
		return "node-3"
	default:
		return "cluster"
	}
}

// ─── POST /api/messages ───────────────────────────────────────────────────────

func SendMessage(c *gin.Context) {
	var req MessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	consistency := parseConsistency(req.Consistency)
	msgID := gocql.TimeUUID()
	now := time.Now()

	if req.Metadata == nil {
		req.Metadata = map[string]string{}
	}

	// Randomly select a node to write through (for demo visualization)
	nodes := []struct {
		session *gocql.Session
		name    string
	}{
		{db.SessionNode1, "node-1"},
		{db.SessionNode2, "node-2"},
		{db.SessionNode3, "node-3"},
	}

	// Lọc các Node thực sự còn sống (TCP PING) để gán nhãn node_written cho chuẩn xác
	available := []struct {
		session *gocql.Session
		name    string
	}{}
	for i, n := range nodes {
		if n.session != nil {
			// PING thẳng TCP Core Port để xuyên qua lớp màng bọc HA của Driver
			port := 9042 + i
			if conn, err := net.DialTimeout("tcp", fmt.Sprintf("127.0.0.1:%d", port), 200*time.Millisecond); err == nil {
				conn.Close()
				available = append(available, n)
			}
		}
	}
	if len(available) == 0 {
		available = append(available, struct {
			session *gocql.Session
			name    string
		}{db.Session, "cluster"})
	}

	chosen := available[rand.Intn(len(available))]

	// Set consistency on session query
	err := chosen.session.Query(`
		INSERT INTO messages (room_id, message_id, sender, content, node_written, consistency_used, metadata)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, req.RoomID, msgID, req.Sender, req.Content, chosen.name, consistencyLabel(req.Consistency), req.Metadata).
		Consistency(consistency).
		Exec()

	if err != nil {
		log.Printf("❌ Failed to write message with consistency %s: %v", req.Consistency, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":       "Write failed",
			"detail":      err.Error(),
			"consistency": consistencyLabel(req.Consistency),
			"hint":        "ALL consistency may fail if a node is down. Try LOCAL_QUORUM.",
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message_id":      msgID.String(),
		"room_id":         req.RoomID,
		"node_written":    chosen.name,
		"consistency":     consistencyLabel(req.Consistency),
		"timestamp":       now,
		"replication_note": "With RF=3, this message is replicated to all 3 nodes",
	})
}

// ─── GET /api/messages/:room_id ───────────────────────────────────────────────

func GetMessages(c *gin.Context) {
	roomID := c.Param("room_id")
	consistency := parseConsistency(c.Query("consistency"))
	limit := 50

	var messages []Message
	iter := db.Session.Query(`
		SELECT room_id, message_id, sender, content, node_written, consistency_used, metadata
		FROM messages
		WHERE room_id = ?
		LIMIT ?
	`, roomID, limit).Consistency(consistency).Iter()

	var msg Message
	var msgID gocql.UUID
	for iter.Scan(&msg.RoomID, &msgID, &msg.Sender, &msg.Content, &msg.NodeWritten, &msg.ConsistencyUsed, &msg.Metadata) {
		msg.MessageID = msgID.String()
		msg.Timestamp = msgID.Time()
		if msg.Metadata == nil {
			msg.Metadata = map[string]string{}
		}
		messages = append(messages, msg)
	}
	if err := iter.Close(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch messages"})
		return
	}

	if messages == nil {
		messages = []Message{}
	}

	c.JSON(http.StatusOK, gin.H{
		"room_id":     roomID,
		"messages":    messages,
		"count":       len(messages),
		"consistency": c.Query("consistency"),
	})
}

// ─── GET /api/messages/:room_id/search ────────────────────────────────────────

func SearchMessages(c *gin.Context) {
	roomID := c.Param("room_id")
	key := c.Query("meta_key")
	val := c.Query("meta_val")
	q := c.Query("q")

	if (key == "" || val == "") && q == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cung cấp meta_key/meta_val hoặc q"})
		return
	}

	var messages []Message
	var iter *gocql.Iter

	if key != "" && val != "" {
		// Tìm qua SAI Index trên Map
		queryStr := fmt.Sprintf(`
			SELECT room_id, message_id, sender, content, node_written, consistency_used, metadata
			FROM messages
			WHERE room_id = ? AND metadata['%s'] = ?
			LIMIT 500
		`, key)
		iter = db.Session.Query(queryStr, roomID, val).Consistency(gocql.One).Iter()
	} else {
		// Lấy giới hạn trong 1 room partition để text filter
		iter = db.Session.Query(`
			SELECT room_id, message_id, sender, content, node_written, consistency_used, metadata
			FROM messages
			WHERE room_id = ?
			LIMIT 500
		`, roomID).Consistency(gocql.One).Iter()
	}

	var msg Message
	var msgID gocql.UUID
	qLower := strings.ToLower(q)

	for iter.Scan(&msg.RoomID, &msgID, &msg.Sender, &msg.Content, &msg.NodeWritten, &msg.ConsistencyUsed, &msg.Metadata) {
		// Text filter (phù hợp với Partition)
		if qLower != "" && !strings.Contains(strings.ToLower(msg.Content), qLower) && !strings.Contains(strings.ToLower(msg.Sender), qLower) {
			continue
		}

		msg.MessageID = msgID.String()
		msg.Timestamp = msgID.Time()
		if msg.Metadata == nil {
			msg.Metadata = map[string]string{}
		}
		messages = append(messages, msg)
	}
	if err := iter.Close(); err != nil {
		log.Printf("SearchMessages error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Search failed (chưa tạo index trên map?)"})
		return
	}

	if messages == nil {
		messages = []Message{}
	}

	c.JSON(http.StatusOK, gin.H{
		"room_id":  roomID,
		"messages": messages,
		"count":    len(messages),
		"search":   gin.H{"key": key, "value": val},
	})
}

// ─── GET /api/messages/rooms ──────────────────────────────────────────────────

func GetRooms(c *gin.Context) {
	// Cassandra doesn't support DISTINCT easily on partition key with conditions.
	// We use a small demo approach: return known rooms + count from DB.
	rooms := []map[string]interface{}{}

	demoRooms := []string{"general", "tech", "random", "cassandra-demo"}
	for _, room := range demoRooms {
		var count int
		db.Session.Query(`SELECT COUNT(*) FROM messages WHERE room_id = ?`, room).Scan(&count)
		rooms = append(rooms, map[string]interface{}{
			"room_id":       room,
			"message_count": count,
		})
	}

	c.JSON(http.StatusOK, gin.H{"rooms": rooms})
}

// ─── POST /api/messages/concurrent ───────────────────────────────────────────
// Simulates N concurrent clients each writing M messages — demonstrates
// Cassandra's leaderless, lock-free write scalability.

func ConcurrentWriteTest(c *gin.Context) {
	var req ConcurrentWriteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.NumClients <= 0 {
		req.NumClients = 20
	}
	if req.NumClients > 100 {
		req.NumClients = 100
	}
	if req.MessagesEach <= 0 {
		req.MessagesEach = 5
	}
	if req.MessagesEach > 50 {
		req.MessagesEach = 50
	}

	consistency := parseConsistency(req.Consistency)
	totalWrites := req.NumClients * req.MessagesEach

	var successCount int64
	var failCount int64
	var wg sync.WaitGroup

	startTime := time.Now()

	senders := []string{"Alice", "Bob", "Carol", "Dave", "Eve", "Frank", "Grace", "Heidi",
		"Ivan", "Judy", "Mallory", "Niaj", "Olivia", "Peggy", "Rupert", "Sybil",
		"Trent", "Victor", "Walter", "Xavier", "Yvonne", "Zara"}

	// [Sửa Lỗi UI]: Quét lại danh sách node thực sự đang SỐNG bằng TCP Socket
	aliveNodes := []struct {
		session *gocql.Session
		name    string
	}{}
	nodes := []struct {
		session *gocql.Session
		name    string
	}{
		{db.SessionNode1, "node-1"},
		{db.SessionNode2, "node-2"},
		{db.SessionNode3, "node-3"},
	}

	for i, n := range nodes {
		if n.session != nil {
			port := 9042 + i
			if conn, err := net.DialTimeout("tcp", fmt.Sprintf("127.0.0.1:%d", port), 200*time.Millisecond); err == nil {
				conn.Close()
				aliveNodes = append(aliveNodes, struct {
					session *gocql.Session
					name    string
				}{n.session, n.name})
			}
		}
	}
	if len(aliveNodes) == 0 {
		aliveNodes = append(aliveNodes, struct {
			session *gocql.Session
			name    string
		}{db.Session, "cluster"})
	}

	for clientIdx := 0; clientIdx < req.NumClients; clientIdx++ {
		wg.Add(1)
		go func(cIdx int) {
			defer wg.Done()
			sender := senders[cIdx%len(senders)]

			for msgIdx := 0; msgIdx < req.MessagesEach; msgIdx++ {
				msgID := gocql.TimeUUID()
				content := fmt.Sprintf("Message %d from client-%d (concurrent demo)", msgIdx+1, cIdx+1)
				
				// Trỏ request vào 1 trong các Node thực sự sống để đảm bảo UI không hiện tên Node sập
				chosen := aliveNodes[(cIdx+msgIdx)%len(aliveNodes)]
				session := chosen.session
				nodeName := chosen.name

				// Sinh Random Metadata để Demo sự linh hoạt của NoSQL MAP
				devices := []string{"iPhone", "Android", "Web", "Desktop"}
				regions := []string{"VN", "US", "JP", "EU", "KR"}
				networks := []string{"4G", "5G", "WiFi"}
				metaMap := map[string]string{
					"batch":     "concurrent_test",
					"client_id": fmt.Sprintf("client-%d", cIdx+1),
				}
				
				if rand.Intn(100) > 20 { metaMap["device"] = devices[rand.Intn(len(devices))] }
				if rand.Intn(100) > 40 { metaMap["region"] = regions[rand.Intn(len(regions))] }
				if rand.Intn(100) > 60 { metaMap["network"] = networks[rand.Intn(len(networks))] }

				err := session.Query(`
					INSERT INTO messages (room_id, message_id, sender, content, node_written, consistency_used, metadata)
					VALUES (?, ?, ?, ?, ?, ?, ?)
				`, req.RoomID, msgID, sender, content, nodeName, consistencyLabel(req.Consistency), metaMap).
					Consistency(consistency).Exec()

				if err != nil {
					atomic.AddInt64(&failCount, 1)
				} else {
					atomic.AddInt64(&successCount, 1)
				}
			}
		}(clientIdx)
	}

	wg.Wait()
	duration := time.Since(startTime)
	throughput := float64(atomic.LoadInt64(&successCount)) / duration.Seconds()

	c.JSON(http.StatusOK, gin.H{
		"summary": gin.H{
			"num_clients":       req.NumClients,
			"messages_each":     req.MessagesEach,
			"total_attempted":   totalWrites,
			"success":           atomic.LoadInt64(&successCount),
			"failed":            atomic.LoadInt64(&failCount),
			"duration_ms":       duration.Milliseconds(),
			"throughput_per_sec": fmt.Sprintf("%.1f", throughput),
			"consistency":       consistencyLabel(req.Consistency),
		},
		"cassandra_advantage": "No coordinator locks. Writes go directly to replica nodes. Zero write contention.",
		"room_id":            req.RoomID,
	})
}
