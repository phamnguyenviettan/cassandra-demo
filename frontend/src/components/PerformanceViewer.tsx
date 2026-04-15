'use client';

import { useState } from 'react';
import { stressWriteTest } from '@/lib/api';
// Assuming useTodos is inside a hook, let me double check the import location
// It was in @/hooks/useTodos.ts

export default function PerformanceViewer() {
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState<{ count: number; duration_ms: number; avg_ms_per_write: number } | null>(null);
    const [targetTodoId, setTargetTodoId] = useState('');

    // I need the active todos to pick one for the test
    // But for simplicity, I'll just use the first one from the database

    const startTest = async () => {
        if (!targetTodoId) {
            alert('Please enter or select a Todo ID first');
            return;
        }
        setLoading(true);
        try {
            const res = await stressWriteTest(targetTodoId);
            setStats(res);
        } catch (e) {
            alert('Test failed: ' + e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="card" style={{ padding: 24 }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-1)' }}>🚀 Cassandra Write Throughput Test</h3>
                <p style={{ color: 'var(--text-3)', fontSize: 14, marginTop: 8, lineHeight: 1.6 }}>
                    Cassandra được thiết kế để xử lý lượng ghi cực lớn nhờ cấu trúc <strong>Log-Structured Merge-Tree (LSM)</strong>.
                    Chúng ta sẽ thực hiện 100 tác vụ ghi song song (parallel goroutines) vào bảng <code style={{ color: 'var(--accent)' }}>todo_history</code> để kiểm tra độ trễ.
                </p>

                <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
                    <input
                        className="input"
                        placeholder="Dán Todo ID vào đây (UUID)"
                        value={targetTodoId}
                        onChange={e => setTargetTodoId(e.target.value)}
                        style={{ flex: 1 }}
                    />
                    <button
                        className="btn btn-primary"
                        onClick={startTest}
                        disabled={loading || !targetTodoId}
                        style={{ padding: '0 24px' }}
                    >
                        {loading ? 'Running...' : 'Run Stress Test (100 Writes)'}
                    </button>
                </div>
            </div>

            {stats && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }} className="fade-in">
                    <div className="card" style={{ padding: 16, textAlign: 'center' }}>
                        <p style={{ fontSize: 10, color: 'var(--text-4)', textTransform: 'uppercase', marginBottom: 4 }}>Total Writes</p>
                        <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent)', margin: 0 }}>{stats.count}</p>
                    </div>
                    <div className="card" style={{ padding: 16, textAlign: 'center' }}>
                        <p style={{ fontSize: 10, color: 'var(--text-4)', textTransform: 'uppercase', marginBottom: 4 }}>Total Duration</p>
                        <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--info)', margin: 0 }}>{stats.duration_ms}ms</p>
                    </div>
                    <div className="card" style={{ padding: 16, textAlign: 'center' }}>
                        <p style={{ fontSize: 10, color: 'var(--text-4)', textTransform: 'uppercase', marginBottom: 4 }}>Avg Latency</p>
                        <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--success)', margin: 0 }}>{stats.avg_ms_per_write.toFixed(2)}ms</p>
                    </div>

                    <div className="card" style={{ gridColumn: '1 / -1', padding: 20, background: 'var(--info-muted)', border: 'none' }}>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                            <span style={{ fontSize: 24 }}>💡</span>
                            <div>
                                <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>Tại sao nó nhanh như vậy?</h4>
                                <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4, lineHeight: 1.5 }}>
                                    Cassandra không thực hiện kiểm tra <strong>Read-before-Write</strong> (ngoại trừ LWT).
                                    Dữ liệu được ghi thẳng vào <strong>Commit Log</strong> và <strong>Memtable</strong> trong bộ nhớ trước khi flush ra đĩa dưới dạng <strong>SSTable</strong>.
                                    Vì vậy, tốc độ ghi gần như bằng tốc độ truy cập bộ nhớ/đĩa tuần tự (Sequential I/O).
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
