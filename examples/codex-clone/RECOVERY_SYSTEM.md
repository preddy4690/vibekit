# Temporal Workflow State Recovery System

This document describes the implementation of seamless state recovery for SSE (Server-Sent Events) interruptions using Temporal workflows.

## Overview

The recovery system ensures that when SSE connections are interrupted (due to network issues, browser refresh, etc.), users can recover all missed incremental updates and continue with the same user experience as if the connection was never lost.

## Architecture

### 1. Workflow State Management

**Enhanced Workflow State (`lib/workflows.ts`)**
- Each workflow maintains a complete history of all updates in `WorkflowState`
- Updates are stored with sequence numbers and timestamps
- Workflow queries allow real-time access to state from running workflows

```typescript
interface WorkflowUpdate {
  id: string;
  timestamp: number;
  sequence: number;
  type: 'status' | 'message';
  data: any;
}

interface WorkflowState {
  taskId: string;
  status: "IN_PROGRESS" | "DONE" | "MERGED";
  updates: WorkflowUpdate[];
  lastSequence: number;
  startTime: number;
}
```

### 2. Recovery API Endpoints

**Recovery Endpoint (`/api/temporal/recovery/[taskId]`)**
- `GET`: Retrieves missed updates since a given sequence/timestamp
- `POST`: Triggers recovery and broadcasts missed updates via SSE

**Latest State Endpoint (`/api/temporal/recovery/[taskId]/latest`)**
- `GET`: Retrieves complete workflow state and all updates

### 3. Enhanced SSE Connection Management

**Updated `useTemporalSubscription` Hook**
- Tracks last received sequence and timestamp
- Automatically triggers recovery on reconnection
- Provides recovery status and manual recovery function

### 4. Sequence-Aware Task Store

**Enhanced Task Store (`stores/tasks.ts`)**
- New methods: `updateTaskWithSequence()` and `applyBatchUpdates()`
- Prevents duplicate updates by checking sequence numbers
- Maintains update order and consistency

## How Recovery Works

### 1. Normal Operation
1. Temporal workflow generates updates with sequence numbers
2. Updates are broadcast via SSE to connected clients
3. Clients track the last received sequence number
4. UI updates incrementally as updates arrive

### 2. Connection Interruption
1. SSE connection is lost (network issue, page refresh, etc.)
2. User continues to see last known state
3. Workflow continues running and storing updates in Temporal

### 3. Recovery Process
1. SSE connection is re-established
2. Client automatically requests missed updates since last sequence
3. Recovery API queries Temporal workflow for missed updates
4. Missed updates are broadcast incrementally to maintain UX consistency
5. UI seamlessly continues from where it left off

### 4. Manual Recovery
1. User clicks the enhanced "Refresh" button
2. System triggers both workflow status sync and update recovery
3. All missed updates are applied in chronological order
4. UI shows recovery progress with visual indicators

## Key Features

### Seamless UX Consistency
- Recovered updates are applied incrementally, not as a bulk dump
- Same visual experience whether updates are real-time or recovered
- Visual indicators show recovery progress

### Duplicate Prevention
- Sequence numbers prevent duplicate updates
- Idempotent operations ensure consistency
- Out-of-order updates are handled gracefully

### Resilient Architecture
- Works with both running and completed workflows
- Graceful fallbacks for unsupported scenarios
- Error handling and retry mechanisms

### Performance Optimized
- Only fetches updates since last known sequence
- Minimal data transfer for recovery
- Efficient workflow queries for running workflows

## Usage Examples

### Automatic Recovery
```typescript
const { latestData, isRecovering, recoverMissedUpdates } = useTemporalSubscription({
  refreshToken: getTemporalSubscriptionToken,
  enabled: true,
  taskId: taskId, // Enables automatic recovery
});
```

### Manual Recovery
```typescript
// Enhanced refresh button triggers both sync and recovery
const handleRefresh = async () => {
  await syncWorkflowStatus(); // Sync workflow status
  await recoverMissedUpdates(); // Recover missed updates
};
```

### Sequence-Aware Updates
```typescript
// Updates with sequence tracking
updateTaskWithSequence(
  taskId, 
  { status: 'DONE' },
  sequenceNumber,
  timestamp
);
```

## API Reference

### Recovery Endpoints

#### GET `/api/temporal/recovery/[taskId]`
Query parameters:
- `sinceSequence`: Get updates after this sequence number
- `sinceTimestamp`: Get updates after this timestamp

#### POST `/api/temporal/recovery/[taskId]`
Body:
```json
{
  "connectionId": "uuid",
  "lastSequence": 0,
  "lastTimestamp": 0
}
```

#### GET `/api/temporal/recovery/[taskId]/latest`
Returns complete workflow state and all updates.

### Workflow Queries

#### `getWorkflowState`
Returns current `WorkflowState` for running workflows.

## Testing

Run the recovery test suite:
```bash
npx tsx scripts/test-recovery.ts
```

This tests:
- Temporal connection
- Workflow creation and queries
- Recovery API endpoints
- State consistency

## Benefits

1. **Zero Data Loss**: No updates are lost during connection interruptions
2. **Consistent UX**: Same experience whether real-time or recovered
3. **Automatic Recovery**: No user intervention required for most scenarios
4. **Manual Override**: Refresh button for explicit recovery
5. **Performance**: Efficient incremental recovery
6. **Reliability**: Resilient to various failure scenarios

## Future Enhancements

1. **Selective Recovery**: Recover only specific types of updates
2. **Compression**: Compress large update batches
3. **Caching**: Cache recent updates for faster recovery
4. **Metrics**: Track recovery performance and success rates
5. **Offline Support**: Queue updates for offline scenarios
