# Todo App — Go/Gin + Next.js + Cassandra Vector Search + OpenRouter AI

## Architecture

```
Frontend (Next.js :3001)  →  Backend (Go/Gin :8080)  →  Cassandra (:9042)
                                        ↓
                               OpenRouter API (AI + Embedding)
```

## Quick Start

### 1. Start Cassandra
```bash
cd docker
docker compose up -d cassandra
# Wait ~30s for Cassandra to be ready
docker exec cassandra-vector cqlsh -e "DESCRIBE KEYSPACES"
```

### 2. Start Backend
```bash
export OPENROUTER_API_KEY="your-key-here"  # Get from https://openrouter.ai/
cd backend
go run main.go
# Server runs on http://localhost:8080
```

### 3. Start Frontend
```bash
cd frontend
npm run dev -- -p 3001
# Open http://localhost:3001
```

## Features
- ✅ CRUD Todo with priority (Low/Medium/High)
- ✅ Check/Uncheck with optimistic updates
- ✅ Filter: All / Active / Completed
- 🤖 AI task generation (OpenRouter gpt-oss-20b:free)
- 🔍 Vector Search vs Text Search comparison
- 📊 Embedding visualization

## API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/todos | List all todos |
| POST | /api/todos | Create todo |
| PATCH | /api/todos/:id | Toggle completion |
| DELETE | /api/todos/:id | Delete todo |
| GET | /api/todos/search?q= | Text search |
| POST | /api/ai/generate-task | AI generate task |
| POST | /api/ai/embed/:id | Embed single todo |
| POST | /api/ai/embed-all | Embed all todos |
| POST | /api/ai/vector-search | Vector ANN search |
| GET | /api/ai/compare-search?q= | Compare text vs vector |

## Tech Stack
- **Backend**: Go 1.26 + Gin
- **Frontend**: Next.js 16 + Tailwind CSS v4 + TanStack Query
- **Database**: Apache Cassandra (Vector Search via SAI)
- **AI**: OpenRouter (gpt-oss-20b:free + text-embedding-3-small)
