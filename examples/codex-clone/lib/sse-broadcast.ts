// Store active connections - use globalThis to persist across hot reloads
const globalForConnections = globalThis as unknown as {
  sseConnections: Map<string, ReadableStreamDefaultController> | undefined;
};

const connections = globalForConnections.sseConnections ?? new Map<string, ReadableStreamDefaultController>();
globalForConnections.sseConnections = connections;

// Helper to broadcast messages to all connections
export function broadcastMessage(message: any) {
  const data = `data: ${JSON.stringify(message)}\n\n`;

  connections.forEach((controller, connectionId) => {
    try {
      controller.enqueue(new TextEncoder().encode(data));
    } catch (error) {
      console.error(`Failed to send message to connection ${connectionId}:`, error);
      connections.delete(connectionId);
    }
  });
}

// Add a connection
export function addConnection(connectionId: string, controller: ReadableStreamDefaultController) {
  connections.set(connectionId, controller);
}

// Remove a connection
export function removeConnection(connectionId: string) {
  connections.delete(connectionId);
}

// Get connection count
export function getConnectionCount() {
  return connections.size;
}
