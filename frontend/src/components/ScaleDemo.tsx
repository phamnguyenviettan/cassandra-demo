'use client';

import { useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

const CONSISTENCY_OPTIONS = ['ONE', 'LOCAL_QUORUM', 'ALL'];
const NODE_TARGETS = [
  { value: 'node1', label: 'Node 1 (9042)', color: '#6366f1' },
  { value: 'node2', label: 'Node 2 (9043)', color: '#10b981' },
  { value: 'node3', label: 'Node 3 (9044)', color: '#f59e0b' },
  { value: 'cluster', label: 'Cluster (LB)', color: '#8b5cf6' },
];

type BenchmarkResult = {
  benchmark: {
    num_clients: number;
    total_writes: number;
    success: number;
    failed: number;
    duration_ms: number;
    throughput_per_sec: string;
    avg_latency_ms: string;
    consistency: string;
    node_target: string;
  };
  scaling_insight: string;
};

type HistoryEntry = {
  label: string;
  throughput: number;
  latency: number;
  clients: number;
  consistency: string;
  color: string;
};

export default function ScaleDemo() {
  // Benchmark params
  const [numClients, setNumClients] = useState(10);
  const [numWrites, setNumWrites] = useState(200);
  const [consistency, setConsistency] = useState('LOCAL_QUORUM');
  const [nodeTarget, setNodeTarget] = useState('cluster');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BenchmarkResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [scaleStatus, setScaleStatus] = useState<any>(null);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API}/api/scale/status`);
      if (res.ok) setScaleStatus(await res.json());
    } catch {}
  };

  const runBenchmark = async () => {
    setRunning(true);
    try {
      const res = await fetch(`${API}/api/scale/benchmark`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ num_clients: numClients, num_writes: numWrites, consistency, node_target: nodeTarget }),
      });
      const data: BenchmarkResult = await res.json();
      setResult(data);

      // Add to history for comparison chart
      const nodeColor = NODE_TARGETS.find(n => n.value === nodeTarget)?.color || '#6366f1';
      setHistory(prev => [
        ...prev.slice(-7),
        {
          label: `${numClients}c/${consistency.split('_').pop()}`,
          throughput: parseFloat(data.benchmark?.throughput_per_sec || '0'),
          latency: parseFloat(data.benchmark?.avg_latency_ms || '0'),
          clients: numClients,
          consistency,
          color: nodeColor,
        },
      ]);
    } catch (e) {
      console.error(e);
    } finally {
      setRunning(false);
    }
  };

  const onlineCount = scaleStatus?.online_count ?? 0;
  const maxThroughput = history.length > 0 ? Math.max(...history.map(h => h.throughput)) : 1;
  const maxLatency = history.length > 0 ? Math.max(...history.map(h => h.latency)) : 1;

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: 800, margin: 0, color: 'var(--text-1)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ background: 'linear-gradient(135deg,#8b5cf6,#6366f1)', borderRadius: '10px', padding: '6px 12px', fontSize: '16px' }}>📈</span>
          Scale Demo — Horizontal &amp; Vertical
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-3)', marginTop: '6px' }}>
          Benchmark ghi đồng thời, so sánh throughput theo số clients, consistency level, và node target.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px' }}>
        {/* Interactive Demo Guide Container spanning both columns if needed, or put just above grids */}
        <div style={{ gridColumn: '1 / -1', padding: '16px', borderRadius: '10px', background: '#6366f111', border: '1px solid #6366f144', marginBottom: '4px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 800, margin: '0 0 8px', color: '#6366f1' }}>💡 Hướng dẫn trải nghiệm Scale Demo</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <strong style={{ fontSize: '12px', color: 'var(--text-1)' }}>Kịch bản 1: Traffic thấp (Spike nhỏ)</strong>
              <ul style={{ margin: '4px 0 0', paddingLeft: '16px', fontSize: '12px', color: 'var(--text-2)' }}>
                <li>Kéo thanh <strong>Concurrent Clients</strong> về mức <strong>5</strong> hoặc <strong>10</strong>.</li>
                <li>Bấm <strong>Run Benchmark</strong>.</li>
                <li>Nhìn biểu đồ bên phải: Cột Throughput sẽ ở mức vừa phải (vd: 30-50 writes/s).</li>
              </ul>
            </div>
            <div>
              <strong style={{ fontSize: '12px', color: 'var(--text-1)' }}>Kịch bản 2: Bùng nổ Traffic (Horizontal Scale)</strong>
              <ul style={{ margin: '4px 0 0', paddingLeft: '16px', fontSize: '12px', color: 'var(--text-2)' }}>
                <li>Kéo thanh <strong>Concurrent Clients</strong> lên tối đa <strong>200</strong>.</li>
                <li>Bấm <strong>Run Benchmark</strong>.</li>
                <li>Biểu đồ Throughput <strong>giật vọt lên gấp nhiều lần</strong> (vd: 300-800 writes/s). Cassandra không bị thắt cổ chai nhờ kiến trúc leaderless (Ghi song song nhiều node).</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Left: Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Cluster Status Quick View */}
          <div className="card" style={{ padding: '16px' }}>
            <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px' }}>Cluster Status</p>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              {[1, 2, 3].map(i => {
                const nodeKey = `node_${i}`;
                const nodeData = scaleStatus?.nodes?.[nodeKey];
                const isOnline = nodeData?.status === 'online';
                const colors = ['#6366f1', '#10b981', '#f59e0b'];
                return (
                  <div key={i} style={{
                    flex: 1, padding: '10px', borderRadius: '8px', textAlign: 'center',
                    background: isOnline ? `${colors[i - 1]}22` : 'var(--bg-hover)',
                    border: `1px solid ${isOnline ? colors[i - 1] + '44' : 'var(--border)'}`,
                  }}>
                    <div style={{
                      width: '8px', height: '8px', borderRadius: '50%', margin: '0 auto 4px',
                      background: isOnline ? colors[i - 1] : '#4b5563',
                      boxShadow: isOnline ? `0 0 6px ${colors[i - 1]}` : 'none',
                    }} />
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-1)' }}>N{i}</div>
                    <div style={{ fontSize: '9px', color: isOnline ? colors[i - 1] : 'var(--text-4)', fontWeight: 700 }}>
                      {nodeData?.status || 'offline'}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-3)', textAlign: 'center' }}>
              <strong style={{ color: 'var(--text-1)' }}>{onlineCount}/3</strong> nodes online · RF=3
            </div>
          </div>

          {/* Benchmark Params */}
          <div className="card" style={{ padding: '16px' }}>
            <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 14px' }}>Benchmark Params</p>

            {/* Concurrent Clients Slider */}
            <label style={{ display: 'block', marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-3)', marginBottom: '6px' }}>
                <span>🧑‍💻 Concurrent Clients</span>
                <strong style={{ color: 'var(--text-1)', fontFamily: 'monospace' }}>{numClients}</strong>
              </div>
              <input type="range" min={1} max={200} value={numClients}
                onChange={e => setNumClients(+e.target.value)}
                style={{ width: '100%', accentColor: '#6366f1' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-4)', marginTop: '2px' }}>
                <span>1</span><span>Horizontal Scale →</span><span>200</span>
              </div>
            </label>

            {/* Total Writes Slider */}
            <label style={{ display: 'block', marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-3)', marginBottom: '6px' }}>
                <span>✍️ Total Writes</span>
                <strong style={{ color: 'var(--text-1)', fontFamily: 'monospace' }}>{numWrites}</strong>
              </div>
              <input type="range" min={10} max={2000} step={10} value={numWrites}
                onChange={e => setNumWrites(+e.target.value)}
                style={{ width: '100%', accentColor: '#10b981' }}
              />
            </label>

            {/* Consistency Level */}
            <div style={{ marginBottom: '14px' }}>
              <p style={{ fontSize: '11px', color: 'var(--text-3)', margin: '0 0 6px' }}>📊 Consistency Level</p>
              <div style={{ display: 'flex', gap: '4px' }}>
                {CONSISTENCY_OPTIONS.map(c => (
                  <button key={c} onClick={() => setConsistency(c)} style={{
                    flex: 1, padding: '6px 4px', borderRadius: '6px', border: '1px solid',
                    borderColor: consistency === c ? 'var(--accent)' : 'var(--border)',
                    background: consistency === c ? 'var(--accent)' : 'transparent',
                    color: consistency === c ? 'white' : 'var(--text-3)',
                    fontSize: '9px', fontWeight: 700, cursor: 'pointer', fontFamily: 'monospace',
                  }}>{c.replace('_', '_\n')}</button>
                ))}
              </div>
            </div>

            {/* Node Target */}
            <div style={{ marginBottom: '16px' }}>
              <p style={{ fontSize: '11px', color: 'var(--text-3)', margin: '0 0 6px' }}>🎯 Write Target</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {NODE_TARGETS.map(n => (
                  <button key={n.value} onClick={() => setNodeTarget(n.value)} style={{
                    padding: '8px 10px', borderRadius: '6px', border: '1px solid',
                    borderColor: nodeTarget === n.value ? n.color : 'var(--border)',
                    background: nodeTarget === n.value ? `${n.color}22` : 'transparent',
                    color: nodeTarget === n.value ? n.color : 'var(--text-3)',
                    fontSize: '11px', fontWeight: nodeTarget === n.value ? 700 : 400,
                    cursor: 'pointer', textAlign: 'left',
                    display: 'flex', alignItems: 'center', gap: '8px',
                  }}>
                    <span style={{
                      width: '8px', height: '8px', borderRadius: '50%', background: n.color, flexShrink: 0,
                    }} />
                    {n.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={runBenchmark}
              disabled={running}
              style={{
                width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
                background: running ? 'var(--bg-hover)' : 'linear-gradient(135deg,#8b5cf6,#6366f1)',
                color: 'white', fontWeight: 700, fontSize: '13px',
                cursor: running ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              }}
            >
              {running ? (
                <><span className="spinner" style={{ width: 16, height: 16 }} /> Benchmarking...</>
              ) : '🚀 Run Benchmark'}
            </button>
          </div>

          {/* Latest Result */}
          {result && (
            <div className="card" style={{ padding: '16px', border: '1px solid #8b5cf644' }}>
              <p style={{ fontSize: '10px', fontWeight: 700, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>Latest Result</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  ['✅ Success', result.benchmark?.success],
                  ['❌ Failed', result.benchmark?.failed],
                  ['⏱ Duration', `${result.benchmark?.duration_ms}ms`],
                  ['⚡ Throughput', `${result.benchmark?.throughput_per_sec} w/s`],
                  ['📉 Avg Latency', `${result.benchmark?.avg_latency_ms}ms`],
                ].map(([k, v]) => (
                  <div key={String(k)} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>{k}</span>
                    <strong style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-1)' }}>{v}</strong>
                  </div>
                ))}
              </div>
              {result.scaling_insight && (
                <p style={{ fontSize: '11px', color: '#8b5cf6', marginTop: '10px', lineHeight: 1.5, margin: '10px 0 0' }}>
                  💡 {result.scaling_insight}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Right: Charts & Comparison */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Throughput History Chart */}
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>⚡ Throughput — Writes/sec</p>
                <p style={{ fontSize: '11px', color: 'var(--text-4)', margin: '2px 0 0' }}>Mỗi thanh = 1 lần benchmark. Scale ngang → thêm clients → throughput tăng</p>
              </div>
              {history.length > 0 && (
                <button onClick={() => setHistory([])} style={{
                  fontSize: '10px', padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border)',
                  background: 'transparent', color: 'var(--text-4)', cursor: 'pointer',
                }}>Clear</button>
              )}
            </div>

            {history.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-4)', border: '2px dashed var(--border)', borderRadius: '10px' }}>
                <div style={{ fontSize: '40px', marginBottom: '8px' }}>📊</div>
                <p style={{ fontSize: '13px' }}>Chạy benchmark để thấy biểu đồ so sánh</p>
                <p style={{ fontSize: '11px', marginTop: '4px' }}>Thử thay đổi số clients để xem throughput thay đổi theo chiều ngang</p>
              </div>
            ) : (
              <div>
                {/* Bar Chart */}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '180px', padding: '0 4px' }}>
                  {history.map((h, i) => {
                    const pct = maxThroughput > 0 ? (h.throughput / maxThroughput) * 100 : 0;
                    return (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <div style={{ fontSize: '9px', color: 'var(--text-4)', fontFamily: 'monospace' }}>
                          {h.throughput.toFixed(0)}
                        </div>
                        <div style={{
                          width: '100%', borderRadius: '4px 4px 0 0',
                          background: h.color, height: `${Math.max(pct, 4)}%`,
                          transition: 'height 0.4s ease', opacity: 0.9,
                          boxShadow: `0 0 10px ${h.color}66`,
                          minHeight: '8px',
                        }} />
                        <div style={{ fontSize: '8px', color: 'var(--text-4)', fontFamily: 'monospace', textAlign: 'center', lineHeight: 1.3 }}>
                          {h.label}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '10px', color: 'var(--text-4)' }}>
                  <span>← Fewer clients</span>
                  <span style={{ color: '#8b5cf6' }}>Horizontal scaling: more clients = more throughput →</span>
                </div>
              </div>
            )}
          </div>

          {/* Latency Compare */}
          {history.length > 0 && (
            <div className="card" style={{ padding: '24px' }}>
              <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-1)', margin: '0 0 16px' }}>📉 Avg Latency (ms)</p>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '120px', padding: '0 4px' }}>
                {history.map((h, i) => {
                  const pct = maxLatency > 0 ? (h.latency / maxLatency) * 100 : 0;
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                      <div style={{ fontSize: '9px', color: 'var(--text-4)', fontFamily: 'monospace' }}>
                        {h.latency.toFixed(1)}ms
                      </div>
                      <div style={{
                        width: '100%', borderRadius: '4px 4px 0 0',
                        background: `${h.color}88`, height: `${Math.max(pct, 4)}%`,
                        minHeight: '4px',
                      }} />
                      <div style={{ fontSize: '8px', color: 'var(--text-4)', fontFamily: 'monospace', textAlign: 'center' }}>
                        {h.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Horizontal vs Vertical Scale Explainer */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="card" style={{ padding: '20px', border: '1px solid #6366f133' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#6366f1', margin: '0 0 10px', display: 'flex', gap: '8px' }}>
                ↔️ Horizontal Scaling
              </h3>
              <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: '12px', color: 'var(--text-3)', lineHeight: 2 }}>
                <li>Thêm node vào cluster</li>
                <li>Phân phối token ranges tự động</li>
                <li>Throughput tăng tuyến tính</li>
                <li>Zero downtime với RF≥2</li>
                <li><code style={{ background: 'var(--bg-code)', padding: '1px 4px', borderRadius: '3px', fontSize: '10px' }}>nodetool decommission</code></li>
              </ul>
              <div style={{ marginTop: '14px', padding: '10px', background: '#6366f111', borderRadius: '8px', fontSize: '11px', color: '#6366f1' }}>
                Demo: Tăng Clients từ 1→200 để thấy throughput scale tuyến tính
              </div>
            </div>

            <div className="card" style={{ padding: '20px', border: '1px solid #10b98133' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#10b981', margin: '0 0 10px', display: 'flex', gap: '8px' }}>
                ↕️ Vertical Scaling
              </h3>
              <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: '12px', color: 'var(--text-3)', lineHeight: 2 }}>
                <li>Tăng RAM/CPU cho từng node</li>
                <li>JVM Heap lớn hơn = ít GC hơn</li>
                <li>Cấu hình qua MAX_HEAP_SIZE</li>
                <li>Ít phổ biến hơn horizontal</li>
                <li>Có giới hạn phần cứng</li>
              </ul>
              <div style={{ marginTop: '14px', padding: '10px', background: '#10b98111', borderRadius: '8px', fontSize: '11px', color: '#10b981' }}>
                Docker compose: MAX_HEAP_SIZE=768M → 1G → 2G để thấy latency giảm
              </div>
            </div>
          </div>

          {/* Comparison Table */}
          <div className="card" style={{ padding: '20px' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 14px' }}>
              So Sánh: 1 Node vs 3 Nodes (RF=3)
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Tiêu chí', '1 Node', '3 Nodes (RF=3)', 'Lợi thế'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-4)', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Write Throughput', '~1x baseline', '~2-3x (parallel writes)', '🚀 3x faster'],
                    ['Read Availability', 'SPOF (0/1 fail)', 'Survive 1-2 nodes down', '✅ HA'],
                    ['Data Durability', 'Lost if node dies', 'RF=3: 2 copies survive', '🛡️ Durable'],
                    ['Consistency Options', 'Chỉ ONE', 'ONE/QUORUM/ALL', '🎛️ Flexible'],
                    ['Latency (LOCAL_QUORUM)', 'N/A', '~2-5ms avg', '⚡ Fast'],
                    ['Scale Out', 'Không thể', 'Thêm node không downtime', '↔️ Elastic'],
                  ].map(([a, b, c, d], i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--bg-hover)' }}>
                      <td style={{ padding: '8px 12px', color: 'var(--text-2)', fontWeight: 600 }}>{a}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-4)', fontFamily: 'monospace', fontSize: '11px' }}>{b}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-2)', fontFamily: 'monospace', fontSize: '11px' }}>{c}</td>
                      <td style={{ padding: '8px 12px', color: '#10b981', fontWeight: 700, fontSize: '11px' }}>{d}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
