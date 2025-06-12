import { VibeKit, VibeKitConfig } from "@vibe-kit/sdk";

// Declare process for Node.js environment
declare const process: {
  env: {
    OPENAI_API_KEY?: string;
    ANTHROPIC_API_KEY?: string;
    E2B_API_KEY?: string;
    BROADCAST_URL?: string;
    [key: string]: string | undefined;
  };
};

// Define Task type locally to avoid import issues
type Task = {
  id: string;
  title: string;
  mode: "code" | "ask";
  model?: "claude" | "codex"; // Add model selection
  repository?: string;
  branch?: string;
  status: "IN_PROGRESS" | "DONE" | "MERGED";
  messages: any[];
};

// Helper function to send updates via HTTP POST to the SSE endpoint
async function sendUpdate(message: any) {
  // Use environment variable or default to current port (3003)
  const broadcastUrl = process.env.BROADCAST_URL || 'http://localhost:3003/api/temporal/broadcast';

  try {
    console.log(`[BROADCAST] Sending update to ${broadcastUrl}:`, JSON.stringify(message, null, 2));

    // In a real production environment, you'd want to use a proper message queue
    // For now, we'll use a simple HTTP POST to trigger the SSE broadcast
    const response = await fetch(broadcastUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
      // Add timeout to prevent hanging
      signal: AbortSignal.timeout(10000), // Increased timeout to 10 seconds
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Broadcast failed with status: ${response.status}, body: ${errorText}`);
    }

    console.log(`[BROADCAST] Successfully sent update to ${broadcastUrl}`);
  } catch (error) {
    console.error(`[BROADCAST] Failed to send update to ${broadcastUrl}:`, error);

    // Log additional details for debugging
    if (error instanceof TypeError && error.message.includes('fetch failed')) {
      console.error(`[BROADCAST] Network error - is the Next.js app running on the correct port?`);
    }

    // Don't throw the error to prevent workflow failure due to broadcast issues
    // The workflow should continue even if broadcasts fail
  }
}

// Activity to generate code using VibeKit
export async function generateCode({
  task,
  token,
  sessionId,
  prompt,
}: {
  task: Task;
  token: string;
  sessionId?: string;
  prompt?: string;
}): Promise<unknown> {
  console.log(`[GENERATE_CODE] Starting code generation for task ${task.id} with model: ${task.model || 'claude'}`);

  try {
    // Use the model specified in the task, default to codex (OpenAI)
    const modelType = task.model || "codex";
    const apiKey = modelType === "claude"
      ? process.env.ANTHROPIC_API_KEY!
      : process.env.OPENAI_API_KEY!;

    const config: VibeKitConfig = {
      agent: {
        type: modelType,
        model: {
          apiKey,
        },
      },
      environment: {
        e2b: {
          apiKey: process.env.E2B_API_KEY!,
        },
      },
      github: {
        token,
        repository: task.repository || "",
      },
    };

    const vibekit = new VibeKit(config);

    if (sessionId) {
      await vibekit.setSession(sessionId);
    }

    // Build conversation history from task messages
    const conversationMessages = task.messages
      .filter(msg => msg.role === 'user' || msg.role === 'assistant')
      .filter(msg => msg.type === 'message')
      .map(msg => ({
        role: msg.role,
        content: (msg.data?.text as string) || ''
      }));

    console.log(`[GENERATE_CODE] Task has ${task.messages.length} total messages`);
    console.log(`[GENERATE_CODE] Filtered conversation messages (${conversationMessages.length}):`, conversationMessages);

    // Add the current prompt as the latest user message if provided
    if (prompt && conversationMessages.length > 0) {
      conversationMessages.push({
        role: 'user' as const,
        content: prompt
      });
      console.log(`[GENERATE_CODE] Added current prompt to conversation history`);
    }

    const response = await vibekit.generateCode({
      prompt: prompt || task.title,
      mode: task.mode,
      // Pass conversation history to maintain context
      history: conversationMessages.length > 0 ? conversationMessages : undefined,
      callbacks: {
        onUpdate(message) {
        console.log(`[GENERATE_CODE] Raw message from ${modelType}:`, message);

        try {
          // Try to parse as JSON first
          let parsedMessage;
          try {
            parsedMessage = JSON.parse(message);
          } catch (parseError) {
            // If direct parsing fails, try to extract JSON from the message
            console.log(`[GENERATE_CODE] Direct JSON parse failed, trying to extract JSON from message`);
            const jsonMatch = message.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              parsedMessage = JSON.parse(jsonMatch[0]);
            } else {
              throw parseError;
            }
          }
          console.log(`[GENERATE_CODE] Parsed message from ${modelType}:`, parsedMessage);

          // Handle Claude's nested format where shell calls are in stdout
          let hasClaudeShellCommands = false;
          if (parsedMessage.type === 'end' && parsedMessage.output && modelType === 'claude') {
            try {
              const outputData = JSON.parse(parsedMessage.output);
              console.log(`[GENERATE_CODE] Claude output data:`, outputData);

              if (outputData.stdout) {
                // Parse each line of stdout as separate JSON messages
                const lines = outputData.stdout.split('\n').filter((line: string) => line.trim());
                console.log(`[GENERATE_CODE] Claude stdout lines (${lines.length}):`, lines);

                lines.forEach((line: string, index: number) => {
                  try {
                    const lineData = JSON.parse(line);
                    console.log(`[GENERATE_CODE] Claude line ${index}:`, lineData);
                    console.log(`[GENERATE_CODE] Line type: ${lineData.type}, has content: ${!!lineData.message?.content}`);

                    // Handle assistant messages with tool_use (shell commands)
                    if (lineData.type === 'assistant' && lineData.message?.content) {
                      lineData.message.content.forEach((contentItem: any) => {
                        if (contentItem.type === 'tool_use') {
                          console.log(`[GENERATE_CODE] Found tool_use:`, contentItem);
                          hasClaudeShellCommands = true;

                          // Map different tool types to shell commands
                          let command = '';
                          let description = '';

                          if (contentItem.name === 'LS') {
                            command = `ls -la ${contentItem.input.path || '.'}`;
                            description = `List files in ${contentItem.input.path || 'current directory'}`;
                          } else if (contentItem.name === 'Bash') {
                            command = contentItem.input.command;
                            description = contentItem.input.description || command;
                          } else {
                            command = `${contentItem.name.toLowerCase()} ${JSON.stringify(contentItem.input)}`;
                            description = `Execute ${contentItem.name} tool`;
                          }

                          publishTaskUpdate({
                            taskId: task.id,
                            message: {
                              type: 'local_shell_call',
                              status: 'completed',
                              action: {
                                command: ['bash', '-c', command],
                                description: description
                              },
                              call_id: contentItem.id,
                              id: contentItem.id
                            },
                          });
                        }
                      });
                    }

                    // Handle user messages with tool_result (shell command output)
                    else if (lineData.type === 'user' && lineData.message?.content) {
                      lineData.message.content.forEach((contentItem: any) => {
                        if (contentItem.type === 'tool_result') {
                          console.log(`[GENERATE_CODE] Found tool_result:`, contentItem);

                          publishTaskUpdate({
                            taskId: task.id,
                            message: {
                              type: 'local_shell_call_output',
                              call_id: contentItem.tool_use_id,
                              output: JSON.stringify({
                                output: contentItem.content,
                                metadata: { exit_code: contentItem.is_error ? 1 : 0 }
                              })
                            },
                          });
                        }
                      });
                    }
                  } catch (lineParseError) {
                    console.log(`[GENERATE_CODE] Failed to parse line ${index}:`, lineParseError);
                  }
                });
              }
            } catch (outputParseError) {
              console.log(`[GENERATE_CODE] Failed to parse Claude output:`, outputParseError);
            }
          }

          // Format the message according to the expected UI types
          if (parsedMessage.type === 'local_shell_call') {
            // Shell command started
            publishTaskUpdate({
              taskId: task.id,
              message: {
                type: 'local_shell_call',
                status: 'completed',
                action: parsedMessage.action,
                call_id: parsedMessage.id || parsedMessage.call_id,
                ...parsedMessage
              },
            });
          } else if (parsedMessage.type === 'local_shell_call_output') {
            // Shell command output
            publishTaskUpdate({
              taskId: task.id,
              message: {
                type: 'local_shell_call_output',
                call_id: parsedMessage.call_id,
                output: parsedMessage.output,
                ...parsedMessage
              },
            });
          } else if (parsedMessage.type === 'git') {
            // Git operations
            publishTaskUpdate({
              taskId: task.id,
              message: {
                type: 'git',
                output: parsedMessage.output || parsedMessage.message,
                ...parsedMessage
              },
            });
          } else if (parsedMessage.type === 'message' && parsedMessage.role === 'assistant') {
            // Final AI response
            // Extract text from content array if it exists
            let text = '';
            if (Array.isArray(parsedMessage.content)) {
              const textContent = parsedMessage.content.find((c: any) => c.type === 'text' || c.type === 'input_text');
              text = textContent?.text || '';
            } else if (typeof parsedMessage.content === 'string') {
              text = parsedMessage.content;
            }
            
            publishTaskUpdate({
              taskId: task.id,
              message: {
                type: 'message',
                role: 'assistant',
                status: 'completed',
                data: {
                  text: text
                }
              },
            });
          } else if (!hasClaudeShellCommands) {
            // Only send text message if we didn't find Claude shell commands
            publishTaskUpdate({
              taskId: task.id,
              message: {
                type: 'text',
                content: message,
              },
            });
          }
        } catch (parseError) {
          // If JSON parsing fails, treat as plain text
          console.log(`[GENERATE_CODE] Failed to parse JSON from ${modelType}, treating as text:`, message);
          console.log(`[GENERATE_CODE] Parse error:`, parseError);

          // For Claude, try to extract shell commands from the text message
          let hasClaudeShellCommandsInCatch = false;
          if (modelType === 'claude' && message.includes('"type":"end"')) {
            try {
              // Extract the JSON from the text message
              const jsonMatch = message.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const endMessage = JSON.parse(jsonMatch[0]);
                if (endMessage.type === 'end' && endMessage.output) {
                  const outputData = JSON.parse(endMessage.output);
                  if (outputData.stdout) {
                    // Parse each line of stdout as separate JSON messages
                    const lines = outputData.stdout.split('\n').filter((line: string) => line.trim());
                    console.log(`[GENERATE_CODE] Claude stdout lines count: ${lines.length}`);
                    lines.forEach((line: string) => {
                      try {
                        const lineData = JSON.parse(line);
                        console.log(`[GENERATE_CODE] Claude line data:`, lineData);
                        if (lineData.type === 'assistant' && lineData.message?.content) {
                          // Look for tool_use in the content
                          lineData.message.content.forEach((contentItem: any) => {
                            if (contentItem.type === 'tool_use') {
                              console.log(`[GENERATE_CODE] Found tool_use in catch:`, contentItem);
                              hasClaudeShellCommandsInCatch = true;

                              // Map different tool types to shell commands
                              let command = '';
                              let description = '';

                              if (contentItem.name === 'LS') {
                                command = `ls -la ${contentItem.input.path || '.'}`;
                                description = `List files in ${contentItem.input.path || 'current directory'}`;
                              } else if (contentItem.name === 'Bash') {
                                command = contentItem.input.command;
                                description = contentItem.input.description || command;
                              } else {
                                command = `${contentItem.name.toLowerCase()} ${JSON.stringify(contentItem.input)}`;
                                description = `Execute ${contentItem.name} tool`;
                              }

                              publishTaskUpdate({
                                taskId: task.id,
                                message: {
                                  type: 'local_shell_call',
                                  status: 'completed',
                                  action: {
                                    command: ['bash', '-c', command],
                                    description: description
                                  },
                                  call_id: contentItem.id,
                                  id: contentItem.id
                                },
                              });
                            }
                          });
                        } else if (lineData.type === 'user' && lineData.message?.content) {
                          // Look for tool_result in the content
                          lineData.message.content.forEach((contentItem: any) => {
                            if (contentItem.type === 'tool_result') {
                              publishTaskUpdate({
                                taskId: task.id,
                                message: {
                                  type: 'local_shell_call_output',
                                  call_id: contentItem.tool_use_id,
                                  output: JSON.stringify({
                                    output: contentItem.content,
                                    metadata: { exit_code: contentItem.is_error ? 1 : 0 }
                                  })
                                },
                              });
                            }
                          });
                        }
                      } catch (lineParseError) {
                        // Skip lines that aren't valid JSON
                      }
                    });
                  }
                }
              }
            } catch (extractError) {
              console.log(`[GENERATE_CODE] Failed to extract Claude shell commands:`, extractError);
            }
          }

          // Only send text message if we didn't find Claude shell commands
          if (!hasClaudeShellCommandsInCatch) {
            publishTaskUpdate({
              taskId: task.id,
              message: {
                type: 'text',
                content: message,
              },
            });
          }
        }
      },
    },
  });

    console.log(`[GENERATE_CODE] Successfully completed code generation for task ${task.id}`);
    return response;

  } catch (error) {
    console.error(`[GENERATE_CODE] Failed to generate code for task ${task.id}:`, error);

    // Broadcast error to UI
    try {
      await publishTaskUpdate({
        taskId: task.id,
        message: {
          type: 'error',
          content: error instanceof Error ? error.message : String(error),
          timestamp: Date.now(),
        },
      });
    } catch (broadcastError) {
      console.error(`[GENERATE_CODE] Failed to broadcast error:`, broadcastError);
    }

    // Check for specific E2B connection timeout errors
    if (error instanceof Error && error.message.includes('Connect Timeout Error')) {
      console.error(`[GENERATE_CODE] E2B connection timeout - this may be a temporary network issue`);
      throw new Error(`Failed to generate code: E2B connection timeout. Please try again.`);
    }

    // Check for fetch failed errors (usually network related)
    if (error instanceof Error && error.message.includes('fetch failed')) {
      console.error(`[GENERATE_CODE] Network error during code generation`);
      throw new Error(`Failed to generate code: Network error. Please check your connection and try again.`);
    }

    // Check for API credit/quota errors
    if (error instanceof Error && (
      error.message.includes('insufficient_quota') ||
      error.message.includes('quota_exceeded') ||
      error.message.includes('billing') ||
      error.message.includes('credits')
    )) {
      console.error(`[GENERATE_CODE] API quota/billing error`);
      throw new Error(`Failed to generate code: API quota exceeded or billing issue. Please check your API credits.`);
    }

    // Check for authentication errors
    if (error instanceof Error && (
      error.message.includes('unauthorized') ||
      error.message.includes('invalid_api_key') ||
      error.message.includes('authentication')
    )) {
      console.error(`[GENERATE_CODE] API authentication error`);
      throw new Error(`Failed to generate code: Invalid API key or authentication failed.`);
    }

    // Re-throw the original error with additional context
    throw new Error(`Failed to generate code: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Activity to publish task status updates
export async function publishTaskStatus(data: {
  taskId: string;
  status: "IN_PROGRESS" | "DONE" | "MERGED";
  sessionId: string;
}): Promise<void> {
  console.log(`[PUBLISH_STATUS] Publishing status update for task ${data.taskId}: ${data.status}`);
  await sendUpdate({
    channel: 'tasks',
    topic: 'status',
    data
  });
}

// Activity to publish task updates
export async function publishTaskUpdate(data: {
  taskId: string;
  message: Record<string, unknown>;
}): Promise<void> {
  console.log(`[PUBLISH_UPDATE] Publishing update for task ${data.taskId}:`, data.message.type || 'unknown');
  await sendUpdate({
    channel: 'tasks',
    topic: 'update',
    data
  });
}