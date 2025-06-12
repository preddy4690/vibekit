// Store active connections - use globalThis to persist across hot reloads
const globalForConnections = globalThis as unknown as {
  sseConnections: Map<string, ReadableStreamDefaultController> | undefined;
};

const connections = globalForConnections.sseConnections ?? new Map<string, ReadableStreamDefaultController>();
globalForConnections.sseConnections = connections;

// Helper to broadcast messages to all connections
export function broadcastMessage(message: any) {
  const data = `data: ${JSON.stringify(message)}\n\n`;
  const activeConnections = connections.size;

  console.log(`[SSE_BROADCAST] Broadcasting message to ${activeConnections} connections:`, message.channel, message.topic);

  if (activeConnections === 0) {
    console.warn(`[SSE_BROADCAST] No active SSE connections to broadcast to`);
    return;
  }

  let successCount = 0;
  let failureCount = 0;

  connections.forEach((controller, connectionId) => {
    try {
      controller.enqueue(new TextEncoder().encode(data));
      successCount++;
    } catch (error) {
      console.error(`[SSE_BROADCAST] Failed to send message to connection ${connectionId}:`, error);
      connections.delete(connectionId);
      failureCount++;
    }
  });

  console.log(`[SSE_BROADCAST] Broadcast complete: ${successCount} successful, ${failureCount} failed`);
}

// Add a connection
export function addConnection(connectionId: string, controller: ReadableStreamDefaultController) {
  connections.set(connectionId, controller);
  console.log(`[SSE_BROADCAST] Added connection ${connectionId}. Total connections: ${connections.size}`);
}

// Remove a connection
export function removeConnection(connectionId: string) {
  const wasRemoved = connections.delete(connectionId);
  if (wasRemoved) {
    console.log(`[SSE_BROADCAST] Removed connection ${connectionId}. Total connections: ${connections.size}`);
  }
}

// Get connection count
export function getConnectionCount() {
  return connections.size;
}
