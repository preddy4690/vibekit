import { NextRequest, NextResponse } from 'next/server';
import { getTemporalClient } from '@/lib/temporal';
import { WorkflowState } from '@/lib/workflows';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const resolvedParams = await params;
    const client = await getTemporalClient();
    const workflowId = `task-${resolvedParams.taskId}`;
    
    try {
      // Get workflow handle
      const handle = client.workflow.getHandle(workflowId);
      
      // Check if workflow exists and get its status
      const description = await handle.describe();
      
      if (description.status.name === 'COMPLETED' || description.status.name === 'FAILED') {
        // For completed workflows, get the final result
        try {
          const result = await handle.result();
          if (result && typeof result === 'object' && 'workflowState' in result) {
            const workflowState = result.workflowState as WorkflowState;
            
            return NextResponse.json({
              success: true,
              taskId: resolvedParams.taskId,
              workflowStatus: description.status.name,
              currentStatus: workflowState.status,
              allUpdates: workflowState.updates,
              totalUpdates: workflowState.updates.length,
              lastSequence: workflowState.lastSequence,
              startTime: workflowState.startTime,
              completedAt: description.closeTime,
            });
          }
        } catch (resultError) {
          console.error('Error getting workflow result:', resultError);
        }
      }
      
      // For running workflows, use workflow queries
      if (description.status.name === 'RUNNING') {
        try {
          const workflowState = await handle.query('getWorkflowState');
          if (workflowState) {
            return NextResponse.json({
              success: true,
              taskId: resolvedParams.taskId,
              workflowStatus: description.status.name,
              currentStatus: workflowState.status,
              allUpdates: workflowState.updates,
              totalUpdates: workflowState.updates.length,
              lastSequence: workflowState.lastSequence,
              startTime: workflowState.startTime,
            });
          }
        } catch (queryError) {
          console.error('Error querying running workflow:', queryError);
        }
      }

      // Fallback for workflows that don't support queries
      return NextResponse.json({
        success: true,
        taskId: resolvedParams.taskId,
        workflowStatus: description.status.name,
        currentStatus: 'IN_PROGRESS',
        allUpdates: [],
        totalUpdates: 0,
        lastSequence: 0,
        startTime: description.startTime,
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
    console.error('Error in latest state API:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to retrieve latest workflow state',
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
