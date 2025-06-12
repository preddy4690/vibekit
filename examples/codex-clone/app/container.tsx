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
    if (latestData) {
      console.log('[CONTAINER] Received SSE message:', JSON.stringify(latestData, null, 2));

      // Debug specific message types
      if (latestData.data?.message?.type === "assistant") {
        console.log('[CONTAINER] Assistant message content:', latestData.data.message.message?.content);
      }
      if (latestData.data?.message?.type === "user") {
        console.log('[CONTAINER] User message content:', latestData.data.message.content);
      }
    }

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
      // Handle direct shell call messages (from VibeKit SDK)
      if (latestData.data.message.type === "local_shell_call") {
        const task = getTaskById(latestData.data.taskId);
        console.log('[CONTAINER] Processing direct local_shell_call:', latestData.data.message);

        updateTask(latestData.data.taskId, {
          messages: [
            ...(task?.messages || []),
            {
              role: "assistant",
              type: "local_shell_call",
              data: {
                ...latestData.data.message,
                id: latestData.data.message.call_id || latestData.data.message.id || crypto.randomUUID(),
              },
            },
          ],
        });
      }

      // Handle direct shell call output messages (from VibeKit SDK)
      if (latestData.data.message.type === "local_shell_call_output") {
        const task = getTaskById(latestData.data.taskId);
        console.log('[CONTAINER] Processing direct local_shell_call_output:', latestData.data.message);

        updateTask(latestData.data.taskId, {
          messages: [
            ...(task?.messages || []),
            {
              role: "user",
              type: "local_shell_call_output",
              data: {
                ...latestData.data.message,
                id: latestData.data.message.id || crypto.randomUUID(),
              },
            },
          ],
        });
      }

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

      // Handle Claude assistant messages
      if (latestData.data.message.type === "assistant" && latestData.data.message.message) {
        const task = getTaskById(latestData.data.taskId);
        const claudeMessage = latestData.data.message.message;

        if (claudeMessage.content && Array.isArray(claudeMessage.content)) {
          claudeMessage.content.forEach((contentItem: any) => {
            // Handle text content
            if (contentItem.type === "text" && contentItem.text) {
              updateTask(latestData.data.taskId, {
                messages: [
                  ...(task?.messages || []),
                  {
                    role: "assistant",
                    type: "message",
                    data: {
                      text: contentItem.text,
                      id: claudeMessage.id || crypto.randomUUID(),
                    },
                  },
                ],
              });
            }

            // Handle tool use (shell commands) - Claude format
            if (contentItem.type === "tool_use") {
              const toolUse = contentItem;
              console.log('[CONTAINER] Processing Claude tool_use:', toolUse);
              updateTask(latestData.data.taskId, {
                messages: [
                  ...(task?.messages || []),
                  {
                    role: "assistant",
                    type: "local_shell_call",
                    data: {
                      call_id: toolUse.id,
                      action: {
                        command: toolUse.input?.command ? [toolUse.input.command] : [],
                        description: toolUse.input?.description || "",
                      },
                      tool_name: toolUse.name,
                      id: toolUse.id,
                    },
                  },
                ],
              });
            }
          });
        }
      }

      // Handle legacy message format (for backward compatibility)
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

      // Handle system messages (like initialization)
      if (latestData.data.message.type === "system") {
        const task = getTaskById(latestData.data.taskId);

        updateTask(latestData.data.taskId, {
          messages: [
            ...(task?.messages || []),
            {
              role: "system",
              type: "system",
              data: {
                ...latestData.data.message,
                id: crypto.randomUUID(),
              },
            },
          ],
        });
      }

      // Handle user messages (like tool results)
      if (latestData.data.message.type === "user") {
        const task = getTaskById(latestData.data.taskId);
        const userMessage = latestData.data.message;

        // Check if this is a tool result
        if (userMessage.content && Array.isArray(userMessage.content)) {
          userMessage.content.forEach((contentItem: any) => {
            if (contentItem.type === "tool_result") {
              updateTask(latestData.data.taskId, {
                messages: [
                  ...(task?.messages || []),
                  {
                    role: "user",
                    type: "local_shell_call_output",
                    data: {
                      call_id: contentItem.tool_use_id,
                      output: contentItem.content || "",
                      id: crypto.randomUUID(),
                    },
                  },
                ],
              });
            } else {
              // Handle regular user messages
              updateTask(latestData.data.taskId, {
                messages: [
                  ...(task?.messages || []),
                  {
                    role: "user",
                    type: "user",
                    data: {
                      ...contentItem,
                      id: crypto.randomUUID(),
                    },
                  },
                ],
              });
            }
          });
        } else {
          // Handle legacy user message format
          updateTask(latestData.data.taskId, {
            messages: [
              ...(task?.messages || []),
              {
                role: "user",
                type: "user",
                data: {
                  ...userMessage,
                  id: crypto.randomUUID(),
                },
              },
            ],
          });
        }
      }

      // Handle error messages
      if (latestData.data.message.type === "error") {
        const task = getTaskById(latestData.data.taskId);

        updateTask(latestData.data.taskId, {
          status: "DONE", // Mark as done so user can retry
          statusMessage: `Error: ${latestData.data.message.content}`,
          messages: [
            ...(task?.messages || []),
            {
              role: "assistant",
              type: "error",
              data: {
                ...latestData.data.message,
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
