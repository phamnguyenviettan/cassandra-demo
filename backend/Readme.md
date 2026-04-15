# 🚀 Todo AI Backend (Go + Cassandra SAI)

A high-performance, scalable backend server built with **Go (Gin)** and **Apache Cassandra**, featuring advanced **AI Vector Search**, **Time-series History**, and **Massive Write Throughput**.

## 🛠️ Tech Stack

- **Language**: Go (Golang)
- **Web Framework**: [Gin Gonic](https://github.com/gin-gonic/gin)
- **Database**: [Apache Cassandra 5.0+](https://cassandra.apache.org/) - Utilizing **Storage Attached Indexing (SAI)**
- **AI Integration**: [OpenRouter API](https://openrouter.ai/) (GPT-4/Claude for generation, text-embedding-3-small for vectors)
- **Driver**: [gocql](https://github.com/gocql/gocql)

## ✨ Key Features

### 1. Advanced Vector Search (SAI)
Unlike traditional relational databases, this backend uses **Cassandra's Storage Attached Indexing (SAI)** to perform **Approximate Nearest Neighbor (ANN)** search.
- **Service**: Converts task titles into 1536-dimensional vectors.
- **Capability**: Search for tasks by "meaning" rather than just keywords (e.g., searching "grocery" can find "buy milk").

### 2. High-Throughput Activity Logging (Time-Series)
Implemented using a sophisticated Cassandra data model to handle massive parallel writes:
- **Table**: `todo_history_v2`
- **Data Model**: Uses `(todo_id)` as Partition Key and `event_id (TIMEUUID)` as Clustering Key.
- **Scale**: Designed to handle thousands of concurrent write events without row collisions or locking.

### 3. AI-Powered Task Generation
Integrated with **OpenRouter AI** to automatically generate detailed tasks, descriptions, and priorities based on natural language prompts.

### 4. Database Explorer API
A dedicated set of endpoints that expose raw Cassandra storage metrics, schema information, and embedding previews for debugging and transparency.

## 🗄️ Database Schema

### `todos`
Core task data with global SAI indexes on `title` and `created_at`.
- `id` (UUID, PK)
- `title` (TEXT)
- `status` (TEXT) - todo, in_progress, completed, hidden
- `is_completed` (BOOLEAN)
- `priority` (TEXT)

### `todo_embeddings`
Stores high-dimensional vectors for semantic search.
- `id` (UUID, PK)
- `todo_id` (UUID)
- `embedding` (VECTOR<FLOAT, 1536>) - Native SAI Vector type

### `todo_history_v2`
Time-series log of all task activities.
- `todo_id` (UUID, PK)
- `event_id` (TIMEUUID, CK DESC)
- `event_type` (TEXT)
- `metadata` (MAP<TEXT, TEXT>)

## 🔌 API Endpoints

### Todos
- `GET /api/todos`: Fetch all tasks (optimized with SAI sorting).
- `POST /api/todos`: Create a new task.
- `PATCH /api/todos/:id/status`: Update task status (Kanban move).
- `GET /api/todos/search`: Traditional text search via SAI.
- `GET /api/todos/:id/history`: Get specific task timeline.

### AI & Vectors
- `POST /api/ai/generate-task`: Generate task using LLM.
- `POST /api/ai/embed-all`: Bulk generate embeddings for all tasks.
- `POST /api/ai/vector-search`: Perform semantic ANN search.
- `GET /api/ai/compare-search`: Compare Text vs. Vector search results.

### Performance & System
- `GET /api/database`: Raw database metrics and schema info.
- `GET /api/performance/stress-write`: Stress test for massive history writes.

## 🚀 Getting Started

1. **Environment Variables**: Create a `.env` file or export:
   ```env
   CASSANDRA_HOST=localhost
   OPENROUTER_API_KEY=your_key_here
   PORT=8080
   ```

2. **Run the server**:
   ```bash
   go run main.go
   ```

The server automatically initializes the Cassandra keyspace and schema on startup.
