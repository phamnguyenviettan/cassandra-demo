'use client';

import { useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

type NodeStatus = {
  status: string;
  port: number;
  name: string;
  dc: string;
};

type ClusterData = {
  nodes: Record<string, NodeStatus>;
  online_count: number;
  replication_factor: number;
  quorum_available: boolean;
  all_available: boolean;
  consistency_levels?: {
    level: string;
    required_nodes: number;
    available: boolean;
    description: string;
  }[];
};

type HATestResult = {
  online_nodes: number;
  replication_factor: number;
  ha_status: string;
  consistency_tests: {
    level: string;
    required: number;
    success: boolean;
    latency_ms: number;
    error?: string;
    description: string;
  }[];
};

const STATUS_COLOR: Record<string, string> = {
  online: '#10b981',
  unreachable: '#f59e0b',
  offline: '#ef4444',
};

const NODE_COLORS = ['#6366f1', '#10b981', '#f59e0b'];

export default function ClusterDemo() {
  const [clusterData, setClusterData] = useState<ClusterData | null>(null);
  const [scaleStatus, setScaleStatus] = useState<any>(null);
  const [haResult, setHAResult] = useState<HATestResult | null>(null);
  const [runningHA, setRunningHA] = useState(false);
  const [consistencyDemo, setConsistencyDemo] = useState<any>(null);
  const [runningConsDemo, setRunningConsDemo] = useState(false);
  const [selectedCons, setSelectedCons] = useState('LOCAL_QUORUM');

  useEffect(() => {
    const fetchAll = () => {
      fetchCluster();
      fetchScaleStatus();
    };
    fetchAll();
    const interval = setInterval(fetchAll, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchCluster = async () => {
    try {
      const res = await fetch(`${API}/api/demo/cluster/status`);
      if (res.ok) setClusterData(await res.json());
    } catch {}
  };

  const fetchScaleStatus = async () => {
    try {
      const res = await fetch(`${API}/api/scale/status`);
      if (res.ok) setScaleStatus(await res.json());
    } catch {}
  };

  const runHATest = async () => {
    setRunningHA(true);
    try {
      const res = await fetch(`${API}/api/scale/ha-test`);
      if (res.ok) setHAResult(await res.json());
    } catch {}
    setRunningHA(false);
  };

  const runConsistencyDemo = async () => {
    setRunningConsDemo(true);
    try {
      const res = await fetch(`${API}/api/scale/consistency-demo`);
      if (res.ok) setConsistencyDemo(await res.json());
    } catch {}
    setRunningConsDemo(false);
  };

  const nodes = clusterData ? [
    { key: 'node_1', ...clusterData.nodes['node_1'], color: NODE_COLORS[0], emoji: '🔵', label: 'NODE 1', role: 'Seed / Primary' },
    { key: 'node_2', ...clusterData.nodes['node_2'], color: NODE_COLORS[1], emoji: '🟢', label: 'NODE 2', role: 'Replica' },
    { key: 'node_3', ...clusterData.nodes['node_3'], color: NODE_COLORS[2], emoji: '🟡', label: 'NODE 3', role: 'Replica' },
  ] : [];

  const onlineCount = clusterData?.online_count ?? 0;

  const healthLabel = () => {
    if (!clusterData) return { text: 'Loading...', color: 'var(--text-4)' };
    if (onlineCount === 3) return { text: '✅ FULL HA — All consistency levels work', color: '#10b981' };
    if (onlineCount === 2) return { text: '⚡ QUORUM — ONE & LOCAL_QUORUM work; ALL fails', color: '#f59e0b' };
    if (onlineCount === 1) return { text: '⚠️ DEGRADED — Only ONE consistency works', color: '#ef4444' };
    return { text: '❌ CLUSTER DOWN', color: '#ef4444' };
  };

  const health = healthLabel();

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: 800, margin: 0, color: 'var(--text-1)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ background: 'linear-gradient(135deg,#10b981,#059669)', borderRadius: '10px', padding: '6px 12px', fontSize: '16px' }}>🔴</span>
          Cluster High Availability — 3 Nodes, RF=3
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-3)', marginTop: '6px' }}>
          Replication Factor=3: mỗi row được ghi lên TẤT CẢ 3 nodes. Cluster vẫn hoạt động khi mất 1-2 nodes tuỳ consistency level.
        </p>
      </div>

      {/* Cluster Health Banner */}
      <div style={{
        padding: '14px 20px', borderRadius: '10px', marginBottom: '20px',
        background: `${health.color}18`, border: `1px solid ${health.color}44`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: health.color }}>{health.text}</div>
        <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>
          <strong style={{ color: 'var(--text-1)' }}>{onlineCount}/3</strong> nodes online · RF=3
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
        {/* 3-Node Ring Visualization */}
        <div className="card" style={{ padding: '24px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 20px' }}>
            Token Ring — 3 Nodes, Đều Nhau
          </p>

          {/* SVG Ring */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
            <svg width="240" height="240" viewBox="0 0 240 240">
              {/* Ring background */}
              <circle cx="120" cy="120" r="90" fill="none" stroke="var(--border)" strokeWidth="2" />

              {/* Token segments (3 equal arcs) */}
              {nodes.map((node, i) => {
                const startAngle = (i * 120 - 90) * (Math.PI / 180);
                const endAngle = ((i + 1) * 120 - 90) * (Math.PI / 180);
                const r = 90;
                const x1 = 120 + r * Math.cos(startAngle);
                const y1 = 120 + r * Math.sin(startAngle);
                const x2 = 120 + r * Math.cos(endAngle);
                const y2 = 120 + r * Math.sin(endAngle);
                const isOnline = node?.status === 'online';
                return (
                  <g key={i}>
                    <path
                      d={`M 120 120 L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`}
                      fill={isOnline ? `${node.color}22` : '#ffffff08'}
                      stroke={isOnline ? node.color : '#374151'}
                      strokeWidth="1"
                    />
                  </g>
                );
              })}

              {/* Center */}
              <circle cx="120" cy="120" r="30" fill="var(--bg-card)" stroke="var(--border)" strokeWidth="2" />
              <text x="120" y="116" textAnchor="middle" fill="var(--text-3)" fontSize="9" fontWeight="bold">RING</text>
              <text x="120" y="128" textAnchor="middle" fill="var(--text-4)" fontSize="8">RF=3</text>

              {/* Nodes on ring */}
              {nodes.map((node, i) => {
                const angle = (i * 120 - 90 + 60) * (Math.PI / 180);
                const r = 90;
                const x = 120 + r * Math.cos(angle);
                const y = 120 + r * Math.sin(angle);
                const isOnline = node?.status === 'online';
                return (
                  <g key={i}>
                    {/* Pulse ring for online nodes */}
                    {isOnline && (
                      <circle cx={x} cy={y} r="16" fill="none" stroke={node.color} strokeWidth="1" opacity="0.4">
                        <animate attributeName="r" values="16;22;16" dur="2s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite" />
                      </circle>
                    )}
                    <circle cx={x} cy={y} r="14"
                      fill={isOnline ? `${node.color}33` : '#1f2937'}
                      stroke={isOnline ? node.color : '#4b5563'} strokeWidth="2"
                    />
                    <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="middle"
                      fill={isOnline ? node.color : '#6b7280'} fontSize="8" fontWeight="bold">
                      N{i + 1}
                    </text>

                    {/* Replication arrows between nodes */}
                    {isOnline && i < nodes.length - 1 && (
                      <line
                        x1={120 + 90 * Math.cos((i * 120 - 90 + 60) * Math.PI / 180)}
                        y1={120 + 90 * Math.sin((i * 120 - 90 + 60) * Math.PI / 180)}
                        x2={120 + 90 * Math.cos(((i + 1) * 120 - 90 + 60) * Math.PI / 180)}
                        y2={120 + 90 * Math.sin(((i + 1) * 120 - 90 + 60) * Math.PI / 180)}
                        stroke={node.color} strokeWidth="1" strokeDasharray="4 4" opacity="0.4"
                      />
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Node Status Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {nodes.map((node, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', borderRadius: '8px',
                background: node?.status === 'online' ? `${node.color}11` : 'var(--bg-hover)',
                border: `1px solid ${node?.status === 'online' ? node.color + '44' : 'var(--border)'}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '10px', height: '10px', borderRadius: '50%',
                    background: STATUS_COLOR[node?.status] || '#6b7280',
                    boxShadow: node?.status === 'online' ? `0 0 8px ${STATUS_COLOR['online']}` : 'none',
                  }} />
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-1)' }}>{node?.label || `NODE ${i + 1}`}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-4)', fontFamily: 'monospace' }}>
                      :{node?.port} · {node?.role}
                    </div>
                  </div>
                </div>
                <span style={{
                  fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '12px',
                  background: `${STATUS_COLOR[node?.status] || '#6b728033'}33`,
                  color: STATUS_COLOR[node?.status] || '#6b7280',
                  textTransform: 'uppercase',
                }}>{node?.status || 'unknown'}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Consistency Level Demo */}
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
              Consistency Level — Live Test
            </p>
            <button
              onClick={runConsistencyDemo}
              disabled={runningConsDemo}
              style={{
                padding: '6px 14px', borderRadius: '6px', border: 'none',
                background: runningConsDemo ? 'var(--bg-hover)' : '#6366f1',
                color: 'white', fontSize: '11px', fontWeight: 700, cursor: runningConsDemo ? 'not-allowed' : 'pointer',
              }}
            >
              {runningConsDemo ? 'Running...' : '▶ Run Test'}
            </button>
          </div>

          {/* Consistency Explanation Grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
            {[
              { level: 'ONE', required: 1, color: '#10b981', desc: 'Cần 1/3 node ACK. Nhanh nhất. OK khi cả 3 node đều xuống 2.' },
              { level: 'LOCAL_QUORUM', required: 2, color: '#6366f1', desc: 'Cần 2/3 node ACK. Cân bằng. Cluster mất 1 node vẫn OK.' },
              { level: 'ALL', required: 3, color: '#f59e0b', desc: 'Cần 3/3 node ACK. Chính xác nhất. Fail nếu MỘT node xuống.' },
            ].map(item => {
              const dotsOnline = Math.min(item.required, onlineCount);
              return (
                <div key={item.level} style={{
                  padding: '12px', borderRadius: '10px',
                  border: `1px solid ${item.color}44`,
                  background: `${item.color}11`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <code style={{ fontSize: '12px', fontWeight: 700, color: item.color }}>{item.level}</code>
                    {/* Visual: dots = nodes required */}
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {[0, 1, 2].map(di => (
                        <div key={di} style={{
                          width: '10px', height: '10px', borderRadius: '50%',
                          background: di < item.required ? item.color : 'var(--bg-hover)',
                          border: `1px solid ${di < item.required ? item.color : 'var(--border)'}`,
                          opacity: di < item.required && di < onlineCount ? 1 : (di < item.required ? 0.3 : 0.2),
                        }} />
                      ))}
                    </div>
                  </div>
                  <p style={{ fontSize: '11px', color: 'var(--text-3)', margin: 0 }}>{item.desc}</p>
                  <div style={{ marginTop: '6px', fontSize: '10px', fontWeight: 700,
                    color: onlineCount >= item.required ? '#10b981' : '#ef4444' }}>
                    {onlineCount >= item.required ? '✅ Available' : `❌ Needs ${item.required} online, have ${onlineCount}`}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Live Test Results */}
          {consistencyDemo && (
            <div>
              <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', margin: '0 0 8px' }}>Live Results</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {consistencyDemo.results?.map((r: any, i: number) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 12px', borderRadius: '8px',
                    background: r.success ? '#10b98111' : '#ef444411',
                    border: `1px solid ${r.success ? '#10b98133' : '#ef444433'}`,
                  }}>
                    <div>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-1)', fontFamily: 'monospace' }}>{r.consistency}</span>
                      <span style={{ fontSize: '10px', color: 'var(--text-4)', marginLeft: '8px' }}>via {r.node}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--text-3)' }}>{r.latency_ms}ms</span>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: r.success ? '#10b981' : '#ef4444' }}>
                        {r.success ? '✅' : '❌ ' + (r.error?.substring(0, 30) || 'fail')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Interactive Demo Guide */}
      <div className="card" style={{ padding: '24px', marginBottom: '20px', border: '1px solid #f59e0b44' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 800, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px', color: '#f59e0b' }}>
          🔥 Chaos Engineering: Giả lập sự cố mất Node
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.5, margin: '0 0 16px' }}>
          Để xem High Availability thực sự hoạt động thế nào, bạn hãy làm sập Node 3 và quan sát UI chuyển đổi theo thời gian thực.
          Hãy COPY lệnh dưới đây và dán vào Terminal máy bạn:
        </p>

        <div style={{ position: 'relative', marginBottom: '16px' }}>
          <pre style={{
            background: 'var(--bg-code)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)',
            fontSize: '12px', color: '#a78bfa', margin: 0, overflowX: 'auto', whiteSpace: 'pre-wrap', lineHeight: 1.6
          }}>
{`echo "🔴 Tắt Node 3..." && sudo docker stop cassandra-vector-3 && echo "⏳ Chờ 60s để bạn test..." && sleep 60 && echo "🟢 Bật lại Node 3..." && sudo docker start cassandra-vector-3`}
          </pre>
          <button
            onClick={(e) => {
              const text = `echo "🔴 Tắt Node 3..." && sudo docker stop cassandra-vector-3 && echo "⏳ Chờ 60s để bạn test..." && sleep 60 && echo "🟢 Bật lại Node 3..." && sudo docker start cassandra-vector-3`;
              navigator.clipboard.writeText(text);
              (e.target as HTMLButtonElement).innerText = 'Copied!';
              setTimeout(() => (e.target as HTMLButtonElement).innerText = 'Copy', 2000);
            }}
            style={{
              position: 'absolute', top: '10px', right: '10px', padding: '4px 8px', borderRadius: '4px',
              border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-3)',
              fontSize: '10px', cursor: 'pointer', fontWeight: 700
            }}
          >
            Copy
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '16px' }}>
          <div style={{ padding: '12px', background: '#ef444411', borderLeft: '3px solid #ef4444', borderRadius: '4px' }}>
            <strong style={{ fontSize: '12px', color: '#ef4444', display: 'block', marginBottom: '4px' }}>🔴 Sau khi tắt Node 3:</strong>
            <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: '11px', color: 'var(--text-3)', lineHeight: 1.6 }}>
              <li>Đợi ~5s, nhìn vòng Ring ở trên: <strong>NODE 3</strong> sẽ chuyển màu đỏ (Offline).</li>
              <li>Bấm nút <strong>"Run Test"</strong> ở các bảng dưới.</li>
              <li>Kết quả: <strong>LOCAL_QUORUM</strong> vẫn ghi/đọc ✅ bình thường (vì 2/3 nodes còn sống). Tính năng của bạn không bị sập!</li>
              <li>Kết quả: <strong>ALL</strong> bị lỗi ❌ (vì thiếu Node 3).</li>
            </ul>
          </div>
          <div style={{ padding: '12px', background: '#10b98111', borderLeft: '3px solid #10b981', borderRadius: '4px' }}>
            <strong style={{ fontSize: '12px', color: '#10b981', display: 'block', marginBottom: '4px' }}>🟢 Đợi 60s khi Node 3 sống lại:</strong>
            <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: '11px', color: 'var(--text-3)', lineHeight: 1.6 }}>
              <li>Vòng Ring sẽ hiển thị Node 3 màu vàng nhấp nháy rồi chuyển sang xanh.</li>
              <li>Cassandra tự động đồng bộ (Hinted Handoff) dữ liệu 60s bị lỡ cho Node 3.</li>
              <li>Bấm lại Test: Mức <strong>ALL</strong> xanh trở lại. Hệ thống phục hồi 100%.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* HA Test Section */}
      <div className="card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px' }}>
              HA Test — Kiểm Tra Tính Sẵn Sàng
            </p>
            <p style={{ fontSize: '12px', color: 'var(--text-3)', margin: 0 }}>
              Test thực tế: với {onlineCount} node đang online, consistency level nào THỰC SỰ hoạt động?
            </p>
          </div>
          <button
            onClick={runHATest}
            disabled={runningHA}
            style={{
              padding: '10px 20px', borderRadius: '8px', border: 'none',
              background: runningHA ? 'var(--bg-hover)' : 'linear-gradient(135deg,#10b981,#059669)',
              color: 'white', fontWeight: 700, fontSize: '13px', cursor: runningHA ? 'not-allowed' : 'pointer',
            }}
          >
            {runningHA ? '⏱ Testing...' : '🧪 Run HA Test Now'}
          </button>
        </div>

        {haResult ? (
          <div>
            <div style={{
              padding: '12px 16px', borderRadius: '10px', marginBottom: '16px',
              background: haResult.online_nodes >= 2 ? '#10b98122' : '#ef444422',
              border: `1px solid ${haResult.online_nodes >= 2 ? '#10b98144' : '#ef444444'}`,
              fontSize: '14px', fontWeight: 700,
              color: haResult.online_nodes >= 2 ? '#10b981' : '#ef4444',
            }}>
              {haResult.ha_status}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px' }}>
              {haResult.consistency_tests?.map((test, i) => (
                <div key={i} style={{
                  padding: '16px', borderRadius: '10px',
                  background: test.success ? '#10b98111' : '#ef444411',
                  border: `2px solid ${test.success ? '#10b98144' : '#ef444444'}`,
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '28px', marginBottom: '8px' }}>
                    {test.success ? '✅' : '❌'}
                  </div>
                  <code style={{ fontSize: '13px', fontWeight: 700, display: 'block', marginBottom: '6px',
                    color: test.success ? '#10b981' : '#ef4444' }}>
                    {test.level}
                  </code>
                  <p style={{ fontSize: '11px', color: 'var(--text-3)', margin: '0 0 8px' }}>{test.description}</p>
                  <div style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-4)' }}>
                    {test.success ? `${test.latency_ms}ms` : (test.error?.substring(0, 50) || 'Failed')}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-4)', marginTop: '4px' }}>
                    Requires {test.required}/3 nodes
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-4)', border: '2px dashed var(--border)', borderRadius: '10px' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>🧪</div>
            <p style={{ fontSize: '13px' }}>Nhấn "Run HA Test" để kiểm tra thực tế với cluster hiện tại</p>
            <p style={{ fontSize: '11px', marginTop: '4px' }}>Tip: Dừng 1-2 node trong Docker để xem ALL consistency fail nhưng LOCAL_QUORUM vẫn hoạt động</p>
          </div>
        )}
      </div>
    </div>
  );
}
