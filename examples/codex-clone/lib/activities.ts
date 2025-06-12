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
  // Use environment variable or default to port 3002 (codex-clone app port)
  const broadcastUrl = process.env.BROADCAST_URL || 'http://localhost:3002/api/temporal/broadcast';

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
    // Use the model specified in the task, default to claude
    const modelType = task.model || "claude";
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

    const response = await vibekit.generateCode({
      prompt: prompt || task.title,
      mode: task.mode,
      callbacks: {
        onUpdate(message) {
        try {
          // Try to parse as JSON first
          const parsedMessage = JSON.parse(message);

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
            publishTaskUpdate({
              taskId: task.id,
              message: {
                type: 'message',
                role: 'assistant',
                status: 'completed',
                content: parsedMessage.content,
                ...parsedMessage
              },
            });
          } else {
            // Pass through other message types
            publishTaskUpdate({
              taskId: task.id,
              message: parsedMessage,
            });
          }
        } catch {
          // If JSON parsing fails, treat as plain text
          publishTaskUpdate({
            taskId: task.id,
            message: {
              type: 'text',
              content: message,
            },
          });
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