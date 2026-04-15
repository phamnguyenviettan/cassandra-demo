package db

import (
	"fmt"
	"log"
	"time"

	"github.com/gocql/gocql"
)

var (
	Session      *gocql.Session // Connected to Cluster (Load Balanced)
	SessionNode1 *gocql.Session // Connected to Node 1 only (port 9042)
	SessionNode2 *gocql.Session // Connected to Node 2 only (port 9043)
	SessionNode3 *gocql.Session // Connected to Node 3 only (port 9044)
)

// Helper to create a session for a specific host(s) and port
func createSession(hosts []string, port int, keyspace string) (*gocql.Session, error) {
	cluster := gocql.NewCluster(hosts...)
	cluster.Port = port
	cluster.Keyspace = keyspace
	cluster.Consistency = gocql.One
	cluster.Timeout = 30 * time.Second
	cluster.ConnectTimeout = 30 * time.Second
	return cluster.CreateSession()
}

// CreateSessionWithConsistency creates a session with a specific consistency level
func CreateSessionWithConsistency(c gocql.Consistency) (*gocql.Session, error) {
	cluster := gocql.NewCluster("localhost")
	cluster.Port = 9042
	cluster.Keyspace = "todo_app"
	cluster.Consistency = c
	cluster.Timeout = 30 * time.Second
	cluster.ConnectTimeout = 30 * time.Second
	return cluster.CreateSession()
}

func Connect(host string, port int) error {
	// 1. Main Cluster Connection — bootstrap without keyspace
	log.Println("🔌 Connecting to Main Cluster...")
	cluster := gocql.NewCluster(host)
	cluster.Port = port
	cluster.Consistency = gocql.One
	cluster.Timeout = 60 * time.Second
	cluster.ConnectTimeout = 60 * time.Second

	var session *gocql.Session
	var err error
	for i := 0; i < 15; i++ {
		cluster.Keyspace = ""
		session, err = cluster.CreateSession()
		if err == nil {
			break
		}
		log.Printf("⏳ Cassandra Node 1 not ready (attempt %d/15): %v", i+1, err)
		time.Sleep(5 * time.Second)
	}
	if err != nil {
		return fmt.Errorf("failed to connect to Cassandra Node 1: %v", err)
	}

	// Create keyspace with RF=3 (NetworkTopologyStrategy for production-like setup)
	err = session.Query(`
		CREATE KEYSPACE IF NOT EXISTS todo_app
		WITH replication = {
			'class': 'SimpleStrategy',
			'replication_factor': 3
		}
	`).Exec()
	if err != nil {
		// Try to alter if already exists with different RF
		log.Printf("⚠️  Keyspace create note: %v", err)
	}

	// Try to alter existing keyspace to RF=3
	_ = session.Query(`
		ALTER KEYSPACE todo_app
		WITH replication = {
			'class': 'SimpleStrategy',
			'replication_factor': 3
		}
	`).Exec()

	session.Close()

	// 2. Main Session (connected to node 1, gocql auto-discovers cluster)
	Session, err = createSession([]string{host}, port, "todo_app")
	if err != nil {
		return fmt.Errorf("failed to connect to Cluster: %v", err)
	}

	// 3. Session Node 1 (Explicitly Node 1 — port 9042)
	SessionNode1, err = createSession([]string{host}, port, "todo_app")
	if err != nil {
		log.Printf("⚠️ Failed to connect to Node 1: %v", err)
	} else {
		log.Println("✅ Connected to Node 1 (port 9042)")
	}

	// 4. Session Node 2 (Explicitly Node 2 — port 9043)
	SessionNode2, err = createSession([]string{host}, 9043, "todo_app")
	if err != nil {
		log.Printf("⚠️ Failed to connect to Node 2 (is it up?): %v", err)
	} else {
		log.Println("✅ Connected to Node 2 (port 9043)")
	}

	// 5. Session Node 3 (Explicitly Node 3 — port 9044)
	SessionNode3, err = createSession([]string{host}, 9044, "todo_app")
	if err != nil {
		log.Printf("⚠️ Failed to connect to Node 3 (is it up?): %v", err)
	} else {
		log.Println("✅ Connected to Node 3 (port 9044)")
	}

	log.Println("✅ Connected to Cassandra Cluster (RF=3)")
	return nil
}

