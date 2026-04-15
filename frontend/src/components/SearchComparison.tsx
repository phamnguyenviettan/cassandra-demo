'use client';

import { useState } from 'react';
import { compareSearch, embedAllTodos } from '@/lib/api';
import type { CompareSearchResponse } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';

export default function SearchComparison() {
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [embedLoading, setEmbedLoading] = useState(false);
    const [result, setResult] = useState<CompareSearchResponse | null>(null);
    const [error, setError] = useState('');
    const queryClient = useQueryClient();

    const handleSearch = async () => {
        if (!query.trim()) return;
        setLoading(true); setError('');
        try {
            const r = await compareSearch(query);
            setResult(r);
        } catch { setError('Search failed. Make sure todos are embedded first.'); }
        finally { setLoading(false); }
    };

    const handleEmbedAll = async () => {
        setEmbedLoading(true);
        try {
            const r = await embedAllTodos();
            setError('');
            setResult(null);
            alert(`✓ Embedded ${r.embedded} todos`);
            queryClient.invalidateQueries({ queryKey: ['todos'] });
        } catch { setError('Failed to embed todos'); }
        finally { setEmbedLoading(false); }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Search Input */}
            <div style={{ display: 'flex', gap: 8 }}>
                <input
                    className="input"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder='Try: "mua rau" to find "đi chợ" semantically...'
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    style={{ flex: 1 }}
                />
                <button className="btn btn-primary" onClick={handleSearch} disabled={!query.trim() || loading}>
                    {loading ? <span className="spinner" /> : '🔍 Compare'}
                </button>
                <button className="btn btn-ghost" onClick={handleEmbedAll} disabled={embedLoading}>
                    {embedLoading ? <span className="spinner" /> : '🧠 Embed All'}
                </button>
            </div>

            {error && <p style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</p>}

            {/* Explanation */}
            <div className="card" style={{ padding: 14 }}>
                <p style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.6 }}>
                    <strong style={{ color: 'var(--accent)' }}>Text Search</strong> tìm chính xác từ khóa trong title.
                    <strong style={{ color: 'var(--info)', marginLeft: 8 }}>Vector Search</strong> chuyển query thành embedding vector rồi so sánh cosine similarity — nên có thể tìm được nghĩa tương đồng dù từ ngữ khác nhau.
                </p>
            </div>

            {/* Results */}
            {result && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }} className="fade-in">
                    {/* Text Results */}
                    <div className="card" style={{ overflow: 'hidden' }}>
                        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)' }}>📝 Text Search</span>
                            <span className="badge badge-accent">{result.normal_results?.length || 0} kết quả</span>
                        </div>
                        <div style={{ padding: 0 }}>
                            {(!result.normal_results || result.normal_results.length === 0) ? (
                                <p style={{ padding: 20, textAlign: 'center', fontSize: 12, color: 'var(--text-3)' }}>Không tìm thấy</p>
                            ) : (
                                result.normal_results.map((r, i) => (
                                    <div key={i} style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                                        <span style={{ color: 'var(--text-1)' }}>{r.todo.title}</span>
                                        <span className="badge badge-info" style={{ marginLeft: 8 }}>LIKE match</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Vector Results */}
                    <div className="card" style={{ overflow: 'hidden' }}>
                        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)' }}>🧠 Vector Search</span>
                            <span className="badge badge-accent">{result.vector_results?.length || 0} kết quả</span>
                        </div>
                        <div style={{ padding: 0 }}>
                            {(!result.vector_results || result.vector_results.length === 0) ? (
                                <p style={{ padding: 20, textAlign: 'center', fontSize: 12, color: 'var(--text-3)' }}>Không tìm thấy. Bấm &quot;Embed All&quot; trước.</p>
                            ) : (
                                result.vector_results.map((r, i) => (
                                    <div key={i} style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ color: 'var(--text-1)' }}>{r.todo.title}</span>
                                            {r.score !== undefined && (
                                                <span className="mono badge badge-accent">{(r.score * 100).toFixed(1)}%</span>
                                            )}
                                        </div>
                                        {/* Mini embedding viz */}
                                        {r.embedding_preview && r.embedding_preview.length > 0 && (
                                            <div style={{ display: 'flex', gap: 1, height: 12, marginTop: 6, opacity: 0.6 }}>
                                                {r.embedding_preview.slice(0, 40).map((v, j) => {
                                                    const absV = Math.abs(v);
                                                    const maxV = Math.max(...r.embedding_preview!.slice(0, 40).map(Math.abs));
                                                    return (
                                                        <div key={j} className="emb-bar" style={{
                                                            flex: 1,
                                                            height: `${maxV > 0 ? (absV / maxV) * 100 : 0}%`,
                                                            background: v >= 0 ? 'var(--accent)' : 'var(--danger)',
                                                            opacity: 0.3 + (maxV > 0 ? (absV / maxV) * 0.7 : 0),
                                                        }} />
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Query Embedding Preview */}
                    {result.query_embedding_preview && result.query_embedding_preview.length > 0 && (
                        <div className="card" style={{ gridColumn: '1 / -1', padding: 14 }}>
                            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', marginBottom: 8 }}>
                                Query embedding: &quot;{result.query}&quot; → VECTOR&lt;FLOAT, 1536&gt;
                            </p>
                            <div style={{ display: 'flex', gap: 1, height: 32 }}>
                                {result.query_embedding_preview.map((v, i) => {
                                    const absV = Math.abs(v);
                                    const maxV = Math.max(...result.query_embedding_preview.map(Math.abs));
                                    return (
                                        <div key={i} className="emb-bar" style={{
                                            flex: 1,
                                            height: `${maxV > 0 ? (absV / maxV) * 100 : 0}%`,
                                            background: v >= 0 ? 'var(--accent)' : 'var(--danger)',
                                            opacity: 0.3 + (maxV > 0 ? (absV / maxV) * 0.7 : 0),
                                        }} />
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
