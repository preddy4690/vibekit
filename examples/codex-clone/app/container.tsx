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

      // Debug Claude-specific messages
      if (latestData.data?.message?.type === "text") {
        console.log('[CONTAINER] Text message:', latestData.data.message.content);
      }
      if (latestData.data?.message?.type === "local_shell_call") {
        console.log('[CONTAINER] Direct shell call message:', latestData.data.message);
      }
      if (latestData.data?.message?.type === "local_shell_call_output") {
        console.log('[CONTAINER] Direct shell output message:', latestData.data.message);
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

        // For Claude, add a working indicator if this is the first message and it's a Claude model
        const currentMessages = task?.messages || [];
        const hasWorkingIndicator = currentMessages.some(msg => msg.type === "claude_working");
        const isClaudeModel = claudeMessage.model?.includes('claude');

        if (!hasWorkingIndicator && isClaudeModel && claudeMessage.content) {
          updateTask(latestData.data.taskId, {
            messages: [
              ...currentMessages,
              {
                role: "assistant",
                type: "claude_working",
                data: {
                  text: "🤖 Claude is analyzing your request and executing commands...",
                  id: crypto.randomUUID(),
                },
              },
            ],
          });
        }

        // When Claude sends a final response, remove the working indicator and add the actual message
        if (claudeMessage.content && Array.isArray(claudeMessage.content)) {
          const hasTextContent = claudeMessage.content.some((item: any) => item.type === "text");

          if (hasTextContent) {
            // Remove the working indicator and add the final response
            const messagesWithoutWorking = currentMessages.filter(msg => msg.type !== "claude_working");

            claudeMessage.content.forEach((contentItem: any) => {
              if (contentItem.type === "text" && contentItem.text) {
                updateTask(latestData.data.taskId, {
                  messages: [
                    ...messagesWithoutWorking,
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
            });
            return; // Exit early to avoid duplicate processing
          }
        }

        if (claudeMessage.content && Array.isArray(claudeMessage.content)) {
          claudeMessage.content.forEach((contentItem: any) => {
            // Handle text content
            if (contentItem.type === "text" && contentItem.text) {
              let textContent = contentItem.text;

              // Check if the text content contains embedded tool_result JSON
              try {
                const toolResultMatch = textContent.match(/\{"tool_use_id":"([^"]+)","type":"tool_result","content":"([^"]+)"\}/);
                if (toolResultMatch) {
                  const toolUseId = toolResultMatch[1];
                  const toolResultContent = toolResultMatch[2].replace(/\\n/g, '\n').replace(/\\"/g, '"');

                  console.log('[CONTAINER] Found embedded tool_result in text');
                  console.log('[CONTAINER] Tool result call_id:', toolUseId);
                  console.log('[CONTAINER] Tool result content preview:', toolResultContent.substring(0, 200) + '...');

                  // Add the tool result as a separate message
                  updateTask(latestData.data.taskId, {
                    messages: [
                      ...(task?.messages || []),
                      {
                        role: "user",
                        type: "local_shell_call_output",
                        data: {
                          call_id: toolUseId,
                          output: toolResultContent,
                          id: crypto.randomUUID(),
                        },
                      },
                    ],
                  });

                  // Remove the tool_result JSON from the text content
                  textContent = textContent.replace(toolResultMatch[0], '').trim();
                }
              } catch (error) {
                console.log('[CONTAINER] Error parsing embedded tool_result:', error);
              }

              // Only add the text message if there's remaining content after tool_result extraction
              if (textContent && textContent.length > 0) {
                updateTask(latestData.data.taskId, {
                  messages: [
                    ...(task?.messages || []),
                    {
                      role: "assistant",
                      type: "message",
                      data: {
                        text: textContent,
                        id: claudeMessage.id || crypto.randomUUID(),
                      },
                    },
                  ],
                });
              }
            }

            // Handle tool use (shell commands) - Claude format
            if (contentItem.type === "tool_use") {
              const toolUse = contentItem;
              console.log('[CONTAINER] Processing Claude tool_use:', toolUse);
              console.log('[CONTAINER] Tool use call_id:', toolUse.id);
              console.log('[CONTAINER] Tool use name:', toolUse.name);

              // Claude uses different tool names and input formats
              let command = [];
              let description = "";

              if (toolUse.name === "LS" && toolUse.input) {
                // Claude's LS tool format
                const path = toolUse.input.path || '.';
                description = `List files in ${path === '.' ? 'current directory' : path}`;
                command = ['bash', '-c', `ls -la ${path}`];
              } else if (toolUse.name === "Task" && toolUse.input) {
                // Claude's Task tool format
                description = toolUse.input.description || toolUse.input.prompt || "";
                command = toolUse.input.command ? [toolUse.input.command] : [];
              } else if (toolUse.name === "Bash" && toolUse.input) {
                // Standard Bash tool format
                description = toolUse.input.description || "";
                command = toolUse.input.command ? ['bash', '-c', toolUse.input.command] : [];
              } else {
                // Generic tool format
                description = toolUse.input?.description || toolUse.input?.prompt || `${toolUse.name} tool call`;
                command = toolUse.input?.command ? [toolUse.input.command] : [];
              }

              console.log('[CONTAINER] Mapped command:', command);
              console.log('[CONTAINER] Mapped description:', description);

              updateTask(latestData.data.taskId, {
                messages: [
                  ...(task?.messages || []),
                  {
                    role: "assistant",
                    type: "local_shell_call",
                    data: {
                      call_id: toolUse.id,
                      action: {
                        command: command,
                        description: description,
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

        console.log('[CONTAINER] Processing user message:', userMessage);
        console.log('[CONTAINER] User message content type:', typeof userMessage.content);
        console.log('[CONTAINER] User message content is array:', Array.isArray(userMessage.content));

        // Check if this is a tool result
        if (userMessage.content && Array.isArray(userMessage.content)) {
          console.log('[CONTAINER] Processing user message content array:', userMessage.content);
          userMessage.content.forEach((contentItem: any, index: number) => {
            console.log(`[CONTAINER] Content item ${index}:`, contentItem);
            if (contentItem.type === "tool_result") {
              console.log('[CONTAINER] Processing Claude tool_result:', contentItem);
              console.log('[CONTAINER] Tool result call_id:', contentItem.tool_use_id);
              console.log('[CONTAINER] Tool result content:', contentItem.content);

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
