#!/usr/bin/env tsx

/**
 * Test script to verify the JSON parsing fix for multiple JSON objects
 * This simulates the problematic input that was causing parsing errors
 */

// Simulate the problematic message that was causing the error
const problematicMessage = `{"type":"local_shell_call_output","call_id":"call_UjfAx54UtBcZgkQaGa1wJKeI","output":"{\\"output\\":\\"aborted\\",\\"metadata\\":{}}"}
{"type":"message","role":"user","content":[{"type":"input_text","text":"No, don't do that — keep going though."}]}`;

console.log('Testing JSON parsing fix...');
console.log('Input message:');
console.log(problematicMessage);
console.log('\n' + '='.repeat(50) + '\n');

// Test the new parsing logic
function testNewParsingLogic(message: string) {
  console.log('Testing new parsing logic:');
  
  try {
    // Skip bash error messages that aren't JSON
    if (message.includes('/bin/bash:') || message.includes('command not found') || message.includes('No such file or directory')) {
      console.log(`Skipping bash error message: ${message}`);
      return;
    }

    // Handle multiple JSON objects in the message (separated by newlines)
    const lines = message.split('\n').filter(line => line.trim());
    let processedAnyLine = false;
    
    console.log(`Found ${lines.length} lines to process`);
    
    for (const line of lines) {
      try {
        // Try to parse each line as JSON
        let parsedMessage;
        try {
          parsedMessage = JSON.parse(line);
          processedAnyLine = true;
          console.log(`✅ Successfully parsed line:`, parsedMessage);
        } catch (parseError) {
          // If direct parsing fails, try to extract JSON from the line
          console.log(`Direct JSON parse failed for line, trying to extract JSON: ${line}`);
          const jsonMatch = line.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsedMessage = JSON.parse(jsonMatch[0]);
            processedAnyLine = true;
            console.log(`✅ Successfully extracted and parsed JSON:`, parsedMessage);
          } else {
            // Skip non-JSON lines
            console.log(`⚠️ Skipping non-JSON line: ${line}`);
            continue;
          }
        }
        
        // Here we would normally process the message
        console.log(`📝 Processing message type: ${parsedMessage.type}`);
        
      } catch (lineError) {
        console.log(`❌ Failed to process line: ${line}`, lineError);
        continue;
      }
    }
    
    console.log(`\n✅ Successfully processed ${processedAnyLine ? 'some' : 'no'} lines`);
    
  } catch (error) {
    console.log('❌ Error in parsing logic:', error);
  }
}

// Test the old parsing logic (what was failing)
function testOldParsingLogic(message: string) {
  console.log('Testing old parsing logic (what was failing):');
  
  try {
    const parsedMessage = JSON.parse(message);
    console.log('✅ Old logic would have worked:', parsedMessage);
  } catch (error) {
    console.log('❌ Old logic failed (as expected):', error.message);
  }
}

// Run the tests
testOldParsingLogic(problematicMessage);
console.log('\n' + '-'.repeat(50) + '\n');
testNewParsingLogic(problematicMessage);

console.log('\n🎉 Test completed!');
