// stores/useTaskStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

type TaskStatus = "IN_PROGRESS" | "DONE" | "MERGED";

export interface Task {
  id: string;
  title: string;
  description: string;
  messages: {
    role: "user" | "assistant";
    type: string;
    data: Record<string, unknown>;
  }[];
  status: TaskStatus;
  branch: string;
  sessionId: string;
  repository: string;
  createdAt: string;
  updatedAt: string;
  statusMessage?: string;
  isArchived: boolean;
  mode: "code" | "ask";
  hasChanges: boolean;
  lastSequence?: number;
  lastTimestamp?: number;
}

interface TaskStore {
  tasks: Task[];
  addTask: (
    task: Omit<Task, "id" | "createdAt" | "updatedAt" | "isArchived">
  ) => Task;
  updateTask: (
    id: string,
    updates: Partial<Omit<Task, "id" | "createdAt">>
  ) => void;
  updateTaskWithSequence: (
    id: string,
    updates: Partial<Task>,
    sequence?: number,
    timestamp?: number
  ) => void;
  applyBatchUpdates: (
    updates: Array<{
      taskId: string;
      updates: Partial<Task>;
      sequence?: number;
      timestamp?: number
    }>
  ) => void;
  setTasks: (tasks: Task[]) => void;
  removeTask: (id: string) => void;
  archiveTask: (id: string) => void;
  unarchiveTask: (id: string) => void;
  clear: () => void;
  getTasks: () => Task[];
  getActiveTasks: () => Task[];
  getArchivedTasks: () => Task[];
  getTaskById: (id: string) => Task | undefined;
  getTasksByStatus: (status: TaskStatus) => Task[];
  getTasksBySessionId: (sessionId: string) => Task[];
}

export const useTaskStore = create<TaskStore>()(
  persist(
    (set, get) => ({
      tasks: [],
      addTask: (task) => {
        const now = new Date().toISOString();
        const id = crypto.randomUUID();
        const newTask = {
          ...task,
          id,
          createdAt: now,
          updatedAt: now,
          isArchived: false,
        };
        set((state) => ({
          tasks: [...state.tasks, newTask],
        }));
        return newTask;
      },
      updateTask: (id, updates) => {
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id
              ? { ...task, ...updates, updatedAt: new Date().toISOString() }
              : task
          ),
        }));
      },
      updateTaskWithSequence: (id, updates, sequence, timestamp) => {
        set((state) => ({
          tasks: state.tasks.map((task) => {
            if (task.id === id) {
              // Only apply update if sequence is newer or not tracked
              if (!sequence || !task.lastSequence || sequence > task.lastSequence) {
                return {
                  ...task,
                  ...updates,
                  updatedAt: new Date().toISOString(),
                  lastSequence: sequence || task.lastSequence,
                  lastTimestamp: timestamp || task.lastTimestamp,
                };
              }
            }
            return task;
          }),
        }));
      },
      applyBatchUpdates: (updates) => {
        set((state) => ({
          tasks: state.tasks.map((task) => {
            const taskUpdate = updates.find(u => u.taskId === task.id);
            if (taskUpdate) {
              // Only apply update if sequence is newer or not tracked
              if (!taskUpdate.sequence || !task.lastSequence || taskUpdate.sequence > task.lastSequence) {
                return {
                  ...task,
                  ...taskUpdate.updates,
                  updatedAt: new Date().toISOString(),
                  lastSequence: taskUpdate.sequence || task.lastSequence,
                  lastTimestamp: taskUpdate.timestamp || task.lastTimestamp,
                };
              }
            }
            return task;
          }),
        }));
      },
      setTasks: (tasks) => set(() => ({ tasks })),
      removeTask: (id) => {
        set((state) => ({
          tasks: state.tasks.filter((task) => task.id !== id),
        }));
      },
      archiveTask: (id) => {
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id
              ? {
                  ...task,
                  isArchived: true,
                  updatedAt: new Date().toISOString(),
                }
              : task
          ),
        }));
      },
      unarchiveTask: (id) => {
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id
              ? {
                  ...task,
                  isArchived: false,
                  updatedAt: new Date().toISOString(),
                }
              : task
          ),
        }));
      },
      clear: () => set({ tasks: [] }),
      getTasks: () => get().tasks,
      getActiveTasks: () =>
        get()
          .tasks.filter((task) => !task.isArchived)
          .reverse(),
      getArchivedTasks: () => get().tasks.filter((task) => task.isArchived),
      getTaskById: (id) => get().tasks.find((task) => task.id === id),
      getTasksByStatus: (status) =>
        get().tasks.filter((task) => task.status === status),
      getTasksBySessionId: (sessionId) =>
        get().tasks.filter((task) => task.sessionId === sessionId),
    }),
    {
      name: "task-store", // key in localStorage
      // Optionally, customize storage or partialize which fields to persist
      // storage: () => sessionStorage, // for sessionStorage instead
    }
  )
);
