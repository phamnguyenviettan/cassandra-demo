'use client';

import { useEffect, useState, useRef } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

const ROOMS = ['general', 'tech', 'random', 'cassandra-demo'];
const SENDERS = ['Alice', 'Bob', 'Carol', 'Dave', 'Eve'];
const CONSISTENCY_LEVELS = [
  { value: 'ONE', label: 'ONE', color: '#10b981', desc: 'Fastest — 1/3 nodes must ack. Best for speed.' },
  { value: 'LOCAL_QUORUM', label: 'LOCAL_QUORUM', color: '#6366f1', desc: 'Balanced — 2/3 nodes must ack. Recommended.' },
  { value: 'ALL', label: 'ALL', color: '#f59e0b', desc: 'Strongest — ALL 3 must ack. Fails if any node down.' },
];

type Message = {
  room_id: string;
  message_id: string;
  sender: string;
  content: string;
  node_written: string;
  consistency_used: string;
  timestamp: string;
  metadata?: Record<string, string>;
};

const nodeColor: Record<string, string> = {
  'node-1': '#6366f1',
  'node-2': '#10b981',
  'node-3': '#f59e0b',
  'cluster': '#8b5cf6',
};

export default function MessagesDemo() {
  const [selectedRoom, setSelectedRoom] = useState('general');
  const [sender, setSender] = useState('Alice');
  const [content, setContent] = useState('');
  const [metaKey, setMetaKey] = useState('device');
  const [metaVal, setMetaVal] = useState('web');
  const [consistency, setConsistency] = useState('LOCAL_QUORUM');
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const [lastWriteInfo, setLastWriteInfo] = useState<any>(null);
  const [concurrentResult, setConcurrentResult] = useState<any>(null);
  const [runningConcurrent, setRunningConcurrent] = useState(false);
  const [numClients, setNumClients] = useState(20);
  const [msgEach, setMsgEach] = useState(5);
  const [rooms, setRooms] = useState<any[]>([]);
  const [searchKey, setSearchKey] = useState('');
  const [searchVal, setSearchVal] = useState('');
  const [searchContent, setSearchContent] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);

  // Poll messages
  useEffect(() => {
    const fetch_ = () => fetchMessages();
    fetch_();
    if (isSearching) return; // Không tự động poll khi đang xem kết quả search
    const interval = setInterval(fetch_, 1500);
    return () => clearInterval(interval);
  }, [selectedRoom, consistency, isSearching]);

  // Poll rooms
  useEffect(() => {
    const fetchRooms_ = async () => {
      try {
        const res = await fetch(`${API}/api/messages/rooms`);
        if (res.ok) setRooms(await res.json().then(d => d.rooms || []));
      } catch {}
    };
    fetchRooms_();
    const interval = setInterval(fetchRooms_, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchMessages = async () => {
    try {
      let queryParams = [];
      if (searchKey.trim() && searchVal.trim()) {
        queryParams.push(`meta_key=${encodeURIComponent(searchKey.trim())}`, `meta_val=${encodeURIComponent(searchVal.trim())}`);
      }
      if (searchContent.trim()) {
        queryParams.push(`q=${encodeURIComponent(searchContent.trim())}`);
      }
      const url = queryParams.length > 0 && isSearching
        ? `${API}/api/messages/${encodeURIComponent(selectedRoom)}/search?${queryParams.join('&')}`
        : `${API}/api/messages/${encodeURIComponent(selectedRoom)}?consistency=${consistency}`;
      
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch {}
  };

  const handleSearch = () => {
    if ((searchKey.trim() && searchVal.trim()) || searchContent.trim()) {
      setIsSearching(true);
      fetchMessages();
    }
  };

  const clearSearch = () => {
    setSearchKey('');
    setSearchVal('');
    setSearchContent('');
    setIsSearching(false);
  };

  const sendMessage = async () => {
    if (!content.trim()) return;
    setSending(true);
    try {
      const metadata: Record<string, string> = {};
      if (metaKey.trim() && metaVal.trim()) {
        metadata[metaKey.trim()] = metaVal.trim();
      }
      const res = await fetch(`${API}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: selectedRoom, sender, content, consistency, metadata }),
      });
      const data = await res.json();
      if (res.ok) {
        setLastWriteInfo(data);
        setContent('');
        await fetchMessages();
      } else {
        setLastWriteInfo({ error: data.error, hint: data.hint, consistency: data.consistency });
      }
    } catch (e: any) {
      setLastWriteInfo({ error: e.message });
    } finally {
      setSending(false);
    }
  };

  const runConcurrentTest = async () => {
    setRunningConcurrent(true);
    setConcurrentResult(null);
    try {
      const res = await fetch(`${API}/api/messages/concurrent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: selectedRoom, num_clients: numClients, messages_each: msgEach, consistency }),
      });
      const data = await res.json();
      setConcurrentResult(data);
      await fetchMessages();
    } catch (e: any) {
      setConcurrentResult({ error: e.message });
    } finally {
      setRunningConcurrent(false);
    }
  };

  const formatTime = (ts: string) => {
    try { return new Date(ts).toLocaleTimeString(); } catch { return ts; }
  };

  const chosenConsistency = CONSISTENCY_LEVELS.find(l => l.value === consistency)!;

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: 800, margin: 0, color: 'var(--text-1)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', borderRadius: '10px', padding: '6px 12px', fontSize: '16px' }}>💬</span>
          NoSQL Messages — Time-Series Demo
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-3)', marginTop: '6px' }}>
          Bảng <code style={{ background: 'var(--bg-code)', padding: '1px 6px', borderRadius: '4px' }}>messages</code> partitioned by <strong>room_id</strong>,
          clustered by <strong>TIMEUUID</strong> — ghi đồng thời không cần lock, không có collision.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '20px' }}>
        {/* Left Panel — Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Room Selector */}
          <div className="card" style={{ padding: '16px' }}>
            <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>Chọn Room</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {ROOMS.map(r => {
                const roomData = rooms.find((x: any) => x.room_id === r);
                return (
                  <button
                    key={r}
                    onClick={() => setSelectedRoom(r)}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '8px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                      background: selectedRoom === r ? 'var(--accent)' : 'var(--bg-hover)',
                      color: selectedRoom === r ? 'white' : 'var(--text-2)',
                      fontWeight: selectedRoom === r ? 700 : 500, fontSize: '13px',
                      transition: 'all 0.15s',
                    }}
                  >
                    <span># {r}</span>
                    {roomData && <span style={{ fontSize: '10px', opacity: 0.8 }}>{roomData.message_count} msgs</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search Khả năng SAI Index trên Map & Text */}
          <div className="card" style={{ padding: '16px', border: '1px solid #10b98144', background: '#10b98108' }}>
            <p style={{ fontSize: '10px', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>
              🔍 NoSQL Search MAP & Text
            </p>
            <p style={{ fontSize: '10px', color: 'var(--text-3)', margin: '0 0 8px', lineHeight: 1.4 }}>
              Dữ liệu của MAP được tạo StorageAttachedIndex, cho phép search O(1). Kết hợp với bộ lọc Partition Full-text siêu nhẹ.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <input value={searchKey} onChange={e => setSearchKey(e.target.value)} placeholder="MAP Key" style={{ fontSize: '11px', padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-1)' }} />
                <input value={searchVal} onChange={e => setSearchVal(e.target.value)} placeholder="MAP Value" style={{ fontSize: '11px', padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-1)' }} />
              </div>
              <input value={searchContent} onChange={e => setSearchContent(e.target.value)} placeholder="Tìm Nội dung hoặc Người gửi (vd: Hi, Alice)" style={{ width: '100%', fontSize: '11px', padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-1)' }} />
              <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
                <button onClick={handleSearch} disabled={(!searchKey.trim() || !searchVal.trim()) && !searchContent.trim()} style={{ flex: 1, padding: '6px', borderRadius: '4px', border: 'none', background: '#10b981', color: 'white', fontWeight: 700, fontSize: '11px', cursor: ((!searchKey.trim() || !searchVal.trim()) && !searchContent.trim()) ? 'not-allowed' : 'pointer' }}>Search</button>
                {isSearching && <button onClick={clearSearch} style={{ flex: 1, padding: '6px', borderRadius: '4px', border: '1px solid var(--danger)', background: 'transparent', color: 'var(--danger)', fontWeight: 700, fontSize: '11px', cursor: 'pointer' }}>Clear</button>}
              </div>
            </div>
          </div>

          {/* Sender */}
          <div className="card" style={{ padding: '16px' }}>
            <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>Sender</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {SENDERS.map(s => (
                <button key={s} onClick={() => setSender(s)} style={{
                  padding: '4px 10px', borderRadius: '20px', border: '1px solid',
                  borderColor: sender === s ? 'var(--accent)' : 'var(--border)',
                  background: sender === s ? 'var(--accent)' : 'transparent',
                  color: sender === s ? 'white' : 'var(--text-3)',
                  fontSize: '12px', cursor: 'pointer', fontWeight: sender === s ? 700 : 400,
                }}>{s}</button>
              ))}
            </div>
          </div>

          {/* Consistency Level */}
          <div className="card" style={{ padding: '16px' }}>
            <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>Consistency Level</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {CONSISTENCY_LEVELS.map(l => (
                <button key={l.value} onClick={() => setConsistency(l.value)} style={{
                  padding: '10px 12px', borderRadius: '8px', border: '2px solid',
                  borderColor: consistency === l.value ? l.color : 'var(--border)',
                  background: consistency === l.value ? `${l.color}22` : 'transparent',
                  cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: consistency === l.value ? l.color : 'var(--text-2)', fontFamily: 'monospace' }}>{l.label}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-4)', marginTop: '2px' }}>{l.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Concurrent Write Test */}
          <div className="card" style={{ padding: '16px', border: '1px solid #6366f133' }}>
            <p style={{ fontSize: '10px', fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px' }}>⚡ Concurrent Write Test</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-3)' }}>
                Clients đồng thời: <strong style={{ color: 'var(--text-1)' }}>{numClients}</strong>
                <input type="range" min={5} max={100} value={numClients} onChange={e => setNumClients(+e.target.value)}
                  style={{ width: '100%', marginTop: '4px', accentColor: '#6366f1' }} />
              </label>
              <label style={{ fontSize: '11px', color: 'var(--text-3)' }}>
                Messages/client: <strong style={{ color: 'var(--text-1)' }}>{msgEach}</strong>
                <input type="range" min={1} max={20} value={msgEach} onChange={e => setMsgEach(+e.target.value)}
                  style={{ width: '100%', marginTop: '4px', accentColor: '#6366f1' }} />
              </label>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-4)', marginBottom: '10px' }}>
              Tổng: <strong style={{ color: 'var(--text-1)' }}>{numClients * msgEach} messages</strong> từ {numClients} goroutines đồng thời
            </div>
            <button
              onClick={runConcurrentTest}
              disabled={runningConcurrent}
              style={{
                width: '100%', padding: '10px', borderRadius: '8px', border: 'none',
                background: runningConcurrent ? 'var(--bg-hover)' : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                color: 'white', fontWeight: 700, fontSize: '12px', cursor: runningConcurrent ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              }}
            >
              {runningConcurrent ? (
                <><span className="spinner" style={{ width: 14, height: 14 }} /> Running...</>
              ) : '🚀 Launch Concurrent Test'}
            </button>

            {concurrentResult && (
              <div style={{ marginTop: '12px', padding: '12px', background: 'var(--bg-hover)', borderRadius: '8px' }}>
                {concurrentResult.error ? (
                  <p style={{ color: 'var(--danger)', fontSize: '11px', margin: 0 }}>❌ {concurrentResult.error}</p>
                ) : (
                  <>
                    <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', margin: '0 0 8px' }}>Results</p>
                    {[
                      ['✅ Success', concurrentResult.summary?.success],
                      ['❌ Failed', concurrentResult.summary?.failed],
                      ['⏱ Duration', `${concurrentResult.summary?.duration_ms}ms`],
                      ['⚡ Throughput', `${concurrentResult.summary?.throughput_per_sec} writes/sec`],
                    ].map(([k, v]) => (
                      <div key={String(k)} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', padding: '2px 0' }}>
                        <span style={{ color: 'var(--text-3)' }}>{k}</span>
                        <strong style={{ color: 'var(--text-1)', fontFamily: 'monospace' }}>{v}</strong>
                      </div>
                    ))}
                    <p style={{ fontSize: '10px', color: '#6366f1', marginTop: '8px', margin: '8px 0 0', lineHeight: '1.5' }}>
                      💡 {concurrentResult.cassandra_advantage}
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel — Chat */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Write info banner */}
          {lastWriteInfo && (
            <div style={{
              padding: '12px 16px', borderRadius: '10px',
              background: lastWriteInfo.error ? '#ef444422' : '#10b98122',
              border: `1px solid ${lastWriteInfo.error ? '#ef4444' : '#10b981'}44`,
              fontSize: '12px',
            }}>
              {lastWriteInfo.error ? (
                <div>
                  <strong style={{ color: '#ef4444' }}>❌ Write Failed ({lastWriteInfo.consistency})</strong>
                  <p style={{ margin: '4px 0 0', color: 'var(--text-3)' }}>{lastWriteInfo.hint || lastWriteInfo.error}</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                  <span>✅ <strong>Message sent</strong></span>
                  <span style={{ color: 'var(--text-3)' }}>Node: <strong style={{ color: nodeColor[lastWriteInfo.node_written] || '#fff' }}>{lastWriteInfo.node_written}</strong></span>
                  <span style={{ color: 'var(--text-3)' }}>Consistency: <code style={{ background: 'var(--bg-code)', padding: '1px 6px', borderRadius: '4px', color: chosenConsistency.color }}>{lastWriteInfo.consistency}</code></span>
                  <span style={{ color: 'var(--text-3)', fontSize: '11px' }}>📌 {lastWriteInfo.replication_note}</span>
                </div>
              )}
            </div>
          )}

          {/* Messages Feed */}
          <div className="card" style={{ flex: 1, padding: '0', overflow: 'hidden', minHeight: '400px' }}>
            <div style={{
              padding: '14px 16px', borderBottom: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <span style={{ fontWeight: 700, color: 'var(--text-1)', fontSize: '14px' }}># {selectedRoom}</span>
                <span style={{ marginLeft: '10px', fontSize: '11px', color: 'var(--text-4)' }}>{messages.length} messages</span>
                {isSearching && <span style={{ marginLeft: '10px', fontSize: '10px', background: '#10b98133', color: '#10b981', padding: '2px 8px', borderRadius: '12px' }}>Search Filtered</span>}
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-4)' }}>Reading with:</span>
                <span style={{ fontFamily: 'monospace', fontSize: '11px', fontWeight: 700, color: chosenConsistency.color,
                  background: `${chosenConsistency.color}22`, padding: '2px 8px', borderRadius: '4px' }}>
                  {consistency}
                </span>
              </div>
            </div>

            <div ref={feedRef} style={{ height: '400px', overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {messages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-4)' }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>💬</div>
                  <p style={{ fontSize: '13px' }}>Chưa có tin nhắn nào trong #{selectedRoom}</p>
                  <p style={{ fontSize: '11px', marginTop: '4px' }}>Gửi tin nhắn đầu tiên hoặc chạy Concurrent Test!</p>
                </div>
              ) : (
                [...messages].reverse().map((msg) => (
                  <div key={msg.message_id} style={{
                    display: 'flex', flexDirection: 'column', gap: '4px',
                    padding: '10px 12px', borderRadius: '10px',
                    background: 'var(--bg-hover)', border: '1px solid var(--border)',
                    borderLeft: `3px solid ${nodeColor[msg.node_written] || '#6366f1'}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          width: '28px', height: '28px', borderRadius: '50%',
                          background: 'var(--accent)', color: 'white',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '12px', fontWeight: 700,
                        }}>{msg.sender?.[0] || '?'}</span>
                        <strong style={{ fontSize: '13px', color: 'var(--text-1)' }}>{msg.sender}</strong>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <span style={{
                          fontSize: '9px', fontFamily: 'monospace', padding: '2px 6px', borderRadius: '4px',
                          background: `${nodeColor[msg.node_written] || '#6366f1'}22`,
                          color: nodeColor[msg.node_written] || '#6366f1', fontWeight: 700,
                        }}>{msg.node_written}</span>
                        <span style={{ fontSize: '10px', color: 'var(--text-4)' }}>{formatTime(msg.timestamp)}</span>
                      </div>
                    </div>
                    <p style={{ margin: '0 0 0 36px', fontSize: '13px', color: 'var(--text-2)', lineHeight: '1.5' }}>{msg.content}</p>
                    {msg.metadata && Object.keys(msg.metadata).length > 0 && (
                      <div style={{ marginLeft: '36px', display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                        {Object.entries(msg.metadata).map(([k, v]) => (
                          <span key={k} style={{
                            fontSize: '10px', color: 'var(--text-3)', fontFamily: 'monospace',
                            background: 'var(--bg-card)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border)'
                          }}>
                            {k}: <span style={{ color: 'var(--info)' }}>{v}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Input */}
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendMessage()}
                  placeholder={`Message #${selectedRoom} as ${sender}...`}
                  style={{
                    flex: 1, padding: '10px 14px', borderRadius: '8px',
                    border: '1px solid var(--border)', background: 'var(--bg-input)',
                    color: 'var(--text-1)', fontSize: '13px', outline: 'none',
                  }}
                />
                <button
                  onClick={sendMessage}
                  disabled={sending || !content.trim()}
                  style={{
                    padding: '10px 20px', borderRadius: '8px', border: 'none',
                    background: sending ? 'var(--bg-hover)' : 'var(--accent)',
                    color: 'white', fontWeight: 700, fontSize: '13px',
                    cursor: sending ? 'not-allowed' : 'pointer',
                  }}
                >
                  {sending ? '...' : 'Send'}
                </button>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-4)', fontWeight: 700 }}>MAP&lt;TEXT,TEXT&gt;:</span>
                <input value={metaKey} onChange={e => setMetaKey(e.target.value)} placeholder="Key" style={{ width: '80px', fontSize: '11px', padding: '4px 6px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-1)' }} />
                <span style={{ color: 'var(--text-4)' }}>:</span>
                <input value={metaVal} onChange={e => setMetaVal(e.target.value)} placeholder="Value" style={{ width: '120px', fontSize: '11px', padding: '4px 6px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-1)' }} />
                <span style={{ fontSize: '10px', color: 'var(--text-4)', marginLeft: '10px' }}>(Thử nhập device: iPhone hoặc region: VN)</span>
              </div>
            </div>
          </div>

          {/* NoSQL Schema info */}
          <div className="card" style={{ padding: '16px' }}>
            <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>
              NoSQL Schema — Time-Series Pattern
            </p>
            <pre style={{
              margin: 0, fontSize: '11px', color: 'var(--text-2)', lineHeight: '1.8',
              background: 'var(--bg-code)', padding: '12px', borderRadius: '8px', overflowX: 'auto',
            }}>{`CREATE TABLE messages (
  room_id          TEXT,         -- Partition Key (data locality)
  message_id       TIMEUUID,     -- Clustering Key (no collision!)
  sender           TEXT,
  content          TEXT,
  node_written     TEXT,         -- Tracks which node wrote
  consistency_used TEXT,         -- Tracks consistency level used
  metadata         MAP<TEXT,TEXT>,-- Flexible NoSQL attributes
  PRIMARY KEY ((room_id), message_id)
) WITH CLUSTERING ORDER BY (message_id DESC)  -- Newest first
  AND compaction = { 'class': 'TimeWindowCompactionStrategy' }`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
