import { NextRequest, NextResponse } from 'next/server';
import { broadcastMessage } from '@/lib/sse-broadcast';

export async function POST(request: NextRequest) {
  try {
    const message = await request.json();

    console.log(`[BROADCAST_API] Received broadcast request:`, message.channel, message.topic);

    // Broadcast the message to all connected SSE clients
    broadcastMessage(message);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[BROADCAST_API] Error broadcasting message:', error);
    return NextResponse.json(
      { error: 'Failed to broadcast message' },
      { status: 500 }
    );
  }
}
