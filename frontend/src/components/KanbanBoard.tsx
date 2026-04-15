'use client';

import { useState } from 'react';
import { Todo } from '@/lib/api';
import { useUpdateTodoStatus } from '@/hooks/useTodos';
import TaskCard from './TaskCard';
import HistoryModal from './HistoryModal';

interface KanbanBoardProps {
    todos: Todo[];
}

export default function KanbanBoard({ todos }: KanbanBoardProps) {
    const updateMutation = useUpdateTodoStatus();
    const [hiddenVisible, setHiddenVisible] = useState(false);
    const [historyTodo, setHistoryTodo] = useState<Todo | null>(null);

    const columns = [
        { id: 'todo', title: 'Next up', class: 'column-todo' },
        { id: 'in_progress', title: 'In Progress', class: 'column-progress' },
        { id: 'completed', title: 'Complete', class: 'column-complete' },
    ];

    if (hiddenVisible) {
        columns.push({ id: 'hidden', title: 'Hidden', class: 'column-hidden' });
    }

    const onDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const onDrop = (e: React.DragEvent, status: string) => {
        e.preventDefault();
        const todoId = e.dataTransfer.getData('todoId');
        if (todoId) {
            updateMutation.mutate({ id: todoId, status });
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                    className={`btn ${hiddenVisible ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setHiddenVisible(!hiddenVisible)}
                    style={{ fontSize: 12, padding: '6px 12px' }}
                >
                    {hiddenVisible ? '🙈 Hide "Hidden" Column' : '👁️ Show Hidden Tasks'}
                </button>
            </div>

            <div className="kanban-board">
                {columns.map((col) => (
                    <div
                        key={col.id}
                        className={`kanban-column ${col.class}`}
                        onDragOver={onDragOver}
                        onDrop={(e) => onDrop(e, col.id)}
                    >
                        <div className="kanban-column-header">
                            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>
                                {col.title}
                            </h3>
                            <span className="badge badge-accent">
                                {todos.filter(t => (t.status || (t.is_completed ? 'completed' : 'todo')) === col.id).length}
                            </span>
                        </div>
                        <div className="kanban-tasks">
                            {todos
                                .filter(t => (t.status || (t.is_completed ? 'completed' : 'todo')) === col.id)
                                .map(todo => (
                                    <TaskCard
                                        key={todo.id}
                                        todo={todo}
                                        onViewHistory={(t) => setHistoryTodo(t)}
                                    />
                                ))
                            }
                        </div>
                    </div>
                ))}
            </div>

            {historyTodo && (
                <HistoryModal
                    todoId={historyTodo.id}
                    todoTitle={historyTodo.title}
                    onClose={() => setHistoryTodo(null)}
                />
            )}
        </div>
    );
}
