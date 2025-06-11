import { proxyActivities, defineQuery, setHandler } from '@temporalio/workflow';
import type * as activities from './activities';

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

// Define workflow state for tracking updates
export interface WorkflowUpdate {
  id: string;
  timestamp: number;
  sequence: number;
  type: 'status' | 'message';
  data: any;
}

export interface WorkflowState {
  taskId: string;
  status: "IN_PROGRESS" | "DONE" | "MERGED";
  updates: WorkflowUpdate[];
  lastSequence: number;
  startTime: number;
}

// Define workflow queries
export const getWorkflowStateQuery = defineQuery<WorkflowState | null>('getWorkflowState');

// Define activity interface
const { generateCode, publishTaskStatus, publishTaskUpdate } = proxyActivities<
  typeof activities
>({
  startToCloseTimeout: '10 minutes',
});

// Main workflow that replaces the Inngest createTask function
export async function createTaskWorkflow(
  task: Task,
  token: string,
  sessionId?: string,
  prompt?: string
): Promise<unknown> {
  // Initialize workflow state
  const workflowState: WorkflowState = {
    taskId: task.id,
    status: 'IN_PROGRESS',
    updates: [],
    lastSequence: 0,
    startTime: Date.now(),
  };

  // Set up query handler to expose workflow state
  setHandler(getWorkflowStateQuery, () => workflowState);

  // Helper function to add update to workflow state
  const addUpdate = (type: 'status' | 'message', data: any): WorkflowUpdate => {
    const update: WorkflowUpdate = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      sequence: ++workflowState.lastSequence,
      type,
      data,
    };
    workflowState.updates.push(update);
    return update;
  };

  // Publish initial status and store in workflow state
  const initialStatusData = {
    taskId: task.id,
    status: 'IN_PROGRESS' as const,
    sessionId: sessionId || '',
  };

  addUpdate('status', initialStatusData);
  await publishTaskStatus(initialStatusData);

  // Generate code using VibeKit
  const result = await generateCode({
    task,
    token,
    sessionId,
    prompt: prompt || task.title,
  });

  // Process result and publish final response
  if (result && typeof result === 'object' && 'message' in result) {
    const messages = (result as { message: any[] }).message;

    // Find the final assistant message
    const finalMessage = messages.find(msg =>
      msg.role === 'assistant' &&
      msg.content &&
      Array.isArray(msg.content) &&
      msg.content.some((c: any) => c.type === 'input_text')
    );

    if (finalMessage) {
      // Store and publish the final response as a message
      const finalMessageData = {
        taskId: task.id,
        message: {
          type: 'message',
          role: 'assistant',
          status: 'completed',
          content: [{
            text: finalMessage.content.find((c: any) => c.type === 'input_text')?.text || 'Task completed'
          }]
        }
      };

      addUpdate('message', finalMessageData);
      await publishTaskUpdate(finalMessageData);
    }

    // Store and publish final status
    const finalStatusData = {
      taskId: task.id,
      status: 'DONE' as const,
      sessionId: sessionId || '',
    };

    workflowState.status = 'DONE';
    addUpdate('status', finalStatusData);
    await publishTaskStatus(finalStatusData);

    return {
      message: messages,
      workflowState: workflowState
    };
  } else {
    // Store and publish final status even when there's no proper result
    const finalStatusData = {
      taskId: task.id,
      status: 'DONE' as const,
      sessionId: sessionId || '',
    };

    workflowState.status = 'DONE';
    addUpdate('status', finalStatusData);
    await publishTaskStatus(finalStatusData);

    return {
      message: result,
      workflowState: workflowState
    };
  }
}

// Query function to get workflow state and updates
export function getWorkflowUpdates(): WorkflowState | null {
  // This will be implemented as a workflow query
  // For now, return null - this will be properly implemented with workflow queries
  return null;
}