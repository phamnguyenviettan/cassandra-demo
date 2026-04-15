'use client';

import { useState } from 'react';
import { useCreateTodo } from '@/hooks/useTodos';
import { generateTask } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';

export default function AddTodo() {
    const [title, setTitle] = useState('');
    const [priority, setPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
    const [aiPrompt, setAiPrompt] = useState('');
    const [showAI, setShowAI] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiMsg, setAiMsg] = useState('');

    const createMutation = useCreateTodo();
    const queryClient = useQueryClient();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return;
        createMutation.mutate({ title: title.trim(), priority }, { onSuccess: () => setTitle('') });
    };

    const handleAI = async () => {
        if (!aiPrompt.trim()) return;
        setAiLoading(true); setAiMsg('');
        try {
            const r = await generateTask(aiPrompt);
            setAiMsg(`✓ Created: "${r.todo.title}"`);
            setAiPrompt('');
            queryClient.invalidateQueries({ queryKey: ['todos'] });
        } catch { setAiMsg('✗ Failed to generate'); }
        finally { setAiLoading(false); }
    };

    return (
        <div>
            {/* Add form */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8 }}>
                <input
                    className="input"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Add a new task..."
                    style={{ flex: 1 }}
                />
                <select
                    className="input"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as 'Low' | 'Medium' | 'High')}
                    style={{ width: 100 }}
                >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                </select>
                <button className="btn btn-primary" type="submit" disabled={!title.trim() || createMutation.isPending}>
                    {createMutation.isPending ? <span className="spinner" /> : 'Add'}
                </button>
            </form>

            {/* AI Toggle */}
            <button
                onClick={() => setShowAI(!showAI)}
                style={{ marginTop: 8, fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                </svg>
                {showAI ? 'Hide AI' : 'Generate with AI'}
            </button>

            {/* AI Panel */}
            {showAI && (
                <div className="card fade-in" style={{ marginTop: 8, padding: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)' }} />
                        <span className="mono" style={{ fontSize: 10, color: 'var(--text-3)' }}>openai/gpt-oss-20b:free via OpenRouter</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <input
                            className="input"
                            value={aiPrompt}
                            onChange={(e) => setAiPrompt(e.target.value)}
                            placeholder="Describe the task you want AI to create..."
                            style={{ flex: 1 }}
                            onKeyDown={(e) => e.key === 'Enter' && handleAI()}
                        />
                        <button className="btn btn-primary" onClick={handleAI} disabled={!aiPrompt.trim() || aiLoading}>
                            {aiLoading ? <span className="spinner" /> : '✨ Generate'}
                        </button>
                    </div>
                    {aiMsg && <p style={{ fontSize: 11, marginTop: 6, color: aiMsg.startsWith('✓') ? 'var(--success)' : 'var(--danger)' }}>{aiMsg}</p>}
                </div>
            )}
        </div>
    );
}
