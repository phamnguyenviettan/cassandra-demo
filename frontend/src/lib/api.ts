'use server';

const API_BASE = process.env.API_URL || 'http://localhost:8080';

export interface Todo {
    id: string;
    title: string;
    description: string;
    is_completed: boolean;
    priority: 'Low' | 'Medium' | 'High';
    status: 'todo' | 'in_progress' | 'completed' | 'hidden';
    created_at: string;
    updated_at: string;
    type?: string;
    attributes?: Record<string, string>;
}

export interface SearchResult {
    todo: Todo;
    score?: number;
    method: string;
    embedding_preview?: number[];
}

export interface CompareSearchResponse {
    query: string;
    normal_results: SearchResult[];
    vector_results: SearchResult[];
    query_embedding_preview: number[];
}

export async function fetchTodos(): Promise<Todo[]> {
    const res = await fetch(`${API_BASE}/api/todos`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch todos');
    return res.json();
}

export async function createTodo(data: { title: string; description?: string; priority: string }): Promise<Todo> {
    const res = await fetch(`${API_BASE}/api/todos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create todo');
    return res.json();
}

export async function updateTodoStatus(id: string, status: string): Promise<{ id: string; status: string; is_completed: boolean }> {
    const res = await fetch(`${API_BASE}/api/todos/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error('Failed to update status');
    return res.json();
}

export async function deleteTodo(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/todos/${id}`, {
        method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete todo');
}

export async function generateTask(prompt: string): Promise<{ todo: Todo; message: string }> {
    const res = await fetch(`${API_BASE}/api/ai/generate-task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
    });
    if (!res.ok) throw new Error('Failed to generate task');
    return res.json();
}

export async function embedTodo(id: string): Promise<{
    todo_id: string;
    embedding_dimensions: number;
    embedding_preview: number[];
    message: string;
}> {
    const res = await fetch(`${API_BASE}/api/ai/embed/${id}`, {
        method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to embed todo');
    return res.json();
}

export async function embedAllTodos(): Promise<{ message: string; embedded: number }> {
    const res = await fetch(`${API_BASE}/api/ai/embed-all`, {
        method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to embed todos');
    return res.json();
}

export async function vectorSearch(query: string, topK: number = 5): Promise<{
    query: string;
    results: SearchResult[];
    query_embedding_preview: number[];
    total_dimensions: number;
}> {
    const res = await fetch(`${API_BASE}/api/ai/vector-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, top_k: topK }),
    });
    if (!res.ok) throw new Error('Failed to perform vector search');
    return res.json();
}

export async function compareSearch(query: string): Promise<CompareSearchResponse> {
    const res = await fetch(`${API_BASE}/api/ai/compare?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error('Failed to compare search');
    return res.json();
}

export async function textSearch(query: string): Promise<SearchResult[]> {
    const res = await fetch(`${API_BASE}/api/todos/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error('Failed to search todos');
    return res.json();
}

export interface EmbeddingRow {
    id: string;
    todo_id: string;
    title: string;
    embedding: number[];
    dimensions: number;
}

export interface TableInfo {
    name: string;
    count: number;
    columns: string[];
}

export interface DatabaseInfo {
    keyspace: string;
    tables: TableInfo[];
    todos: Todo[];
    embeddings: EmbeddingRow[];
    history: HistoryEvent[];
}

export async function fetchDatabase(): Promise<DatabaseInfo> {
    const res = await fetch(`${API_BASE}/api/database`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch database info');
    return res.json();
}
export interface HistoryEvent {
    todo_id: string;
    created_at: string;
    event_type: string;
    description: string;
    metadata?: Record<string, string>;
}

export async function fetchHistory(todoId: string): Promise<HistoryEvent[]> {
    const res = await fetch(`${API_BASE}/api/todos/${todoId}/history`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch todo history');
    return res.json();
}

export async function stressWriteTest(todoId: string): Promise<{
    count: number;
    duration_ms: number;
    avg_ms_per_write: number;
}> {
    const res = await fetch(`${API_BASE}/api/performance/stress-write?id=${todoId}`);
    if (!res.ok) throw new Error('Stress test failed');
    return res.json();
}
