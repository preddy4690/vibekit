"use client";
import { useEffect } from "react";
import { useTemporalSubscription } from "@/hooks/useTemporalSubscription";
import { getTemporalSubscriptionToken } from "@/app/actions/temporal";
import { useHydratedTaskStore } from "@/hooks/useHydratedTaskStore";

export default function Container({ children }: { children: React.ReactNode }) {
  const { updateTask, updateTaskWithSequence, getTaskById } = useHydratedTaskStore();
  const { latestData, isRecovering } = useTemporalSubscription({
    refreshToken: getTemporalSubscriptionToken,
    enabled: true,
  });

  useEffect(() => {
    if (latestData?.channel === "tasks" && latestData.topic === "status") {
      // Use sequence-aware update for status changes
      updateTaskWithSequence(
        latestData.data.taskId,
        {
          status: latestData.data.status,
          hasChanges: true,
          sessionId: latestData.data.sessionId,
        },
        latestData.sequence,
        latestData.timestamp
      );
    }

    if (latestData?.channel === "tasks" && latestData.topic === "update") {
      if (latestData.data.message.type === "git") {
        updateTaskWithSequence(
          latestData.data.taskId,
          {
            statusMessage: latestData.data.message.output as string,
          },
          latestData.sequence,
          latestData.timestamp
        );
      }

      if (latestData.data.message.type === "local_shell_call") {
        const task = getTaskById(latestData.data.taskId);
        updateTaskWithSequence(
          latestData.data.taskId,
          {
            statusMessage: `Running command ${(
              latestData.data.message as { action: { command: string[] } }
            ).action.command.join(" ")}`,
            messages: [
              ...(task?.messages || []),
              {
                role: "assistant",
                type: "local_shell_call",
                data: {
                  ...latestData.data.message,
                  id: latestData.data.message.call_id || crypto.randomUUID(),
                },
              },
            ],
          },
          latestData.sequence,
          latestData.timestamp
        );
      }

      if (latestData.data.message.type === "local_shell_call_output") {
        const task = getTaskById(latestData.data.taskId);
        updateTask(latestData.data.taskId, {
          messages: [
            ...(task?.messages || []),
            {
              role: "assistant",
              type: "local_shell_call_output",
              data: {
                ...latestData.data.message,
                id: latestData.data.message.call_id || crypto.randomUUID(),
              },
            },
          ],
        });
      }

      if (
        latestData.data.message.type === "message" &&
        latestData.data.message.status === "completed" &&
        latestData.data.message.role === "assistant"
      ) {
        const task = getTaskById(latestData.data.taskId);

        updateTask(latestData.data.taskId, {
          messages: [
            ...(task?.messages || []),
            {
              role: "assistant",
              type: "message",
              data: {
                ...(latestData.data.message.content as { text: string }[])[0],
                id: crypto.randomUUID(),
              },
            },
          ],
        });
      }
    }
  }, [latestData]);

  return children;
}
