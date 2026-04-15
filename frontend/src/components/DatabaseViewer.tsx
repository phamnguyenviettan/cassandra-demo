'use client';

import { useState, useEffect } from 'react';
import { fetchDatabase, embedAllTodos, type DatabaseInfo, type EmbeddingRow } from '@/lib/api';

export default function DatabaseViewer() {
    const [data, setData] = useState<DatabaseInfo | null>(null);
    const [loading, setLoading] = useState(false);
    const [embedLoading, setEmbedLoading] = useState(false);
    const [error, setError] = useState('');
    const [selectedEmb, setSelectedEmb] = useState<EmbeddingRow | null>(null);
    const [activeTable, setActiveTable] = useState<'todos' | 'embeddings' | 'history' | 'telemetry'>('todos');

    const [telemetry, setTelemetry] = useState<any[]>([]);

    const loadData = async () => {
        setLoading(true); setError('');
        try { setData(await fetchDatabase()); }
        catch { setError('Cannot connect to database'); }
        finally { setLoading(false); }
    };

    useEffect(() => {
        let interval: NodeJS.Timeout;

        if (activeTable === 'telemetry') {
            const fetchTelemetry = () => {
                const demoUserId = "550e8400-e29b-41d4-a716-446655440000";
                fetch(`/api/demo/telemetry/${demoUserId}`)
                    .then(res => res.json())
                    .then(data => {
                        if (Array.isArray(data)) {
                            setTelemetry(data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 50));
                        }
                    })
                    .catch(console.error);
            };

            fetchTelemetry(); // Initial fetch
            interval = setInterval(fetchTelemetry, 1000); // Poll every 1s
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [activeTable]);

    const handleEmbedAll = async () => {
        setEmbedLoading(true);
        try {
            const r = await embedAllTodos();
            alert(`✓ Embedded ${r.embedded} todos`);
            await loadData(); // Refresh data
        } catch { setError('Failed to embed todos'); }
        finally { setEmbedLoading(false); }
    };

    useEffect(() => {
        loadData();
    }, []);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>Database Explorer (Trình Khám Phá Dữ Liệu)</h3>
                    <p className="mono" style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>
                        Cassandra · keyspace: {data?.keyspace || 'todo_app'}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-ghost btn-sm" onClick={loadData} disabled={loading}>
                        {loading ? <span className="spinner" /> : '↻ Làm Mới'}
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={handleEmbedAll} disabled={embedLoading}>
                        {embedLoading ? <span className="spinner" /> : '🧠 Embed Tất Cả Todos'}
                    </button>
                </div>
            </div>

            {error && <p style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</p>}

            {data && (
                <>
                    {/* Schema Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        {data.tables.map((t) => (
                            <div key={t.name} className="card" style={{ padding: 14 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>{t.name}</span>
                                    <span className="badge badge-accent">{t.count} rows</span>
                                </div>
                                {t.columns.map((col, i) => (
                                    <div key={i} className="mono" style={{ fontSize: 10, color: 'var(--text-3)', paddingLeft: 8, borderLeft: '2px solid var(--border)', marginBottom: 3 }}>
                                        {col}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>

                    {/* Table tabs */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button
                            className={`nav-item ${activeTable === 'todos' ? 'active' : ''}`}
                            onClick={() => setActiveTable('todos')}
                            style={{ padding: '6px 12px', fontSize: 12 }}
                        >
                            📝 Danh Sách Việc Cần Làm ({data.todos.length})
                        </button>
                        <button
                            className={`nav-item ${activeTable === 'embeddings' ? 'active' : ''}`}
                            onClick={() => setActiveTable('embeddings')}
                            style={{ padding: '6px 12px', fontSize: 12 }}
                        >
                            🧠 Vector Embeddings ({data.embeddings.length})
                        </button>
                        <button
                            className={`nav-item ${activeTable === 'history' ? 'active' : ''}`}
                            onClick={() => setActiveTable('history')}
                            style={{ padding: '6px 12px', fontSize: 12 }}
                        >
                            📜 Lịch Sử Thay Đổi ({data.history?.length || 0})
                        </button>
                        <button
                            className={`nav-item ${activeTable === 'telemetry' ? 'active' : ''}`}
                            onClick={() => setActiveTable('telemetry')}
                            style={{ padding: '6px 12px', fontSize: 12 }}
                        >
                            📊 Dữ Liệu Thời Gian Thực (Time Series)
                        </button>
                    </div>

                    {/* Todos Table */}
                    {activeTable === 'todos' && (
                        <div className="card" style={{ overflow: 'hidden' }}>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Tiêu Đề</th>
                                        <th>Loại / Thuộc Tính (Dynamic)</th>
                                        <th>Hoàn Thành</th>
                                        <th>Độ Ưu Tiên</th>
                                        <th>Ngày Tạo</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.todos.length === 0 ? (
                                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, fontStyle: 'italic' }}>Chưa có dữ liệu</td></tr>
                                    ) : data.todos.map((t) => (
                                        <tr key={t.id}>
                                            <td className="mono" style={{ fontSize: 10, maxWidth: 120, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.id}</span>
                                                <button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(t.id);
                                                        alert('Copied!');
                                                    }}
                                                    className="btn-ghost"
                                                    style={{ padding: 2, height: 'auto', opacity: 0.5 }}
                                                >
                                                    📋
                                                </button>
                                            </td>
                                            <td style={{ color: t.is_completed ? 'var(--text-3)' : 'var(--text-1)', textDecoration: t.is_completed ? 'line-through' : 'none' }}>{t.title}</td>
                                            <td>
                                                <div style={{ fontSize: 10 }}>
                                                    {t.type && <span className="badge badge-accent" style={{ marginRight: 4 }}>{t.type}</span>}
                                                    <span className="mono" style={{ color: 'var(--text-3)' }}>{t.attributes ? JSON.stringify(t.attributes) : ''}</span>
                                                </div>
                                            </td>
                                            <td><span className={`badge ${t.is_completed ? 'badge-low' : 'badge-medium'}`}>{String(t.is_completed)}</span></td>
                                            <td><span className={`badge badge-${t.priority.toLowerCase()}`}>{t.priority}</span></td>
                                            <td className="mono" style={{ fontSize: 10 }}>{new Date(t.created_at).toLocaleString('vi-VN')}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* ... (Embeddings Table - Same) ... */}
                    {/* ... (History Table - Same) ... */}

                    {/* Telemetry Table Placeholder (Since we don't load it in initial fetchDatabase yet, we need to instruct user or lazy load) */}
                    {/* Telemetry Table (Live Feed) */}
                    {activeTable === 'telemetry' && (
                        <div className="card" style={{ overflow: 'hidden' }}>
                            <div style={{ padding: 12, borderBottom: '1px solid var(--border)', background: 'var(--bg-code)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ fontSize: 11, color: 'var(--text-2)' }}>
                                    Hiển thị <strong>{telemetry.length}</strong> bản ghi mới nhất từ bảng <span className="mono">user_telemetry</span>
                                </div>
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                    <span className="badge badge-accent animate-pulse">CẬP NHẬT TỰ ĐỘNG (1s)</span>
                                </div>
                            </div>
                            <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                                <table className="data-table">
                                    <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                                        <tr>
                                            <th>Thời Gian</th>
                                            <th>Người Dùng (ID)</th>
                                            <th>Attributes (Flexible Schema)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {telemetry.map((t, i) => (
                                            <tr key={i}>
                                                <td className="mono" style={{ fontSize: 10, color: 'var(--accent)' }}>
                                                    {new Date(t.timestamp).toLocaleTimeString()}.{new Date(t.timestamp).getMilliseconds().toString().padStart(3, '0')}
                                                </td>
                                                <td className="mono" style={{ fontSize: 10, color: 'var(--text-3)' }}>{t.user_id?.split('-')[0]}...</td>
                                                <td className="mono" style={{ fontSize: 10, color: 'var(--text-1)' }}>
                                                    {/* Render Map as badges */}
                                                    {t.attributes && Object.entries(t.attributes).map(([k, v], idx) => (
                                                        <span key={idx} style={{
                                                            display: 'inline-block',
                                                            marginRight: 4,
                                                            padding: '1px 4px',
                                                            borderRadius: 3,
                                                            background: 'rgba(255,255,255,0.05)',
                                                            border: '1px solid rgba(255,255,255,0.1)'
                                                        }}>
                                                            <span style={{ color: 'var(--text-3)' }}>{k}:</span> <span style={{ color: 'var(--success)' }}>{v as string}</span>
                                                        </span>
                                                    ))}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Embeddings Table */}
                    {activeTable === 'embeddings' && (
                        <>
                            <div className="card" style={{ overflow: 'hidden' }}>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Todo ID</th>
                                            <th>Tiêu Đề</th>
                                            <th>Số Chiều (Dims)</th>
                                            <th>Xem Trước Vector</th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.embeddings.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} style={{ textAlign: 'center', padding: 24 }}>
                                                    <p style={{ fontStyle: 'italic', color: 'var(--text-3)' }}>Chưa có vector embedding nào</p>
                                                    <button className="btn btn-primary btn-sm" onClick={handleEmbedAll} disabled={embedLoading} style={{ marginTop: 8 }}>
                                                        {embedLoading ? <span className="spinner" /> : '🧠 Tạo Embeddings Ngay'}
                                                    </button>
                                                </td>
                                            </tr>
                                        ) : data.embeddings.map((emb) => (
                                            <tr key={emb.id}>
                                                <td className="mono" style={{ fontSize: 10, maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emb.todo_id}</td>
                                                <td style={{ color: 'var(--text-1)' }}>{emb.title}</td>
                                                <td className="mono" style={{ textAlign: 'center' }}>
                                                    <span className="badge badge-accent">{emb.dimensions}</span>
                                                </td>
                                                <td style={{ width: 200 }}>
                                                    <div style={{ display: 'flex', gap: 1, height: 16, alignItems: 'flex-end' }}>
                                                        {emb.embedding.slice(0, 30).map((v, i) => {
                                                            const abs = Math.abs(v);
                                                            const max = Math.max(...emb.embedding.slice(0, 30).map(Math.abs));
                                                            return (
                                                                <div key={i} className="emb-bar" style={{
                                                                    flex: 1,
                                                                    height: `${max > 0 ? (abs / max) * 100 : 0}%`,
                                                                    background: v >= 0 ? 'var(--accent)' : 'var(--danger)',
                                                                    opacity: 0.3 + (max > 0 ? (abs / max) * 0.7 : 0),
                                                                }} />
                                                            );
                                                        })}
                                                    </div>
                                                </td>
                                                <td>
                                                    <button
                                                        className="btn btn-ghost btn-sm"
                                                        onClick={() => setSelectedEmb(selectedEmb?.id === emb.id ? null : emb)}
                                                    >
                                                        {selectedEmb?.id === emb.id ? 'Hide' : 'Detail'}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Detail Panel */}
                            {selectedEmb && (
                                <div className="card fade-in" style={{ padding: 16 }}>
                                    <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', margin: 0 }}>
                                        Embedding: &quot;{selectedEmb.title}&quot;
                                    </h4>
                                    <p className="mono" style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4 }}>
                                        VECTOR&lt;FLOAT, {selectedEmb.dimensions}&gt; — showing {selectedEmb.embedding.length}/{selectedEmb.dimensions} dims
                                    </p>

                                    {/* Large chart */}
                                    <div style={{ background: 'var(--bg-code)', borderRadius: 8, padding: 12, marginTop: 12 }}>
                                        <div style={{ display: 'flex', gap: 2, height: 64, alignItems: 'flex-end' }}>
                                            {selectedEmb.embedding.map((v, i) => {
                                                const abs = Math.abs(v);
                                                const max = Math.max(...selectedEmb.embedding.map(Math.abs));
                                                return (
                                                    <div key={i} className="emb-bar" style={{
                                                        flex: 1,
                                                        height: `${max > 0 ? (abs / max) * 100 : 0}%`,
                                                        background: v >= 0 ? 'var(--accent)' : 'var(--danger)',
                                                        opacity: 0.3 + (max > 0 ? (abs / max) * 0.7 : 0),
                                                        borderRadius: 2,
                                                    }} title={`dim[${i}] = ${v.toFixed(6)}`} />
                                                );
                                            })}
                                        </div>
                                        <div className="mono" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 9, color: 'var(--text-4)' }}>
                                            <span>dim[0]</span><span>dim[{selectedEmb.embedding.length - 1}]</span>
                                        </div>
                                    </div>

                                    {/* Raw values */}
                                    <details style={{ marginTop: 12 }}>
                                        <summary style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', cursor: 'pointer' }}>Raw Values</summary>
                                        <div className="mono" style={{
                                            background: 'var(--bg-code)', borderRadius: 8, padding: 10, marginTop: 6,
                                            maxHeight: 100, overflowY: 'auto', fontSize: 10, color: 'var(--text-3)', lineHeight: 1.6, wordBreak: 'break-all',
                                        }}>
                                            [{selectedEmb.embedding.map(v => v.toFixed(6)).join(', ')}
                                            {selectedEmb.dimensions > selectedEmb.embedding.length && `, ... +${selectedEmb.dimensions - selectedEmb.embedding.length} more`}]
                                        </div>
                                    </details>

                                    {/* Explanation */}
                                    <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: 'var(--info-muted)', borderLeft: '3px solid var(--info)' }}>
                                        <p style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.6, margin: 0 }}>
                                            <strong>Cách hoạt động:</strong> Text được chuyển thành vector {selectedEmb.dimensions} chiều bằng model <span className="mono" style={{ color: 'var(--accent)' }}>text-embedding-3-small</span>.
                                            Cassandra SAI index dùng <strong>cosine similarity</strong> để so sánh vector → tìm kết quả gần nghĩa nhất (ANN search).
                                        </p>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* History Table */}
                    {activeTable === 'history' && (
                        <div className="card" style={{ overflow: 'hidden' }}>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Todo ID (PK)</th>
                                        <th>Thời Gian (CK)</th>
                                        <th>Loại Sự Kiện</th>
                                        <th>Mô Tả Chi Tiết</th>
                                        <th>Metadata (Dữ Liệu Kèm Theo)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(!data.history || data.history.length === 0) ? (
                                        <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, fontStyle: 'italic' }}>No history data</td></tr>
                                    ) : data.history.map((h, i) => (
                                        <tr key={i}>
                                            <td className="mono" style={{ fontSize: 10, color: 'var(--text-3)' }}>{h.todo_id}</td>
                                            <td className="mono" style={{ fontSize: 10, whiteSpace: 'nowrap' }}>{new Date(h.created_at).toISOString().replace('T', ' ').slice(0, 19)}</td>
                                            <td><span className="badge badge-accent" style={{ fontSize: 9 }}>{h.event_type}</span></td>
                                            <td style={{ fontSize: 11, color: 'var(--text-1)' }}>{h.description}</td>
                                            <td className="mono" style={{ fontSize: 9, color: 'var(--info)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {h.metadata ? JSON.stringify(h.metadata) : '{}'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

