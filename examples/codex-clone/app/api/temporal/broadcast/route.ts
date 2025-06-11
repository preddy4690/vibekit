import { NextRequest, NextResponse } from 'next/server';
import { broadcastMessage } from '@/lib/sse-broadcast';

export async function POST(request: NextRequest) {
  try {
    const message = await request.json();

    // Broadcast the message to all connected SSE clients
    broadcastMessage(message);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error broadcasting message:', error);
    return NextResponse.json(
      { error: 'Failed to broadcast message' },
      { status: 500 }
    );
  }
}
