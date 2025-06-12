"use client";
import { useState, useEffect, useCallback, useRef } from 'react';

type SubscriptionOptions = {
  enabled?: boolean;
  refreshToken?: () => Promise<string>;
  taskId?: string; // Add taskId for recovery
};

export function useTemporalSubscription(options: SubscriptionOptions = {}) {
  const { enabled = true, refreshToken, taskId } = options;
  const [latestData, setLatestData] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);
  const lastSequenceRef = useRef<number>(0);
  const lastTimestampRef = useRef<number>(0);
  const connectionIdRef = useRef<string | null>(null);

  // Recovery function to fetch missed updates
  const recoverMissedUpdates = useCallback(async () => {
    if (!taskId || !connectionIdRef.current) return;

    try {
      setIsRecovering(true);

      const response = await fetch(`/api/temporal/recovery/${taskId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          connectionId: connectionIdRef.current,
          lastSequence: lastSequenceRef.current,
          lastTimestamp: lastTimestampRef.current,
        }),
      });

      const result = await response.json();

      if (result.success) {
        console.log(`Recovered ${result.recoveredUpdates} missed updates for task ${taskId}`);
      } else {
        console.error('Recovery failed:', result.error);
      }
    } catch (err) {
      console.error('Error during recovery:', err);
    } finally {
      setIsRecovering(false);
    }
  }, [taskId]);

  const connect = useCallback(async () => {
    if (!enabled) return;

    try {
      if (refreshToken) {
        await refreshToken();
      }

      setIsConnected(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setIsConnected(false);
    }
  }, [enabled, refreshToken]);

  useEffect(() => {
    if (!enabled) return;

    let eventSource: EventSource | null = null;
    let isCleaningUp = false;

    const setupSSE = async () => {
      try {
        await connect();

        // Create SSE connection
        const connectionId = crypto.randomUUID();
        connectionIdRef.current = connectionId;
        eventSource = new EventSource(`/api/temporal/stream?connectionId=${connectionId}`);

        eventSource.onopen = () => {
          if (!isCleaningUp) {
            setIsConnected(true);
            setError(null);

            // Trigger recovery when connection is established
            if (taskId && lastSequenceRef.current > 0) {
              setTimeout(() => recoverMissedUpdates(), 1000); // Small delay to ensure connection is stable
            }
          }
        };

        eventSource.onmessage = (event) => {
          if (isCleaningUp) return;
          
          try {
            const message = JSON.parse(event.data);

            // Handle different message types
            if (message.channel === 'tasks') {
              setLatestData(message);

              // Track sequence and timestamp for recovery
              if (message.sequence) {
                lastSequenceRef.current = Math.max(lastSequenceRef.current, message.sequence);
              }
              if (message.timestamp) {
                lastTimestampRef.current = Math.max(lastTimestampRef.current, message.timestamp);
              }
            }
          } catch (err) {
            console.error('Error parsing SSE message:', err);
          }
        };

        eventSource.onerror = (err) => {
          if (!isCleaningUp) {
            console.error('SSE error:', err);
            setError(new Error('SSE connection error'));
            setIsConnected(false);
          }
        };

      } catch (err) {
        if (!isCleaningUp) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setIsConnected(false);
        }
      }
    };

    setupSSE();

    // Handle page unload/refresh
    const handleBeforeUnload = () => {
      isCleaningUp = true;
      if (eventSource) {
        eventSource.close();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup function
    return () => {
      isCleaningUp = true;
      if (eventSource) {
        eventSource.close();
      }
      setIsConnected(false);
      setError(null);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [enabled, connect, recoverMissedUpdates, taskId]);

  return {
    latestData,
    isConnected,
    error,
    isRecovering,
    reconnect: connect,
    recoverMissedUpdates,
    lastSequence: lastSequenceRef.current,
    lastTimestamp: lastTimestampRef.current,
  };
}