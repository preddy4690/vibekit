"use client";
import { useEffect, useCallback, useRef } from "react";
import { getWorkflowStatus } from "@/app/actions/temporal";
import { useHydratedTaskStore } from "./useHydratedTaskStore";
import { useTaskStore } from "@/stores/tasks";

export function useWorkflowSync(taskId: string) {
  const { updateTask, getTaskById } = useHydratedTaskStore();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const syncWorkflowStatus = useCallback(async () => {
    if (!taskId) return;

    try {
      // Get fresh references to avoid stale closures
      const { getTaskById: getCurrentTaskById, updateTask: getCurrentUpdateTask } = useTaskStore.getState();

      const task = getCurrentTaskById(taskId);
      if (!task) {
        return;
      }

      const workflowStatus = await getWorkflowStatus(taskId);

      switch (workflowStatus.status) {
        case "COMPLETED":
          getCurrentUpdateTask(taskId, {
            status: "DONE",
            statusMessage: undefined, // Clear the "in progress" message
          });
          break;

        case "FAILED":
        case "CANCELLED":
        case "TERMINATED":
        case "TIMED_OUT":
          getCurrentUpdateTask(taskId, {
            status: "DONE", // Mark as done even if failed, so user can retry
            statusMessage: `Workflow ${workflowStatus.status.toLowerCase()}`,
          });
          break;

        case "NOT_FOUND":
          // Workflow doesn't exist, mark as done so user can retry
          getCurrentUpdateTask(taskId, {
            status: "DONE",
            statusMessage: undefined,
          });
          break;

        case "RUNNING":
          // Workflow is still running, keep current status
          // But clear any stale status message
          getCurrentUpdateTask(taskId, {
            status: "IN_PROGRESS",
            statusMessage: "Working on task...",
          });
          break;
      }
    } catch (error) {
      console.error("Error syncing workflow status:", error);
      // On error, assume workflow is not running and allow user to retry
      const { getTaskById: getCurrentTaskById, updateTask: getCurrentUpdateTask } = useTaskStore.getState();
      const task = getCurrentTaskById(taskId);
      if (task?.status === "IN_PROGRESS") {
        getCurrentUpdateTask(taskId, {
          status: "DONE",
          statusMessage: undefined,
        });
      }
    }
  }, [taskId]);

  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Sync workflow status when component mounts
    syncWorkflowStatus();

    // Set up periodic sync for tasks that are IN_PROGRESS
    intervalRef.current = setInterval(() => {
      const { getTaskById: getCurrentTaskById } = useTaskStore.getState();
      const task = getCurrentTaskById(taskId);
      if (task?.status === "IN_PROGRESS") {
        syncWorkflowStatus();
      }
    }, 30000); // Check every 30 seconds

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [taskId]); // Only depend on taskId

  return { syncWorkflowStatus };
}
