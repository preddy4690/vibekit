"use server";
import { cookies } from "next/headers";
import { getTemporalClient } from "@/lib/temporal";
import { Task } from "@/stores/tasks";

export const createTaskAction = async ({
  task,
  sessionId,
  prompt,
}: {
  task: Task;
  sessionId?: string;
  prompt?: string;
}) => {
  const cookieStore = await cookies();
  const githubToken = cookieStore.get("github_access_token")?.value;

  if (!githubToken) {
    throw new Error("No GitHub token found. Please authenticate first.");
  }

  const client = await getTemporalClient();
  const workflowId = `task-${task.id}`;
  
  try {
    // Try to start a new workflow
    await client.workflow.start('createTaskWorkflow', {
      args: [task, githubToken, sessionId, prompt],
      taskQueue: 'codex-clone',
      workflowId,
    });
  } catch (error: unknown) {
    // If workflow already exists, signal it to continue with the new prompt
    if (error instanceof Error && (error.message?.includes('already exists') || error.message?.includes('WorkflowExecutionAlreadyStarted'))) {
      console.log(`[CREATE_TASK] Workflow ${workflowId} already exists, signaling continuation`);
      // For now, we'll restart the workflow - in a production app you might want to signal instead
      // This is a limitation of the current implementation
      console.log(`[CREATE_TASK] Restarting workflow to continue conversation`);
      
      // Try to terminate the existing workflow first
      try {
        const handle = client.workflow.getHandle(workflowId);
        await handle.terminate('Restarting for continuation');
        console.log(`[CREATE_TASK] Terminated existing workflow`);
      } catch (terminateError) {
        console.log(`[CREATE_TASK] Could not terminate existing workflow:`, terminateError);
      }
      
      // Wait a bit before restarting
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Start new workflow with updated task
      await client.workflow.start('createTaskWorkflow', {
        args: [task, githubToken, sessionId, prompt],
        taskQueue: 'codex-clone',
        workflowId,
      });
    } else {
      throw error;
    }
  }
};

// This function will be used by the client to subscribe to real-time updates
export async function getTemporalSubscriptionToken(): Promise<string> {
  // In a real implementation, you might generate a token for authentication
  // For this example, we'll return a simple string
  return "temporal-subscription-token";
}

// Function to recover missed updates for a task
export async function recoverTaskUpdates(taskId: string): Promise<{
  success: boolean;
  recoveredUpdates: number;
  error?: string;
}> {
  try {
    const response = await fetch(`/api/temporal/recovery/${taskId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        connectionId: crypto.randomUUID(), // Generate a temporary connection ID
        lastSequence: 0, // Start from beginning for full recovery
        lastTimestamp: 0,
      }),
    });

    const result = await response.json();

    if (result.success) {
      return {
        success: true,
        recoveredUpdates: result.recoveredUpdates || 0,
      };
    } else {
      return {
        success: false,
        recoveredUpdates: 0,
        error: result.error || 'Unknown error during recovery',
      };
    }
  } catch (error) {
    console.error('Error recovering task updates:', error);
    return {
      success: false,
      recoveredUpdates: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Function to get the current workflow status
export async function getWorkflowStatus(taskId: string): Promise<{
  status: "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED" | "TERMINATED" | "TIMED_OUT" | "NOT_FOUND";
  result?: any;
}> {
  try {
    const client = await getTemporalClient();
    const workflowId = `task-${taskId}`;

    // Get workflow handle
    const handle = client.workflow.getHandle(workflowId);

    // Try to get the workflow description to check if it exists and its status
    try {
      const description = await handle.describe();

      if (description.status.name === 'COMPLETED') {
        // Try to get the result if completed
        try {
          const result = await handle.result();
          return { status: 'COMPLETED', result };
        } catch {
          return { status: 'COMPLETED' };
        }
      } else if (description.status.name === 'RUNNING') {
        return { status: 'RUNNING' };
      } else if (description.status.name === 'FAILED') {
        return { status: 'FAILED' };
      } else if (description.status.name === 'CANCELLED') {
        return { status: 'CANCELLED' };
      } else if (description.status.name === 'TERMINATED') {
        return { status: 'TERMINATED' };
      } else if (description.status.name === 'TIMED_OUT') {
        return { status: 'TIMED_OUT' };
      } else {
        return { status: 'RUNNING' };
      }
    } catch (error: any) {
      if (error.message?.includes('not found') || error.code === 'NOT_FOUND') {
        return { status: 'NOT_FOUND' };
      }
      throw error;
    }
  } catch (error) {
    console.error('Error getting workflow status:', error);
    return { status: 'NOT_FOUND' };
  }
}