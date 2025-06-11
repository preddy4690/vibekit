import { VibeKit, VibeKitConfig } from "@vibe-kit/sdk";

// Declare process for Node.js environment
declare const process: {
  env: {
    OPENAI_API_KEY?: string;
    E2B_API_KEY?: string;
    [key: string]: string | undefined;
  };
};

// Define Task type locally to avoid import issues
type Task = {
  id: string;
  title: string;
  mode: "code" | "ask";
  repository?: string;
  branch?: string;
  status: "IN_PROGRESS" | "DONE" | "MERGED";
  messages: any[];
};

// Helper function to send updates via HTTP POST to the SSE endpoint
async function sendUpdate(message: any) {
  try {
    // In a real production environment, you'd want to use a proper message queue
    // For now, we'll use a simple HTTP POST to trigger the SSE broadcast
    await fetch('http://localhost:3002/api/temporal/broadcast', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });
  } catch (error) {
    console.error('Failed to send update:', error);
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
  const config: VibeKitConfig = {
    agent: {
      type: "codex",
      model: {
        apiKey: process.env.OPENAI_API_KEY!,
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

  return response;
}

// Activity to publish task status updates
export async function publishTaskStatus(data: {
  taskId: string;
  status: "IN_PROGRESS" | "DONE" | "MERGED";
  sessionId: string;
}): Promise<void> {
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
  await sendUpdate({
    channel: 'tasks',
    topic: 'update',
    data
  });
}