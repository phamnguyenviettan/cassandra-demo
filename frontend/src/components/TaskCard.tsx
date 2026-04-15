'use client';

import { Todo } from '@/lib/api';
import { useDeleteTodo } from '@/hooks/useTodos';

interface TaskCardProps {
    todo: Todo;
    onViewHistory: (todo: Todo) => void;
}

export default function TaskCard({ todo, onViewHistory }: TaskCardProps) {
    const deleteMutation = useDeleteTodo();

    const onDragStart = (e: React.DragEvent) => {
        e.dataTransfer.setData('todoId', todo.id);
        e.dataTransfer.effectAllowed = 'move';
        (e.target as HTMLElement).classList.add('dragging');
    };

    const onDragEnd = (e: React.DragEvent) => {
        (e.target as HTMLElement).classList.remove('dragging');
    };

    return (
        <div
            className="task-card"
            draggable
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <span className={`badge badge-${todo.priority.toLowerCase()}`}>
                    {todo.priority}
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                    <button
                        onClick={() => onViewHistory(todo)}
                        className="btn-ghost"
                        style={{ padding: 4, borderRadius: 4 }}
                        title="History"
                    >
                        🕒
                    </button>
                    <button
                        onClick={() => deleteMutation.mutate(todo.id)}
                        className="btn-ghost"
                        style={{ padding: 4, borderRadius: 4, color: 'var(--danger)' }}
                        title="Delete"
                    >
                        🗑️
                    </button>
                </div>
            </div>

            <h4 style={{ margin: '0 0 4px 0', fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>
                {todo.title}
            </h4>

            {todo.description && (
                <p style={{ margin: 0, fontSize: 11, color: 'var(--text-3)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {todo.description}
                </p>
            )}

            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="mono" style={{ fontSize: 9, color: 'var(--text-4)' }}>
                    {new Date(todo.created_at).toLocaleDateString()}
                </span>
                <button
                    onClick={() => {
                        navigator.clipboard.writeText(todo.id);
                        alert('Copied ID!');
                    }}
                    style={{ fontSize: 9, background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0 }}
                >
                    ID: {todo.id.slice(0, 4)}...
                </button>
            </div>
        </div>
    );
}
