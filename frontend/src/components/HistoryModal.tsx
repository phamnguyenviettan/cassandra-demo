'use client';

import { useState, useEffect } from 'react';
import { HistoryEvent, fetchHistory } from '@/lib/api';

interface HistoryModalProps {
    todoId: string;
    todoTitle: string;
    onClose: () => void;
}

export default function HistoryModal({ todoId, todoTitle, onClose }: HistoryModalProps) {
    const [history, setHistory] = useState<HistoryEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        setLoading(true);
        fetchHistory(todoId)
            .then(setHistory)
            .catch(() => setError('Failed to load history'))
            .finally(() => setLoading(false));
    }, [todoId]);

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 20
        }} onClick={onClose}>
            <div style={{
                background: 'var(--bg-card)', borderRadius: 12, width: '100%', maxWidth: 500,
                boxShadow: '0 20px 40px rgba(0,0,0,0.3)', maxHeight: '80vh', display: 'flex', flexDirection: 'column'
            }} onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div style={{ padding: 20, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-1)' }}>Activity Log</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                            <p style={{ margin: 0, fontSize: 11, color: 'var(--text-3)', fontFamily: 'monospace' }}>
                                ID: {todoId.slice(0, 8)}...
                            </p>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(todoId);
                                    alert('Copied Todo ID!');
                                }}
                                className="btn-ghost"
                                style={{ padding: '0 4px', fontSize: 9, borderRadius: 4, height: 18, color: 'var(--accent)' }}
                            >
                                📋 Copy
                            </button>
                        </div>
                    </div>
                    <button onClick={onClose} className="btn-ghost" style={{ fontSize: 20, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                </div>

                {/* Content */}
                <div style={{ padding: 20, overflowY: 'auto' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: 40 }}><span className="spinner" /></div>
                    ) : error ? (
                        <p style={{ color: 'var(--danger)', textAlign: 'center' }}>{error}</p>
                    ) : history.length === 0 ? (
                        <p style={{ textAlign: 'center', color: 'var(--text-3)', fontStyle: 'italic' }}>No history recorded</p>
                    ) : (
                        <div style={{ position: 'relative', paddingLeft: 16 }}>
                            {/* Timeline line */}
                            <div style={{ position: 'absolute', top: 8, bottom: 8, left: 0, width: 2, background: 'var(--border)' }} />

                            {history.map((h, i) => (
                                <div key={i} style={{ marginBottom: 24, position: 'relative' }}>
                                    {/* Dot */}
                                    <div style={{
                                        position: 'absolute', left: -21, top: 4, width: 12, height: 12,
                                        borderRadius: '50%', background: 'var(--bg-card)', border: '2px solid var(--accent)',
                                        zIndex: 1
                                    }} />

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>
                                            {formatEvent(h.event_type)}
                                        </span>
                                        <span className="mono" style={{ fontSize: 10, color: 'var(--text-4)' }}>
                                            {new Date(h.created_at).toLocaleString()}
                                        </span>
                                    </div>

                                    <p style={{ fontSize: 12, color: 'var(--text-2)', margin: 0, lineHeight: 1.5 }}>
                                        {h.description}
                                    </p>

                                    {h.metadata && Object.keys(h.metadata).length > 0 && (
                                        <div style={{
                                            marginTop: 8, background: 'var(--bg-code)', borderRadius: 6, padding: 8,
                                            fontSize: 10, fontFamily: 'monospace', color: 'var(--text-3)'
                                        }}>
                                            {Object.entries(h.metadata).map(([k, v]) => (
                                                <div key={k} style={{ display: 'flex' }}>
                                                    <span style={{ color: 'var(--accent)', marginRight: 8 }}>{k}:</span>
                                                    <span>{v}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: 12, background: 'var(--bg-app)', borderTop: '1px solid var(--border)', borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }}>
                    <p style={{ fontSize: 10, color: 'var(--text-4)', textAlign: 'center', margin: 0 }}>
                        Powered by Cassandra Time-Series (Clustering Order DESC)
                    </p>
                </div>
            </div>
        </div>
    );
}

function formatEvent(type: string) {
    switch (type) {
        case 'created': return '✨ Created';
        case 'status_change': return '🔄 Status Update';
        case 'ai_generated': return '🤖 AI Generated';
        case 'embedding_created': return '🧠 Vector Embedded';
        default: return type.replace(/_/g, ' ');
    }
}
