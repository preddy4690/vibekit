import { NextRequest, NextResponse } from 'next/server';
import { addConnection, removeConnection } from '@/lib/sse-broadcast';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const connectionId = searchParams.get('connectionId') || crypto.randomUUID();

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    start(controller) {
      // Store the connection
      addConnection(connectionId, controller);

      // Send initial connection message
      const initialMessage = `data: ${JSON.stringify({
        type: 'connected',
        connectionId,
        timestamp: Date.now()
      })}\n\n`;

      controller.enqueue(new TextEncoder().encode(initialMessage));
      
      // Send keep-alive every 30 seconds
      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(': keep-alive\n\n'));
        } catch {
          clearInterval(keepAlive);
          removeConnection(connectionId);
        }
      }, 30000);
      
      // Clean up on close
      request.signal.addEventListener('abort', () => {
        clearInterval(keepAlive);
        removeConnection(connectionId);
        try {
          controller.close();
        } catch {
          // Connection already closed
        }
      });
    },

    cancel() {
      removeConnection(connectionId);
    }
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    },
  });
}
