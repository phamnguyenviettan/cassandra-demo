'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchTodos, createTodo, updateTodoStatus, deleteTodo, type Todo } from '@/lib/api';

export function useTodos() {
    return useQuery<Todo[]>({
        queryKey: ['todos'],
        queryFn: fetchTodos,
        refetchInterval: 10000,
    });
}

export function useCreateTodo() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: { title: string; description?: string; priority: string }) =>
            createTodo(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['todos'] });
        },
    });
}

export function useUpdateTodoStatus() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, status }: { id: string; status: string }) => updateTodoStatus(id, status),
        // Optimistic update
        onMutate: async ({ id, status }) => {
            await queryClient.cancelQueries({ queryKey: ['todos'] });
            const previousTodos = queryClient.getQueryData<Todo[]>(['todos']);

            queryClient.setQueryData<Todo[]>(['todos'], (old) =>
                old?.map((todo) =>
                    todo.id === id ? { ...todo, status: status as any, is_completed: status === 'completed' } : todo
                )
            );

            return { previousTodos };
        },
        onError: (_err, _vars, context) => {
            queryClient.setQueryData(['todos'], context?.previousTodos);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['todos'] });
        },
    });
}

export function useDeleteTodo() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: deleteTodo,
        // Optimistic update
        onMutate: async (todoId: string) => {
            await queryClient.cancelQueries({ queryKey: ['todos'] });
            const previousTodos = queryClient.getQueryData<Todo[]>(['todos']);

            queryClient.setQueryData<Todo[]>(['todos'], (old) =>
                old?.filter((todo) => todo.id !== todoId)
            );

            return { previousTodos };
        },
        onError: (_err, _todoId, context) => {
            queryClient.setQueryData(['todos'], context?.previousTodos);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['todos'] });
        },
    });
}
