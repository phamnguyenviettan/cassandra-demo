"use client";

import { useEffect, useState, useRef } from "react";
import { Line } from "react-chartjs-2";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
} from "chart.js";

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);

// Types
type ClusterStatus = {
    node_1: string;
    node_2: string;
};

type TelemetryData = {
    timestamp: string;
    metric: string;
    value: string;
};

export default function MissionControl() {
    const [clusterStatus, setClusterStatus] = useState<ClusterStatus>({
        node_1: "unknown",
        node_2: "unknown",
    });
    const [telemetryData, setTelemetryData] = useState<TelemetryData[]>([]);
    // const [selectedNode, setSelectedNode] = useState<string>("any"); // Removed in redesign
    const [isFocusMode, setIsFocusMode] = useState(false);
    const [sessionWrites, setSessionWrites] = useState(0);
    const focusIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Poll Cluster Status
    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const res = await fetch("/api/demo/cluster/status");
                if (res.ok) {
                    const data = await res.json();
                    setClusterStatus(data);
                }
            } catch (e) {
                console.error("Failed to fetch cluster status", e);
            }
        };

        fetchStatus();
        const interval = setInterval(fetchStatus, 5000);
        return () => clearInterval(interval);
    }, []);

    // Poll Telemetry Data for Chart
    useEffect(() => {
        const fetchTelemetry = async () => {
            const demoUserId = "550e8400-e29b-41d4-a716-446655440000";
            try {
                // ALWAYS read from Node 2 for the "Replication" demo to prove it works
                const url = `/api/demo/telemetry/${demoUserId}?node=node_2`;

                const res = await fetch(url);
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data)) {
                        // Sort by timestamp
                        data.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                        setTelemetryData(data.slice(-50)); // Keep last 50 for smoother chart
                    }
                }
            } catch (e) {
                console.error(e);
            }
        }

        const interval = setInterval(fetchTelemetry, 1000);
        return () => clearInterval(interval);
    }, []);

    // --- Focus Mode / Simulation ---
    // Poll REAL server stats (writes confirmed by DB workers)
    useEffect(() => {
        const checkStats = () => {
            fetch('/api/demo/stats')
                .then(res => res.json())
                .then(data => {
                    // Update the counter with the REAL value from server
                    setSessionWrites(data.total_writes);
                })
                .catch(err => console.error("Stats error:", err));
        };

        const interval = setInterval(checkStats, 1000); // Poll every second
        return () => clearInterval(interval);
    }, []);

    // --- Client-Side Ingestion Logic ---
    const ingestionRef = useRef<boolean>(false);

    // We don't need to poll simulation status anymore, we control it locally!
    // But we DO need to poll "Total Writes" from the backend (or count them locally?)
    // Actually, improved realism: We count successful APIs as writes for the UI.

    useEffect(() => {
        return () => {
            ingestionRef.current = false; // Stop on unmount
        };
    }, []);

    const toggleFocusMode = async () => {
        if (ingestionRef.current) {
            // STOP
            ingestionRef.current = false;
            setIsFocusMode(false);
        } else {
            // START
            ingestionRef.current = true;
            setIsFocusMode(true);
            runIngestionLoop();
        }
    };

    const runIngestionLoop = async () => {
        const userId = "550e8400-e29b-41d4-a716-446655440000";
        const metrics = ["focus_score", "typing_speed", "mouse_velocity", "memory_usage", "cpu_load"];

        // Loop while active
        while (ingestionRef.current) {
            // Create a batch of promises (Parallel Browser Requests)
            const batchSize = 10; // Browser limit per domain is usually 6, but HTTP/2 allows more
            const promises = [];

            for (let i = 0; i < batchSize; i++) {
                // Generate Attributes
                const attributes: Record<string, string> = {};

                // Add base metric + version
                const baseMetric = metrics[Math.floor(Math.random() * metrics.length)];
                attributes[baseMetric] = (Math.random() * 100).toFixed(2);

                // Add variety
                if (Math.random() > 0.5) attributes["gpu_temp"] = "75C";
                if (Math.random() > 0.7) attributes["fan_speed"] = "3000rpm";
                if (Math.random() > 0.8) attributes["error_code"] = "0x" + Math.floor(Math.random() * 1000).toString(16);

                const p = fetch('/api/demo/telemetry/stream', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_id: userId,
                        attributes: attributes,
                        timestamp: new Date().toISOString()
                    })
                }).then(res => {
                    if (res.ok) {
                        // setSessionWrites(prev => prev + 1); // We now poll the server for the REAL count
                    }
                }).catch(e => console.error("Drop packet:", e));

                promises.push(p);
            }

            await Promise.all(promises);

            // Tiny throttle to not crash the browser tab (optional)
            await new Promise(r => setTimeout(r, 50));
        }
    };

    const fillRandomAttributes = () => {
        const type = smartTodoType;
        let attrs: Record<string, string> = {};

        const randomItem = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

        if (type === 'meeting') {
            attrs = {
                "location": randomItem(["Zoom", "Google Meet", "Room 304", "Họp Trực Tiếp"]),
                "duration_min": randomItem(["15", "30", "45", "60", "90"]),
                "organizer": randomItem(["Nguyễn Văn A", "Trần Thị B", "HR Dept", "Tech Lead"]),
                "agenda": randomItem(["Review Sprint", "Design Sync", "1:1", "All Hands"])
            };
        } else if (type === 'iot_trigger') {
            attrs = {
                "device_id": `sensor-${Math.floor(Math.random() * 1000)}`,
                "threshold": `${Math.floor(Math.random() * 50 + 20)}`,
                "location": randomItem(["Kho Hàng A", "Nhà Máy 1", "Sân Thượng", "Tầng Hầm"]),
                "firmware": "v2.1." + Math.floor(Math.random() * 9)
            };
        } else if (type === 'incident') {
            attrs = {
                "severity": randomItem(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
                "impacted_services": randomItem(["Auth", "Payment", "Search", "Frontend"]),
                "on_call": randomItem(["DevOps Team", "Security Team", "Backend Lead"])
            };
        }

        setSmartAttributes(JSON.stringify(attrs));
    };


    // --- Smart Todo (Simulated Form) ---
    const [smartTodoType, setSmartTodoType] = useState("meeting");
    const [smartAttributes, setSmartAttributes] = useState('{"nguoi_tham_gia": "Alice, Bob", "thoi_luong": "30p"}');
    const [recentItems, setRecentItems] = useState<any[]>([]);

    const createSmartTodo = async () => {
        try {
            const newItem = {
                title: `Smart Todo: ${smartTodoType}`,
                type: smartTodoType,
                attributes: JSON.parse(smartAttributes),
                id: crypto.randomUUID().split('-')[0]
            };

            const res = await fetch("/api/demo/todos/smart", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newItem)
            });

            if (res.ok) {
                // Add to recent items for demo visualization
                setRecentItems(prev => [newItem, ...prev].slice(0, 5));
            }
        } catch (e) {
            alert("Error creating todo: " + e);
        }
    }

    // Chart Config
    const chartData = {
        labels: telemetryData.map(d => new Date(d.timestamp).toLocaleTimeString()),
        datasets: [
            {
                label: 'Luồng Dữ Liệu (Ops/sec)',
                data: telemetryData.map(d => parseFloat(d.value)),
                borderColor: '#6366f1', // Indigo 500
                backgroundColor: 'rgba(99, 102, 241, 0.2)',
                tension: 0.4,
                pointRadius: 0, // Cleaner look
                borderWidth: 2,
                fill: true,
            }
        ]
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 0 }, // Disable animation for performance
        plugins: {
            legend: { display: false },
            title: { display: false }
        },
        scales: {
            x: {
                display: false, // Hide x axis labels for cleaner "stream" look
                grid: { display: false }
            },
            y: {
                grid: { color: '#374151' }, // Gray 700 
                ticks: { color: '#9ca3af' } // Gray 400
            }
        }
    };

    return (
        <div className="p-4 space-y-6 max-w-[1600px] mx-auto font-sans">
            {/* Header */}
            <div className="flex items-center justify-between mb-8 bg-black/40 p-4 rounded-2xl border border-gray-800 backdrop-blur-md sticky top-0 z-50">
                <div className="flex items-center gap-4">
                    <div className="bg-indigo-600 p-2 rounded-lg">
                        <span className="text-2xl">🚀</span>
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">Mission Control</h1>
                        <p className="text-xs text-indigo-400 font-bold tracking-widest uppercase">Cassandra Global Scale Demo</p>
                    </div>
                </div>

                <div className="flex gap-4">
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] text-gray-500 font-bold uppercase">Region Status</span>
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${clusterStatus.node_1 === 'online' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                            <span className="text-xs text-gray-300 font-mono">US-East</span>
                            <span className="text-gray-600">|</span>
                            <div className={`w-2 h-2 rounded-full ${clusterStatus.node_2 === 'online' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                            <span className="text-xs text-gray-300 font-mono">EU-West</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

                {/* Left Column: Polymorphic Data (Span 7) */}
                <div className="xl:col-span-7 space-y-6">
                    <div className="bg-gray-900/50 p-1 rounded-2xl border border-gray-800 shadow-2xl overflow-hidden">
                        <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-6 rounded-xl border border-gray-700/50">
                            <div className="mb-6 flex justify-between items-start">
                                <div>
                                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                        🧬 Flexible Data Store
                                    </h2>
                                    <p className="text-sm text-gray-400 mt-1 max-w-lg">
                                        Lưu trữ dữ liệu <strong>đa hình (Polymorphic)</strong>. Thêm trường mới mà không cần sửa schema (NoSQL).
                                    </p>
                                </div>
                                <div className="bg-indigo-900/30 px-3 py-1 rounded text-xs font-mono text-indigo-300 border border-indigo-500/30">
                                    Map&lt;Text, Text&gt;
                                </div>
                            </div>

                            <div className="flex flex-col md:flex-row gap-6">
                                {/* Type Selection */}
                                <div className="w-full md:w-1/3 flex flex-col gap-3">
                                    {[
                                        { id: 'meeting', icon: '📅', label: 'Lịch Họp', color: 'indigo' },
                                        { id: 'iot_trigger', icon: '📡', label: 'Cảm Biến IoT', color: 'emerald' },
                                        { id: 'incident', icon: '🚨', label: 'Sự Cố Hệ Thống', color: 'red' }
                                    ].map((type) => (
                                        <button
                                            key={type.id}
                                            onClick={() => {
                                                setSmartTodoType(type.id);
                                                if (type.id === 'meeting') setSmartAttributes('{"nguoi_tham_gia": "Alice, Bob", "thoi_luong": "30p"}');
                                                if (type.id === 'iot_trigger') setSmartAttributes('{"thiet_bi": "sensor-01", "nguong_canh_bao": "98.6"}');
                                                if (type.id === 'incident') setSmartAttributes('{"muc_do": "nghiem_trong", "nguon_goc": "firewall"}');
                                            }}
                                            className={`p-4 rounded-xl border text-left transition-all ${smartTodoType === type.id
                                                ? `bg-${type.color}-900/20 border-${type.color}-500 ring-1 ring-${type.color}-500/50`
                                                : 'bg-black/20 border-gray-800 hover:bg-gray-800'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className="text-2xl">{type.icon}</span>
                                                <div className={`font-bold text-sm ${smartTodoType === type.id ? 'text-white' : 'text-gray-400'}`}>{type.label}</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>

                                {/* Form */}
                                <div className="w-full md:w-2/3 bg-black/40 p-5 rounded-xl border border-gray-700/50 relative">
                                    <div className="space-y-4">
                                        <div className="bg-gray-800/50 p-2 rounded border border-gray-700">
                                            <span className="text-[10px] text-gray-500 block uppercase font-bold mb-1">Fixed Columns</span>
                                            <div className="flex gap-2">
                                                <span className="bg-gray-700 text-gray-300 px-2 py-0.5 rounded text-xs font-mono">id: UUID</span>
                                                <span className="bg-gray-700 text-gray-300 px-2 py-0.5 rounded text-xs font-mono">type: Text</span>
                                                <span className="bg-gray-700 text-gray-300 px-2 py-0.5 rounded text-xs font-mono">title: Text</span>
                                            </div>
                                        </div>

                                        <div className="absolute -top-2 -right-2 bg-indigo-600 text-white text-[9px] px-2 py-0.5 rounded-full font-bold shadow-lg">
                                            DYNAMIC (NoSQL)
                                        </div>
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-[10px] text-indigo-400 block uppercase font-bold">Attributes (Map&lt;Text, Text&gt;)</span>
                                            <button
                                                onClick={fillRandomAttributes}
                                                className="text-[9px] bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/30 transition-colors"
                                            >
                                                🎲 Random Data
                                            </button>
                                        </div>

                                        <div className="space-y-2">
                                            {Object.entries(JSON.parse(smartAttributes || '{}')).map(([key, value]) => (
                                                <div key={key} className="flex items-center gap-2">
                                                    <span className="w-1/3 text-xs font-mono text-indigo-300 bg-indigo-900/30 px-2 py-1 rounded truncate text-right">{key}:</span>
                                                    <input
                                                        value={value as string}
                                                        onChange={(e) => {
                                                            const current = JSON.parse(smartAttributes);
                                                            current[key] = e.target.value;
                                                            setSmartAttributes(JSON.stringify(current));
                                                        }}
                                                        className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white"
                                                    />
                                                    <button
                                                        onClick={() => {
                                                            const current = JSON.parse(smartAttributes);
                                                            delete current[key];
                                                            setSmartAttributes(JSON.stringify(current));
                                                        }}
                                                        className="text-red-500 hover:text-red-400 text-xs px-1"
                                                    >✕</button>
                                                </div>
                                            ))}

                                            {/* Add New */}
                                            <div className="flex items-center gap-2 pt-2 border-t border-indigo-500/20 mt-2">
                                                <input id="nKey" placeholder="key" className="w-1/3 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white" />
                                                <input id="nVal" placeholder="value" className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white" />
                                                <button
                                                    onClick={() => {
                                                        const k = (document.getElementById('nKey') as HTMLInputElement);
                                                        const v = (document.getElementById('nVal') as HTMLInputElement);
                                                        if (k.value && v.value) {
                                                            const c = JSON.parse(smartAttributes);
                                                            c[k.value] = v.value;
                                                            setSmartAttributes(JSON.stringify(c));
                                                            k.value = ''; v.value = '';
                                                        }
                                                    }}
                                                    className="bg-indigo-600 text-white text-xs px-2 py-1 rounded hover:bg-indigo-500"
                                                >+</button>
                                            </div>
                                        </div>
                                    </div>

                                    <button onClick={createSmartTodo} className="w-full bg-white text-black font-bold py-2 rounded shadow hover:bg-gray-200 transition-colors">
                                        Save Record
                                    </button>
                                </div>
                            </div>
                        </div>

                        {recentItems.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-gray-700">
                                <span className="text-[10px] text-gray-500 uppercase font-bold">Recently Saved</span>
                                <div className="grid grid-cols-1 gap-2 mt-2">
                                    {recentItems.map((item, i) => (
                                        <div key={i} className="flex gap-3 text-xs bg-black/40 p-2 rounded border border-gray-800 font-mono">
                                            <span className={`text-[10px] px-1 rounded uppercase ${item.type === 'meeting' ? 'text-indigo-400 bg-indigo-900/20' : item.type === 'iot_trigger' ? 'text-emerald-400 bg-emerald-900/20' : 'text-red-400 bg-red-900/20'}`}>{item.type}</span>
                                            <span className="text-gray-500 select-none">|</span>
                                            <span className="text-gray-300 truncate">{JSON.stringify(item.attributes)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Right Column: Visual Geo-Replication (Span 5) */}
            <div className="xl:col-span-5 space-y-6">
                <div className="bg-gray-900/50 p-1 rounded-2xl border border-gray-800 shadow-2xl overflow-hidden relative">
                    {/* CSS for Animations */}
                    <style jsx>{`
                            @keyframes flow {
                                0% { left: 10%; opacity: 0; transform: scale(0.5); }
                                10% { opacity: 1; transform: scale(1); }
                                90% { opacity: 1; transform: scale(1); }
                                100% { left: 90%; opacity: 0; transform: scale(0.5); }
                            }
                            .packet {
                                position: absolute;
                                top: 50%;
                                width: 8px;
                                height: 8px;
                                background: #4ade80; /* green-400 */
                                border-radius: 50%;
                                box-shadow: 0 0 10px #4ade80;
                                animation: flow 1s linear forwards;
                                transform: translateY(-50%);
                            }
                            .packet-read {
                                background: #60a5fa; /* blue-400 */
                                box-shadow: 0 0 10px #60a5fa;
                            }
                        `}</style>

                    {/* Traffic Light Effect */}
                    {isFocusMode && (
                        <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent animate-shimmer z-10"></div>
                    )}

                    <div className="bg-gradient-to-br from-gray-900 to-black p-6 rounded-xl border border-gray-700/50">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    🌍 Geo-Replication
                                </h2>
                                <p className="text-sm text-gray-400 mt-1">
                                    Real HTTP Traffic: Client → Node 1 → Node 2
                                </p>
                            </div>
                            <div className={`px-3 py-1 rounded-full text-xs font-bold border ${isFocusMode ? 'bg-indigo-900/50 text-indigo-300 border-indigo-500 animate-pulse' : 'bg-gray-800 text-gray-500 border-gray-700'}`}>
                                {isFocusMode ? 'ACTIVE' : 'IDLE'}
                            </div>
                        </div>

                        {/* Visual Map Area */}
                        <div className="relative h-48 bg-black/40 rounded-xl border border-gray-800 mb-6 overflow-hidden flex items-center justify-between px-12">
                            {/* Connecting Line */}
                            <div className="absolute top-1/2 left-12 right-12 h-0.5 bg-gray-800 -translate-y-1/2"></div>

                            {/* Simulated Packets Container */}
                            <div className="absolute inset-0 pointer-events-none">
                                {/* Packets are spawned via logic below, but strictly visual for now we use CSS animations triggered by key state changes if possible, or just a static representation of "flow" when active */}
                                {isFocusMode && (
                                    <>
                                        <div className="packet" style={{ animationDelay: '0s' }}></div>
                                        <div className="packet" style={{ animationDelay: '0.2s' }}></div>
                                        <div className="packet" style={{ animationDelay: '0.4s' }}></div>
                                        <div className="packet" style={{ animationDelay: '0.6s' }}></div>
                                        <div className="packet" style={{ animationDelay: '0.8s' }}></div>
                                    </>
                                )}
                            </div>

                            {/* Node 1 (US) */}
                            <div className="relative z-10 text-center">
                                <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center border-4 transition-all duration-300 ${isFocusMode ? 'bg-indigo-900/80 border-indigo-500 shadow-[0_0_30px_rgba(99,102,241,0.5)] scale-110' : 'bg-gray-800 border-gray-700'}`}>
                                    <span className="text-2xl">🇺🇸</span>
                                </div>
                                <div className="mt-2 text-xs font-bold text-gray-400">NODE 1 (US)</div>
                                <div className="text-[10px] text-indigo-400 font-mono">WRITER</div>
                            </div>

                            {/* Node 2 (EU) */}
                            <div className="relative z-10 text-center">
                                <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center border-4 transition-all duration-300 ${isFocusMode ? 'bg-emerald-900/80 border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.5)]' : 'bg-gray-800 border-gray-700'}`}>
                                    <span className="text-2xl">🇪🇺</span>
                                </div>
                                <div className="mt-2 text-xs font-bold text-gray-400">NODE 2 (EU)</div>
                                <div className="text-[10px] text-emerald-400 font-mono">REPLICA</div>
                            </div>
                        </div>

                        {/* Metrics Grid */}
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="bg-black/40 p-3 rounded-lg border border-gray-800">
                                <div className="text-[10px] text-gray-500 uppercase font-bold text-center">Total Writes</div>
                                <div className="text-2xl font-black text-white text-center font-mono">
                                    {sessionWrites.toLocaleString()}
                                </div>
                            </div>
                            <div className="bg-black/40 p-3 rounded-lg border border-gray-800">
                                <div className="text-[10px] text-gray-500 uppercase font-bold text-center">Sync Status</div>
                                <div className={`text-xl font-bold text-center font-mono ${isFocusMode ? 'text-emerald-400 animate-pulse' : 'text-gray-600'}`}>
                                    {isFocusMode ? 'TRAFFIC FLOWING ⚡' : 'IDLE'}
                                </div>
                            </div>
                        </div>

                        {/* Controls */}
                        <div className="flex gap-2 mb-6">
                            <button
                                onClick={toggleFocusMode}
                                className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2 ${isFocusMode ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
                            >
                                {isFocusMode ? (
                                    <><span>⏹</span> STOP SIMULATION</>
                                ) : (
                                    <><span>▶</span> START CLIENT TRAFFIC (REAL)</>
                                )}
                            </button>
                        </div>

                        {/* Replication Log (Simplified) */}
                        <div className="border-t border-gray-800 pt-4">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-[10px] text-gray-500 font-bold uppercase">Replication Log (EU-West)</span>
                            </div>
                            <div className="h-32 overflow-y-auto pr-1 space-y-1 scrollbar-thin scrollbar-thumb-gray-800">
                                {telemetryData.slice().reverse().slice(0, 20).map((row: any, i) => (
                                    <div key={i} className="flex justify-between items-center text-[10px] font-mono border-b border-gray-800/30 pb-1 text-gray-400">
                                        <span className="text-emerald-500">✔ SYNCED</span>
                                        <span className="text-gray-500">{new Date(row.timestamp).toLocaleTimeString()}</span>
                                        <div className="text-white text-right truncate w-48 text-[9px] opacity-70">
                                            {/* Render parsed attributes */}
                                            {row.attributes ?
                                                Object.entries(row.attributes).map(([k, v]) => `${k}:${v}`).join(', ')
                                                : 'No Attributes'
                                            }
                                        </div>
                                    </div>
                                ))}
                                {telemetryData.length === 0 && (
                                    <div className="text-center text-gray-600 text-xs py-10">
                                        No data replicated yet...
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            </div>

        </div>
    );
}
