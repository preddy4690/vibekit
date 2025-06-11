import { NextRequest, NextResponse } from 'next/server';
import { getTemporalClient } from '@/lib/temporal';
import { WorkflowState } from '@/lib/workflows';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const sinceSequence = parseInt(searchParams.get('sinceSequence') || '0');
    const sinceTimestamp = parseInt(searchParams.get('sinceTimestamp') || '0');

    const resolvedParams = await params;
    const client = await getTemporalClient();
    const workflowId = `task-${resolvedParams.taskId}`;
    
    try {
      // Get workflow handle
      const handle = client.workflow.getHandle(workflowId);
      
      // Check if workflow exists and get its status
      const description = await handle.describe();
      
      if (description.status.name === 'COMPLETED' || description.status.name === 'FAILED') {
        // For completed workflows, try to get the result which contains the final state
        try {
          const result = await handle.result();
          if (result && typeof result === 'object' && 'workflowState' in result) {
            const workflowState = result.workflowState as WorkflowState;
            
            // Filter updates based on sequence or timestamp
            const filteredUpdates = workflowState.updates.filter(update => {
              if (sinceSequence > 0) {
                return update.sequence > sinceSequence;
              }
              if (sinceTimestamp > 0) {
                return update.timestamp > sinceTimestamp;
              }
              return true;
            });
            
            return NextResponse.json({
              success: true,
              taskId: resolvedParams.taskId,
              workflowStatus: description.status.name,
              updates: filteredUpdates,
              totalUpdates: workflowState.updates.length,
              lastSequence: workflowState.lastSequence,
              currentStatus: workflowState.status,
            });
          }
        } catch (resultError) {
          console.error('Error getting workflow result:', resultError);
        }
      }
      
      // For running workflows, use workflow queries to get current state
      if (description.status.name === 'RUNNING') {
        try {
          const workflowState = await handle.query('getWorkflowState');
          if (workflowState) {
            // Filter updates based on sequence or timestamp
            const filteredUpdates = workflowState.updates.filter((update: any) => {
              if (sinceSequence > 0) {
                return update.sequence > sinceSequence;
              }
              if (sinceTimestamp > 0) {
                return update.timestamp > sinceTimestamp;
              }
              return true;
            });

            return NextResponse.json({
              success: true,
              taskId: resolvedParams.taskId,
              workflowStatus: description.status.name,
              updates: filteredUpdates,
              totalUpdates: workflowState.updates.length,
              lastSequence: workflowState.lastSequence,
              currentStatus: workflowState.status,
            });
          }
        } catch (queryError) {
          console.error('Error querying running workflow:', queryError);
        }
      }

      // Fallback for workflows that don't support queries or other states
      return NextResponse.json({
        success: true,
        taskId: resolvedParams.taskId,
        workflowStatus: description.status.name,
        updates: [],
        totalUpdates: 0,
        lastSequence: 0,
        currentStatus: 'IN_PROGRESS',
        message: 'Workflow state not available for query.',
      });
      
    } catch (workflowError: any) {
      if (workflowError.message?.includes('not found') || workflowError.code === 'NOT_FOUND') {
        return NextResponse.json({
          success: false,
          error: 'Workflow not found',
          taskId: resolvedParams.taskId,
        }, { status: 404 });
      }
      throw workflowError;
    }
    
  } catch (error) {
    console.error('Error in recovery API:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to retrieve workflow updates',
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

// POST endpoint to manually trigger recovery for a specific task
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const resolvedParams = await params;
    const body = await request.json();
    const { connectionId, lastSequence = 0, lastTimestamp = 0 } = body;

    // Get the latest updates using the GET logic
    const recoveryResponse = await GET(request, { params });
    const recoveryData = await recoveryResponse.json();
    
    if (recoveryData.success && recoveryData.updates.length > 0) {
      // Broadcast the missed updates to the specific connection or all connections
      const { broadcastMessage } = await import('@/lib/sse-broadcast');
      
      // Send each update individually to maintain the incremental experience
      for (const update of recoveryData.updates) {
        await new Promise(resolve => setTimeout(resolve, 100)); // Small delay between updates
        
        if (update.type === 'status') {
          broadcastMessage({
            channel: 'tasks',
            topic: 'status',
            data: update.data,
            recovery: true,
            sequence: update.sequence,
            timestamp: update.timestamp,
          });
        } else if (update.type === 'message') {
          broadcastMessage({
            channel: 'tasks',
            topic: 'update',
            data: update.data,
            recovery: true,
            sequence: update.sequence,
            timestamp: update.timestamp,
          });
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      taskId: resolvedParams.taskId,
      recoveredUpdates: recoveryData.updates?.length || 0,
      message: 'Recovery completed',
    });
    
  } catch (error) {
    console.error('Error in recovery POST:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to trigger recovery',
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
