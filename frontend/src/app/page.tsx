'use client';

import { useState } from 'react';
import { useTodos } from '@/hooks/useTodos';
import { useTheme } from '@/components/ThemeProvider';
import AddTodo from '@/components/AddTodo';
import SearchComparison from '@/components/SearchComparison';
import DatabaseViewer from '@/components/DatabaseViewer';
import TopologyViewer from '@/components/TopologyViewer';
import PerformanceViewer from '@/components/PerformanceViewer';
import MissionControl from '@/components/MissionControl';
import KanbanBoard from '@/components/KanbanBoard';
import MessagesDemo from '@/components/MessagesDemo';
import ClusterDemo from '@/components/ClusterDemo';
import ScaleDemo from '@/components/ScaleDemo';

type Page = 'todos' | 'search' | 'database' | 'topology' | 'performance' | 'mission_control' | 'messages' | 'cluster' | 'scale';

// ... (Icons)
const SunIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
  </svg>
);
const MoonIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);
const MonitorIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8m-4-4v4" />
  </svg>
);

const RocketIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.1 2.1 0 0 0-2.91-.09z" />
    <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
    <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
  </svg>
);

export default function Home() {
  const { data: todos = [], isLoading, error } = useTodos();
  const { theme, setTheme } = useTheme();
  // Set default page to mission_control for the demo "Wow" factor
  const [page, setPage] = useState<Page>('mission_control');

  // ... (Stats calculation remains same)
  const stats = {
    total: todos.length,
    active: todos.filter(t => t.status === 'todo' || t.status === 'in_progress' || (!t.status && !t.is_completed)).length,
    completed: todos.filter(t => t.status === 'completed' || (!t.status && t.is_completed)).length,
  };

  return (
    <div className="dashboard">
      {/* Sidebar */}
      <aside className="sidebar">
        {/* ... (Logo and Stats remain same) */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: 'var(--text-1)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ background: 'var(--accent)', color: 'white', width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>✓</span>
            Todo Dashboard
          </h1>
          <p className="mono" style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4, paddingLeft: 36 }}>v1.0 · cassandra</p>
        </div>

        {/* Stats */}
        <div className="card" style={{ padding: 14, marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, textAlign: 'center' }}>
            <div>
              <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>{stats.total}</p>
              <p style={{ fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Total</p>
            </div>
            <div>
              <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--info)', margin: 0 }}>{stats.active}</p>
              <p style={{ fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Active</p>
            </div>
            <div>
              <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--success)', margin: 0 }}>{stats.completed}</p>
              <p style={{ fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Done</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <p style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '0 14px', marginBottom: 4 }}>Navigation</p>
          <button className={`nav-item ${page === 'mission_control' ? 'active' : ''}`} onClick={() => setPage('mission_control')}>
            <RocketIcon />
            Mission Control
          </button>
          <button className={`nav-item ${page === 'todos' ? 'active' : ''}`} onClick={() => setPage('todos')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
            Todos
            <span className="badge badge-accent" style={{ marginLeft: 'auto' }}>{stats.total}</span>
          </button>
          <button className={`nav-item ${page === 'search' ? 'active' : ''}`} onClick={() => setPage('search')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            Vector Search
          </button>
          <button className={`nav-item ${page === 'database' ? 'active' : ''}`} onClick={() => setPage('database')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
            </svg>
            Database
          </button>
          <button className={`nav-item ${page === 'topology' ? 'active' : ''}`} onClick={() => setPage('topology')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="8" rx="2" ry="2" /><rect x="2" y="14" width="20" height="8" rx="2" ry="2" /><line x1="6" y1="6" x2="6.01" y2="6" /><line x1="6" y1="18" x2="6.01" y2="18" />
            </svg>
            Topology
          </button>
          <button className={`nav-item ${page === 'performance' ? 'active' : ''}`} onClick={() => setPage('performance')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
            Performance
          </button>
          
          <p style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '0 14px', margin: '16px 0 4px', borderTop: '1px solid var(--border)', paddingTop: 16 }}>New Demos</p>
          
          <button className={`nav-item ${page === 'messages' ? 'active' : ''}`} onClick={() => setPage('messages')}>
            <span style={{ fontSize: 16, marginRight: 6 }}>💬</span>
            Messages (NoSQL)
          </button>
          <button className={`nav-item ${page === 'cluster' ? 'active' : ''}`} onClick={() => setPage('cluster')}>
            <span style={{ fontSize: 16, marginRight: 6 }}>🔴</span>
            Cluster HA
          </button>
          <button className={`nav-item ${page === 'scale' ? 'active' : ''}`} onClick={() => setPage('scale')}>
            <span style={{ fontSize: 16, marginRight: 6 }}>📈</span>
            Scale &amp; Benchmark
          </button>
        </nav>

        {/* Tech Stack */}
        <div style={{ marginTop: 24 }}>
          <p style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '0 14px', marginBottom: 8 }}>Stack</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '0 14px' }}>
            {['Go / Gin', 'Next.js 16', 'Cassandra SAI', 'OpenRouter AI'].map(t => (
              <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--success)', flexShrink: 0 }} />
                <span className="mono" style={{ fontSize: 10, color: 'var(--text-3)' }}>{t}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Theme Toggle */}
        <div style={{ marginTop: 'auto', paddingTop: 24 }}>
          <p style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '0 4px', marginBottom: 8 }}>Theme</p>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className={`theme-btn ${theme === 'light' ? 'active' : ''}`} onClick={() => setTheme('light')} title="Light">
              <SunIcon />
            </button>
            <button className={`theme-btn ${theme === 'dark' ? 'active' : ''}`} onClick={() => setTheme('dark')} title="Dark">
              <MoonIcon />
            </button>
            <button className={`theme-btn ${theme === 'system' ? 'active' : ''}`} onClick={() => setTheme('system')} title="System">
              <MonitorIcon />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {page === 'mission_control' && (
          <div className="fade-in">
            <MissionControl />
          </div>
        )}
        {page === 'todos' && (
          <div className="fade-in">
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: 'var(--text-1)' }}>Tasks</h2>
              <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>Manage your tasks with AI-powered generation</p>
            </div>

            {/* Add Todo */}
            <div style={{ marginBottom: 20 }}>
              <AddTodo />
            </div>

            {/* Kanban Board */}
            {isLoading ? (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <div className="spinner" style={{ margin: '0 auto 8px', width: 24, height: 24 }} />
                <p style={{ fontSize: 12, color: 'var(--text-3)' }}>Loading...</p>
              </div>
            ) : error ? (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <p style={{ fontSize: 12, color: 'var(--danger)' }}>❌ Cannot connect to backend</p>
                <p className="mono" style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4 }}>cd backend && go run main.go</p>
              </div>
            ) : (
              <KanbanBoard todos={todos} />
            )}
          </div>
        )}

        {page === 'search' && (
          <div className="fade-in">
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: 'var(--text-1)' }}>Text vs Vector Search</h2>
              <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>Compare traditional text matching with semantic vector search (Cassandra SAI)</p>
            </div>
            <SearchComparison />
          </div>
        )}

        {page === 'database' && (
          <div className="fade-in">
            <DatabaseViewer />
          </div>
        )}

        {page === 'topology' && (
          <div className="fade-in">
            <TopologyViewer />
          </div>
        )}

        {page === 'performance' && (
          <div className="fade-in">
            <PerformanceViewer />
          </div>
        )}

        {page === 'messages' && (
          <div className="fade-in">
            <MessagesDemo />
          </div>
        )}

        {page === 'cluster' && (
          <div className="fade-in">
            <ClusterDemo />
          </div>
        )}

        {page === 'scale' && (
          <div className="fade-in">
            <ScaleDemo />
          </div>
        )}
      </main>
    </div>
  );
}