func InitSchema() error {
	// ── TODOS ──────────────────────────────────────────────────────────────
	err := Session.Query(`
		CREATE TABLE IF NOT EXISTS todos (
			id UUID,
			title TEXT,
			description TEXT,
			is_completed BOOLEAN,
			priority TEXT,
			status TEXT,
			created_at TIMESTAMP,
			updated_at TIMESTAMP,
			attributes MAP<TEXT, TEXT>,
			type TEXT,
			PRIMARY KEY (id)
		)
	`).Exec()
	if err != nil {
		return fmt.Errorf("failed to create todos table: %v", err)
	}

	_ = Session.Query(`ALTER TABLE todos ADD status TEXT`).Exec()
	_ = Session.Query(`ALTER TABLE todos ADD attributes MAP<TEXT, TEXT>`).Exec()
	_ = Session.Query(`ALTER TABLE todos ADD type TEXT`).Exec()

	_ = Session.Query(`
		CREATE CUSTOM INDEX IF NOT EXISTS todos_created_at_idx ON todos (created_at)
		USING 'StorageAttachedIndex'
	`).Exec()
	_ = Session.Query(`
		CREATE CUSTOM INDEX IF NOT EXISTS todos_title_idx ON todos (title)
		USING 'StorageAttachedIndex'
		WITH OPTIONS = {'case_sensitive': false, 'normalize': true, 'ascii': true}
	`).Exec()

	// ── TODO EMBEDDINGS ───────────────────────────────────────────────────
	err = Session.Query(`
		CREATE TABLE IF NOT EXISTS todo_embeddings (
			id UUID,
			todo_id UUID,
			title TEXT,
			embedding VECTOR<FLOAT, 1536>,
			created_at TIMESTAMP,
			PRIMARY KEY (id)
		)
	`).Exec()
	if err != nil {
		return fmt.Errorf("failed to create todo_embeddings table: %v", err)
	}

	_ = Session.Query(`
		CREATE CUSTOM INDEX IF NOT EXISTS todo_embeddings_vector_idx ON todo_embeddings (embedding)
		USING 'StorageAttachedIndex'
		WITH OPTIONS = {'similarity_function': 'cosine'}
	`).Exec()

	// ── TODO HISTORY ──────────────────────────────────────────────────────
	err = Session.Query(`
		CREATE TABLE IF NOT EXISTS todo_history_v2 (
			todo_id UUID,
			event_id TIMEUUID,
			created_at TIMESTAMP,
			event_type TEXT,
			description TEXT,
			metadata MAP<TEXT, TEXT>,
			PRIMARY KEY ((todo_id), event_id)
		) WITH CLUSTERING ORDER BY (event_id DESC)
	`).Exec()
	if err != nil {
		return fmt.Errorf("failed to create todo_history table: %v", err)
	}

	// ── MESSAGES (NoSQL Time-Series) ───────────────────────────────────────
	// Partition by room_id, cluster by message_id (TIMEUUID) DESC
	// Designed for high-concurrency writes — no locking, no collisions
	 err = Session.Query(`
		CREATE TABLE IF NOT EXISTS messages (
			room_id TEXT,
			message_id TIMEUUID,
			sender TEXT,
			content TEXT,
			node_written TEXT,
			consistency_used TEXT,
			metadata MAP<TEXT, TEXT>,
			PRIMARY KEY ((room_id), message_id)
		) WITH CLUSTERING ORDER BY (message_id DESC)
		AND compaction = {'class': 'TimeWindowCompactionStrategy', 'compaction_window_unit': 'HOURS', 'compaction_window_size': 1}
	`).Exec()
	if err != nil {
		return fmt.Errorf("failed to create messages table: %v", err)
	}

	// Tạo index trên entries của map metadata để search bằng SAI cực nhanh!
	_ = Session.Query(`
		CREATE CUSTOM INDEX IF NOT EXISTS messages_metadata_idx ON messages (entries(metadata))
		USING 'StorageAttachedIndex'
	`).Exec()

	// ── USER TELEMETRY ────────────────────────────────────────────────────
	_ = Session.Query(`DROP TABLE IF EXISTS user_telemetry`).Exec()
	err = Session.Query(`
		CREATE TABLE IF NOT EXISTS user_telemetry (
			user_id UUID,
			bucket_id TEXT,
			timestamp TIMESTAMP,
			attributes MAP<TEXT, TEXT>,
			PRIMARY KEY ((user_id, bucket_id), timestamp)
		) WITH CLUSTERING ORDER BY (timestamp DESC)
	`).Exec()
	if err != nil {
		return fmt.Errorf("failed to create user_telemetry table: %v", err)
	}

	// ── SCALE BENCHMARK RESULTS ───────────────────────────────────────────
	err = Session.Query(`
		CREATE TABLE IF NOT EXISTS scale_benchmarks (
			benchmark_id TIMEUUID,
			timestamp TIMESTAMP,
			node_count INT,
			consistency TEXT,
			total_writes INT,
			duration_ms BIGINT,
			throughput_per_sec FLOAT,
			avg_latency_ms FLOAT,
			PRIMARY KEY (benchmark_id)
		)
	`).Exec()
	if err != nil {
		log.Printf("⚠️  scale_benchmarks table: %v", err)
	}

	log.Println("✅ Cassandra schema initialized (RF=3)")
	return nil
}

func Close() {
	for _, s := range []*gocql.Session{Session, SessionNode1, SessionNode2, SessionNode3} {
		if s != nil {
			s.Close()
		}
	}
	log.Println("🔌 Cassandra connections closed")
}
