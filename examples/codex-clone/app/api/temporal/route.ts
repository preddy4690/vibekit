import { NextRequest, NextResponse } from 'next/server';
import { getTemporalClient } from '@/lib/temporal';

export const maxDuration = 800;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { task, token, sessionId, prompt } = body;
    
    const client = await getTemporalClient();
    
    // Start the workflow
    const handle = await client.workflow.start('createTaskWorkflow', {
      args: [task, token, sessionId, prompt],
      taskQueue: 'codex-clone',
      workflowId: `task-${task.id}`,
    });
    
    return NextResponse.json({ 
      workflowId: handle.workflowId,
      message: 'Workflow started successfully' 
    });
  } catch (error) {
    console.error('Error starting workflow:', error);
    return NextResponse.json(
      { error: 'Failed to start workflow' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const workflowId = searchParams.get('workflowId');
  
  if (!workflowId) {
    return NextResponse.json(
      { error: 'Missing workflowId parameter' },
      { status: 400 }
    );
  }
  
  try {
    const client = await getTemporalClient();
    const handle = client.workflow.getHandle(workflowId);
    const status = await handle.describe();
    
    return NextResponse.json({ status });
  } catch (error) {
    console.error('Error fetching workflow:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workflow status' },
      { status: 500 }
    );
  }
}