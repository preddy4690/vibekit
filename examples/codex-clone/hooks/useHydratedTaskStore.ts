"use client";
import { useEffect, useState } from "react";
import { useTaskStore, Task } from "@/stores/tasks";

// Hook to safely use the task store after hydration
export function useHydratedTaskStore() {
  const [isHydrated, setIsHydrated] = useState(false);
  const store = useTaskStore();

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Always call the store hooks, but return safe defaults until hydrated
  const safeGetTaskById = (id: string): Task | undefined => {
    if (!isHydrated) return undefined;
    return store.getTaskById(id);
  };

  const safeGetActiveTasks = (): Task[] => {
    if (!isHydrated) return [];
    return store.getActiveTasks();
  };

  const safeGetArchivedTasks = (): Task[] => {
    if (!isHydrated) return [];
    return store.getArchivedTasks();
  };

  const safeGetTasks = (): Task[] => {
    if (!isHydrated) return [];
    return store.getTasks();
  };

  const safeGetTasksByStatus = (status: any): Task[] => {
    if (!isHydrated) return [];
    return store.getTasksByStatus(status);
  };

  const safeGetTasksBySessionId = (sessionId: string): Task[] => {
    if (!isHydrated) return [];
    return store.getTasksBySessionId(sessionId);
  };

  return {
    ...store,
    tasks: isHydrated ? store.tasks : [],
    getTaskById: safeGetTaskById,
    getActiveTasks: safeGetActiveTasks,
    getArchivedTasks: safeGetArchivedTasks,
    getTasks: safeGetTasks,
    getTasksByStatus: safeGetTasksByStatus,
    getTasksBySessionId: safeGetTasksBySessionId,
    // Expose the new sequence-aware methods
    updateTaskWithSequence: store.updateTaskWithSequence,
    applyBatchUpdates: store.applyBatchUpdates,
  };
}
