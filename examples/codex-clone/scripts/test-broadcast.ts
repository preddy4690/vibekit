#!/usr/bin/env tsx

/**
 * Test script to verify the broadcast system is working correctly
 */

async function testBroadcast() {
  const broadcastUrl = process.env.BROADCAST_URL || 'http://localhost:3002/api/temporal/broadcast';
  
  console.log(`Testing broadcast to: ${broadcastUrl}`);
  
  const testMessage = {
    channel: 'tasks',
    topic: 'test',
    data: {
      taskId: 'test-task-123',
      message: 'Test broadcast message',
      timestamp: Date.now()
    }
  };
  
  try {
    console.log('Sending test broadcast...');
    
    const response = await fetch(broadcastUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testMessage),
      signal: AbortSignal.timeout(10000),
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Broadcast failed with status: ${response.status}, body: ${errorText}`);
    }
    
    const result = await response.json();
    console.log('✅ Broadcast successful:', result);
    
    // Test connection count
    const connectionsResponse = await fetch('http://localhost:3002/api/temporal/stream?connectionId=test-connection', {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    
    if (connectionsResponse.ok) {
      console.log('✅ SSE endpoint is accessible');
    } else {
      console.log('❌ SSE endpoint returned:', connectionsResponse.status);
    }
    
  } catch (error) {
    console.error('❌ Broadcast test failed:', error);
    
    if (error instanceof TypeError && error.message.includes('fetch failed')) {
      console.error('💡 This suggests the Next.js app is not running or not accessible on the expected port');
      console.error('💡 Make sure your Next.js app is running on port 3002');
    }
    
    process.exit(1);
  }
}

// Run the test
testBroadcast().catch(console.error);
