import { VibeKit, VibeKitConfig } from "@vibe-kit/sdk";

// Declare process for Node.js environment
declare const process: {
  env: {
    OPENAI_API_KEY?: string;
    ANTHROPIC_API_KEY?: string;
    E2B_API_KEY?: string;
    BROADCAST_URL?: string;
    [key: string]: string | undefined;
  };
};

// Define Task type locally to avoid import issues
type Task = {
  id: string;
  title: string;
  mode: "code" | "ask";
  model?: "claude" | "codex"; // Add model selection
  repository?: string;
  branch?: string;
  status: "IN_PROGRESS" | "DONE" | "MERGED";
  messages: any[];
};

// Task classification types
type TaskType = 'CREATE_FEATURE' | 'BUG_FIX' | 'REFACTOR' | 'CONFIG_CHANGE' | 'DOCUMENTATION' | 'TESTING' | 'DEBUGGING' | 'SIMPLE_CHANGE';
type TaskComplexity = 'SIMPLE' | 'MODERATE' | 'COMPLEX';

interface TaskAnalysis {
  type: TaskType;
  complexity: TaskComplexity;
  estimatedSteps: number;
  requiresPlanning: boolean;
  keywords: string[];
}

// Intelligent prompt generation for code tasks
async function generateIntelligentCodePrompt(
  userPrompt: string, 
  task: any, 
  conversationHistory: any[]
): Promise<string> {
  const analysis = analyzeTaskIntent(userPrompt, conversationHistory);
  
  // Build context-aware prompt based on task analysis
  let enhancedPrompt = userPrompt;
  
  // Add task-specific instructions
  enhancedPrompt += '\n\n' + getTaskSpecificInstructions(analysis);
  
  // Add complexity-appropriate guidelines
  enhancedPrompt += '\n\n' + getComplexityInstructions(analysis.complexity);
  
  // Add repository-specific context if available
  if (task.repository) {
    enhancedPrompt += '\n\n' + getRepositoryInstructions(task.repository);
  }
  
  // Add planning instructions for complex tasks
  if (analysis.requiresPlanning) {
    enhancedPrompt += '\n\n' + getPlanningInstructions();
  }
  
  // Add efficiency optimizations
  enhancedPrompt += '\n\n' + getEfficiencyInstructions(analysis);

  // Add explicit PR creation instructions for code tasks
  enhancedPrompt += '\n\n' + getPullRequestInstructions();

  return enhancedPrompt;
}

// Analyze user intent and classify task
function analyzeTaskIntent(prompt: string, history: any[]): TaskAnalysis {
  const lowerPrompt = prompt.toLowerCase();
  
  // Intent keywords
  const createKeywords = ['add', 'create', 'build', 'implement', 'new', 'make'];
  const bugFixKeywords = ['fix', 'bug', 'error', 'issue', 'broken', 'not working', 'problem'];
  const refactorKeywords = ['refactor', 'improve', 'optimize', 'clean up', 'restructure'];
  const configKeywords = ['config', 'setup', 'configure', 'environment', 'settings'];
  const docKeywords = ['document', 'readme', 'docs', 'comment', 'explain'];
  const testKeywords = ['test', 'testing', 'unit test', 'integration test', 'spec'];
  const debugKeywords = ['debug', 'investigate', 'analyze', 'trace', 'inspect'];
  
  // Complexity indicators
  const complexityIndicators = {
    simple: ['button', 'text', 'color', 'style', 'simple', 'basic', 'quick'],
    complex: ['architecture', 'system', 'database', 'authentication', 'integration', 'api', 'framework', 'migration']
  };
  
  // Determine task type
  let type: TaskType = 'SIMPLE_CHANGE';
  if (createKeywords.some(k => lowerPrompt.includes(k))) type = 'CREATE_FEATURE';
  else if (bugFixKeywords.some(k => lowerPrompt.includes(k))) type = 'BUG_FIX';
  else if (refactorKeywords.some(k => lowerPrompt.includes(k))) type = 'REFACTOR';
  else if (configKeywords.some(k => lowerPrompt.includes(k))) type = 'CONFIG_CHANGE';
  else if (docKeywords.some(k => lowerPrompt.includes(k))) type = 'DOCUMENTATION';
  else if (testKeywords.some(k => lowerPrompt.includes(k))) type = 'TESTING';
  else if (debugKeywords.some(k => lowerPrompt.includes(k))) type = 'DEBUGGING';
  
  // Determine complexity
  let complexity: TaskComplexity = 'SIMPLE';
  if (complexityIndicators.complex.some(k => lowerPrompt.includes(k))) {
    complexity = 'COMPLEX';
  } else if (prompt.length > 100 || prompt.split(' ').length > 15) {
    complexity = 'MODERATE';
  }
  
  // Estimate steps and planning needs
  const estimatedSteps = complexity === 'COMPLEX' ? 5 : complexity === 'MODERATE' ? 3 : 1;
  const requiresPlanning = complexity === 'COMPLEX' || type === 'CREATE_FEATURE';
  
  return {
    type,
    complexity,
    estimatedSteps,
    requiresPlanning,
    keywords: extractKeywords(prompt)
  };
}

// Extract relevant keywords from prompt
function extractKeywords(prompt: string): string[] {
  const techKeywords = [
    'react', 'nextjs', 'typescript', 'javascript', 'node', 'express', 'api', 'database',
    'mongodb', 'postgres', 'mysql', 'redis', 'docker', 'kubernetes', 'aws', 'gcp',
    'authentication', 'authorization', 'jwt', 'oauth', 'rest', 'graphql', 'websocket',
    'tailwind', 'css', 'sass', 'webpack', 'vite', 'jest', 'cypress', 'playwright'
  ];
  
  const lowerPrompt = prompt.toLowerCase();
  return techKeywords.filter(keyword => lowerPrompt.includes(keyword));
}

// Get task-specific instructions
function getTaskSpecificInstructions(analysis: TaskAnalysis): string {
  const instructions = {
    CREATE_FEATURE: `## Feature Creation Guidelines:
- Start by understanding the existing architecture and patterns
- Create modular, reusable components
- Follow the established folder structure and naming conventions
- Implement proper error boundaries and loading states
- Add comprehensive tests for new functionality
- Document any new APIs or complex logic

## IMPORTANT: Pull Request Requirement
After implementing the feature, you MUST create a pull request by running the necessary git commands:
1. Commit all changes with a descriptive message
2. Push the branch to the remote repository
3. Create a pull request with appropriate title and description`,

    BUG_FIX: `## Bug Fix Guidelines:
- First, reproduce and understand the root cause of the issue
- Make minimal, targeted changes to fix the specific problem
- Ensure the fix doesn't introduce regressions
- Add or update tests to prevent similar issues
- Document the fix in commit messages clearly

## IMPORTANT: Pull Request Requirement
After fixing the bug, you MUST create a pull request by running the necessary git commands:
1. Commit all changes with a descriptive message
2. Push the branch to the remote repository
3. Create a pull request with appropriate title and description`,

    REFACTOR: `## Refactoring Guidelines:
- Preserve existing functionality while improving code quality
- Break large functions into smaller, focused utilities
- Improve naming for better readability
- Remove dead code and consolidate duplicates
- Ensure all tests pass after refactoring
- Update documentation if APIs change`,

    CONFIG_CHANGE: `## Configuration Guidelines:
- Understand the impact of configuration changes
- Use environment variables for sensitive or environment-specific values
- Validate configuration values and provide sensible defaults
- Document configuration options clearly
- Test configuration changes in different environments`,

    DOCUMENTATION: `## Documentation Guidelines:
- Write clear, concise, and accurate documentation
- Include code examples and usage patterns
- Keep documentation up-to-date with code changes
- Use consistent formatting and style
- Consider the audience (developers, users, maintainers)`,

    TESTING: `## Testing Guidelines:
- Write comprehensive test cases covering edge cases
- Follow the existing testing patterns and conventions
- Include unit tests, integration tests as appropriate
- Ensure tests are maintainable and readable
- Mock external dependencies appropriately`,

    DEBUGGING: `## Debugging Guidelines:
- Use systematic approach to isolate the issue
- Add logging and debugging statements strategically
- Check error messages, stack traces, and logs carefully
- Reproduce the issue in a controlled environment
- Document findings and solution approach`,

    SIMPLE_CHANGE: `## Implementation Guidelines:
- Keep changes minimal and focused
- Follow existing code patterns and conventions
- Test changes thoroughly before committing
- Write clear commit messages`
  };

  return instructions[analysis.type];
}

// Get complexity-appropriate instructions
function getComplexityInstructions(complexity: TaskComplexity): string {
  switch (complexity) {
    case 'SIMPLE':
      return `## Simple Task Approach:
- Make targeted, minimal changes
- Focus on the specific requirement
- Test the change works as expected
- Commit with a clear, descriptive message`;

    case 'MODERATE':
      return `## Moderate Task Approach:
- Break the task into 2-3 logical steps
- Consider the impact on existing functionality
- Write or update relevant tests
- Review code for potential improvements
- Document any new patterns or utilities`;

    case 'COMPLEX':
      return `## Complex Task Approach:
- **PLAN FIRST**: Break down into smaller, manageable steps
- **ANALYZE**: Understand existing architecture and dependencies
- **DESIGN**: Consider the best approach and potential alternatives
- **IMPLEMENT**: Work incrementally, testing each step
- **VALIDATE**: Comprehensive testing including edge cases
- **DOCUMENT**: Update documentation and add inline comments
- **REVIEW**: Check for security, performance, and maintainability concerns`;

    default:
      return '';
  }
}

// Get repository-specific context
function getRepositoryInstructions(repository: string): string {
  // Repository-specific patterns (this could be enhanced with actual repo analysis)
  const commonPatterns = {
    'nextjs': 'This appears to be a Next.js project. Follow Next.js conventions for pages, components, and API routes.',
    'react': 'This appears to be a React project. Use functional components with hooks, follow React best practices.',
    'typescript': 'This project uses TypeScript. Ensure proper typing, use interfaces for complex objects.',
    'tailwind': 'This project uses Tailwind CSS. Use utility classes consistently, avoid custom CSS where possible.'
  };

  const lowerRepo = repository.toLowerCase();
  const detectedPatterns = Object.entries(commonPatterns)
    .filter(([pattern]) => lowerRepo.includes(pattern))
    .map(([, instruction]) => instruction);

  if (detectedPatterns.length > 0) {
    return `## Repository Context:
${detectedPatterns.join('\n')}

## Code Quality Standards:
- Follow the existing code style and patterns in the repository
- Write clean, maintainable, and well-documented code
- Include appropriate error handling and validation
- Follow security best practices
- Ensure code is production-ready and follows project conventions
- Consider backwards compatibility when making changes`;
  }

  return `## Code Quality Standards:
- Follow the existing code style and patterns in the repository
- Write clean, maintainable, and well-documented code
- Include appropriate error handling and validation
- Follow security best practices
- Ensure code is production-ready and follows project conventions
- Consider backwards compatibility when making changes

## Git Workflow Requirements:
- Create a new branch for your changes with a descriptive name
- Make atomic commits with clear, descriptive commit messages
- Push your branch to the remote repository
- **IMPORTANT**: After completing your changes, you MUST create a pull request
- The pull request should target the main/master branch
- Include a clear description of what was changed and why`;
}

// Get planning instructions for complex tasks
function getPlanningInstructions(): string {
  return `## Planning Phase Required:
Before implementing, please:
1. **Analyze the current codebase** to understand existing patterns
2. **Break down the task** into specific, actionable steps
3. **Identify dependencies** and potential conflicts
4. **Plan the implementation approach** with clear milestones
5. **Consider testing strategy** and validation approach

Start by creating a brief implementation plan before making any changes.

## Implementation Checklist:
- [ ] Understand the existing architecture
- [ ] Identify files that need modification
- [ ] Plan the order of implementation
- [ ] Consider backward compatibility
- [ ] Plan testing approach
- [ ] Document any new patterns or utilities`;
}

// Enhanced error handling with context-aware suggestions
function getErrorRecoveryInstructions(taskType: TaskType, error: string): string {
  const commonSolutions: Record<string, string[]> = {
    CREATE_FEATURE: [
      "Check if similar components exist and follow their patterns",
      "Ensure all required dependencies are imported",
      "Verify the component is properly exported and imported where needed",
      "Check for naming conflicts with existing components"
    ],
    BUG_FIX: [
      "Reproduce the issue step by step",
      "Check recent changes that might have introduced the bug",
      "Review error logs and stack traces carefully",
      "Test the fix in isolation before applying broadly"
    ],
    REFACTOR: [
      "Ensure all tests still pass after refactoring",
      "Check for breaking changes in public APIs",
      "Verify imports and exports are updated correctly",
      "Run full test suite to catch any regressions"
    ]
  };

  const suggestions = commonSolutions[taskType] || commonSolutions.CREATE_FEATURE;

  return `## Error Recovery Suggestions:
${suggestions.map((s: string) => `- ${s}`).join('\n')}

## Specific Error Context:
${error}

Please analyze the error and try one of the suggested approaches.`;
}

// Get efficiency instructions based on task analysis
function getEfficiencyInstructions(analysis: TaskAnalysis): string {
  const baseInstructions = `## Efficiency Guidelines:
- Focus ONLY on the specific requirements - avoid scope creep
- Use existing patterns and utilities where possible
- Make minimal, targeted changes rather than extensive refactoring
- Test changes incrementally as you implement them

## CRITICAL: ALWAYS CREATE PULL REQUEST FOR CODE TASKS
For ANY code task, you MUST create a pull request at the end. This is REQUIRED, not optional.
Follow this exact sequence:
1. Make your code changes
2. Stage all changes: git add .
3. Commit with descriptive message: git commit -m "descriptive message"
4. Push to remote: git push origin [branch-name]
5. Create pull request using GitHub CLI or API
6. Confirm the PR was created successfully

DO NOT SKIP the pull request creation step. Every code task MUST end with a pull request.`;

  const taskSpecificEfficiency: Record<string, string> = {
    CREATE_FEATURE: `
- Look for existing similar components to reuse or extend
- Follow established patterns for consistency and speed
- Create reusable utilities if you notice repeated logic`,

    BUG_FIX: `
- Make the smallest change that fixes the issue
- Avoid refactoring unrelated code in the same commit
- Focus on the root cause, not symptoms`,

    REFACTOR: `
- Preserve existing functionality exactly
- Make changes incrementally and test each step
- Don't change behavior, only improve structure`,

    SIMPLE_CHANGE: `
- Keep the change as minimal as possible
- Don't over-engineer simple requirements
- Focus on getting it working correctly first`
  };

  const specificGuidance = taskSpecificEfficiency[analysis.type] || taskSpecificEfficiency.SIMPLE_CHANGE;
  
  return baseInstructions + specificGuidance;
}

// Get pull request creation instructions
function getPullRequestInstructions(): string {
  return `## CRITICAL: Implementation and Pull Request Requirements

### STEP 1: ANALYZE THE TASK
- First, understand exactly what needs to be changed
- Identify the specific files that need modification
- Use tools like \`find\`, \`grep\`, or \`ls\` to locate the relevant files

### STEP 2: MAKE THE ACTUAL CODE CHANGES
- **YOU MUST ACTUALLY MODIFY FILES** - this is not optional
- Use proper file editing tools to make the changes
- For text changes: locate the exact text and replace it
- For new features: create the necessary files and code
- **VERIFY your changes** by viewing the modified files

### STEP 3: VERIFY CHANGES WERE MADE
- Run \`git status\` to confirm files were modified
- Run \`git diff\` to see the actual changes
- If no changes appear, you MUST go back and actually modify the files

### STEP 4: COMMIT AND PUSH (REQUIRED)
- Create a new branch: \`git checkout -b feature/descriptive-name\`
- Stage changes: \`git add .\`
- Commit: \`git commit -m "descriptive commit message"\`
- Push: \`git push origin feature/descriptive-name\`

### COMMON MISTAKES TO AVOID:
- ❌ Don't just describe what should be changed - ACTUALLY CHANGE IT
- ❌ Don't run invalid commands like \`feature/branch-name\`
- ❌ Don't skip file modifications and go straight to git commands
- ❌ Don't assume changes were made without verifying

### SUCCESS CRITERIA:
- ✅ Files are actually modified (git status shows changes)
- ✅ Changes are committed to a new branch
- ✅ Branch is pushed to remote repository
- ✅ Pull request is created automatically by the system

**REMEMBER**: The system can only create a pull request if you actually modify files. No file changes = no pull request possible.`;
}

// Helper function to send updates via HTTP POST to the SSE endpoint
async function sendUpdate(message: any) {
  // Use environment variable or default to current port (3003)
  const broadcastUrl = process.env.BROADCAST_URL || 'http://localhost:3002/api/temporal/broadcast';

  try {
    console.log(`[BROADCAST] Sending update to ${broadcastUrl}:`, JSON.stringify(message, null, 2));

    // In a real production environment, you'd want to use a proper message queue
    // For now, we'll use a simple HTTP POST to trigger the SSE broadcast
    const response = await fetch(broadcastUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
      // Add timeout to prevent hanging
      signal: AbortSignal.timeout(10000), // Increased timeout to 10 seconds
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Broadcast failed with status: ${response.status}, body: ${errorText}`);
    }

    console.log(`[BROADCAST] Successfully sent update to ${broadcastUrl}`);
  } catch (error) {
    console.error(`[BROADCAST] Failed to send update to ${broadcastUrl}:`, error);

    // Log additional details for debugging
    if (error instanceof TypeError && error.message.includes('fetch failed')) {
      console.error(`[BROADCAST] Network error - is the Next.js app running on the correct port?`);
    }

    // Don't throw the error to prevent workflow failure due to broadcast issues
    // The workflow should continue even if broadcasts fail
  }
}

// Activity to generate code using VibeKit
export async function generateCode({
  task,
  token,
  sessionId,
  prompt,
}: {
  task: Task;
  token: string;
  sessionId?: string;
  prompt?: string;
}): Promise<unknown> {
  console.log(`[GENERATE_CODE] Starting code generation for task ${task.id} with model: ${task.model || 'claude'}`);
  console.log(`[GENERATE_CODE] Task mode: ${task.mode}, Repository: ${task.repository}`);
  console.log(`[GENERATE_CODE] GitHub token available: ${!!token}, length: ${token?.length || 0}`);

  try {
    // Use the model specified in the task, default to codex (OpenAI)
    const modelType = task.model || "codex";
    const apiKey = modelType === "claude"
      ? process.env.ANTHROPIC_API_KEY!
      : process.env.OPENAI_API_KEY!;

    const config: VibeKitConfig = {
      agent: {
        type: modelType,
        model: {
          apiKey,
        },
      },
      environment: {
        e2b: {
          apiKey: process.env.E2B_API_KEY!,
        },
      },
      github: {
        token,
        repository: task.repository || "",
      },
    };

    const vibekit = new VibeKit(config);

    // CONTAMINATION FIX: Instead of resuming sessions, create fresh sandbox for each task
    // This prevents cross-task contamination while avoiding E2B resume issues
    console.log(`[GENERATE_CODE] Creating fresh sandbox for task ${task.id} to prevent contamination`);
    // Don't set a session ID - let VibeKit create a fresh sandbox each time

    // CONTAMINATION DEBUG: Log task details before processing
    console.log(`[GENERATE_CODE] === CONTAMINATION DEBUG START ===`);
    console.log(`[GENERATE_CODE] Current task ID: ${task.id}`);
    console.log(`[GENERATE_CODE] Current task title: "${task.title}"`);
    console.log(`[GENERATE_CODE] Current prompt: "${prompt || 'none'}"`);
    console.log(`[GENERATE_CODE] Task repository: ${task.repository}`);
    console.log(`[GENERATE_CODE] Task branch: ${task.branch}`);
    console.log(`[GENERATE_CODE] SessionId: ${sessionId || 'none'}`);
    
    // CONTAMINATION FIX: Build conversation history ONLY from current task messages
    // Filter out any messages that might be from previous tasks or contain old commands
    const conversationMessages = task.messages
      .filter(msg => msg.role === 'user' || msg.role === 'assistant')
      .filter(msg => msg.type === 'message')
      .filter(msg => {
        const content = (msg.data?.text as string) || '';
        // Skip messages that contain references to previous tasks or old branch names
        const containsOldBranchRef = content.includes('feature/add-hello-world') || 
                                   content.includes('hello-world') ||
                                   content.includes('Hello World');
        if (containsOldBranchRef) {
          console.log(`[GENERATE_CODE] CONTAMINATION: Filtering out message with old task reference: "${content.substring(0, 100)}..."`);
          return false;
        }
        return true;
      })
      .map(msg => ({
        role: msg.role,
        content: (msg.data?.text as string) || ''
      }));

    console.log(`[GENERATE_CODE] Task has ${task.messages.length} total messages`);
    console.log(`[GENERATE_CODE] Raw task messages:`, task.messages.map(m => ({
      type: m.type,
      role: m.role,
      content: m.data?.text?.substring(0, 100) + '...' || 'no text'
    })));
    console.log(`[GENERATE_CODE] Filtered conversation messages (${conversationMessages.length}):`, conversationMessages);
    console.log(`[GENERATE_CODE] === CONTAMINATION DEBUG END ===`);
    
    // Add task analysis logging
    if (task.mode === 'code') {
      const analysis = analyzeTaskIntent(prompt || task.title, conversationMessages);
      console.log(`[GENERATE_CODE] Task Analysis:`, {
        type: analysis.type,
        complexity: analysis.complexity,
        estimatedSteps: analysis.estimatedSteps,
        requiresPlanning: analysis.requiresPlanning,
        keywords: analysis.keywords
      });
    }

    // CONTAMINATION FIX: Ensure we only use the current prompt, never append to potentially contaminated history
    const currentTaskPrompt = prompt || task.title;
    console.log(`[GENERATE_CODE] Using current task prompt only: "${currentTaskPrompt}"`);
    
    // For new tasks, start with empty conversation history to prevent contamination
    const cleanConversationHistory = task.messages.length === 0 ? [] : conversationMessages;
    console.log(`[GENERATE_CODE] Using clean conversation history with ${cleanConversationHistory.length} messages`);

    // Enhanced prompt with intelligent task analysis and guidelines (using only current task data)
    const enhancedPrompt = task.mode === 'code' 
      ? await generateIntelligentCodePrompt(currentTaskPrompt, task, cleanConversationHistory)
      : currentTaskPrompt;
      
    console.log(`[GENERATE_CODE] Generated enhanced prompt length: ${enhancedPrompt.length} characters`);

    const response = await vibekit.generateCode({
      prompt: enhancedPrompt,
      mode: task.mode,
      // CONTAMINATION FIX: Use clean conversation history to prevent cross-task contamination
      history: cleanConversationHistory.length > 0 ? cleanConversationHistory : undefined,
      callbacks: {
        onUpdate(message) {
        console.log(`[GENERATE_CODE] Raw message from ${modelType}:`, message);

        try {
          // Skip bash error messages that aren't JSON
          if (message.includes('/bin/bash:') || message.includes('command not found') || message.includes('No such file or directory')) {
            console.log(`[GENERATE_CODE] Skipping bash error message: ${message}`);
            return;
          }

          // Handle multiple JSON objects in the message (separated by newlines)
          const lines = message.split('\n').filter(line => line.trim());
          let processedAnyLine = false;

          for (const line of lines) {
            try {
              // Try to parse each line as JSON
              let parsedMessage;
              try {
                parsedMessage = JSON.parse(line);
                processedAnyLine = true;
              } catch (parseError) {
                // If direct parsing fails, try to extract JSON from the line
                console.log(`[GENERATE_CODE] Direct JSON parse failed for line, trying to extract JSON: ${line}`);
                const jsonMatch = line.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                  parsedMessage = JSON.parse(jsonMatch[0]);
                  processedAnyLine = true;
                } else {
                  // Skip non-JSON lines
                  console.log(`[GENERATE_CODE] Skipping non-JSON line: ${line}`);
                  continue;
                }
              }

              console.log(`[GENERATE_CODE] Parsed message from ${modelType}:`, parsedMessage);

              // Handle Claude's nested format where shell calls are in stdout
              let hasClaudeShellCommands = false;
              if (parsedMessage.type === 'end' && parsedMessage.output && modelType === 'claude') {
                try {
                  const outputData = JSON.parse(parsedMessage.output);
                  console.log(`[GENERATE_CODE] Claude output data:`, outputData);

                  if (outputData.stdout) {
                    // Parse each line of stdout as separate JSON messages
                    const lines = outputData.stdout.split('\n').filter((line: string) => line.trim());
                    console.log(`[GENERATE_CODE] Claude stdout lines (${lines.length}):`, lines);

                    lines.forEach((line: string, index: number) => {
                      try {
                        const lineData = JSON.parse(line);
                        console.log(`[GENERATE_CODE] Claude line ${index}:`, lineData);
                        console.log(`[GENERATE_CODE] Line type: ${lineData.type}, has content: ${!!lineData.message?.content}`);

                        // Handle assistant messages with tool_use (shell commands)
                        if (lineData.type === 'assistant' && lineData.message?.content) {
                          lineData.message.content.forEach((contentItem: any) => {
                            if (contentItem.type === 'tool_use') {
                              console.log(`[GENERATE_CODE] Found tool_use:`, contentItem);
                              hasClaudeShellCommands = true;

                              // Map different tool types to shell commands
                              let command = '';
                              let description = '';

                              if (contentItem.name === 'LS') {
                                command = `ls -la ${contentItem.input.path || '.'}`;
                                description = `List files in ${contentItem.input.path || 'current directory'}`;
                              } else if (contentItem.name === 'Bash') {
                                command = contentItem.input.command;
                                description = contentItem.input.description || command;
                              } else {
                                command = `${contentItem.name.toLowerCase()} ${JSON.stringify(contentItem.input)}`;
                                description = `Execute ${contentItem.name} tool`;
                              }

                              publishTaskUpdate({
                                taskId: task.id,
                                message: {
                                  type: 'local_shell_call',
                                  status: 'completed',
                                  action: {
                                    command: ['bash', '-c', command],
                                    description: description
                                  },
                                  call_id: contentItem.id,
                                  id: contentItem.id
                                },
                              });
                            }
                          });
                        }

                        // Handle user messages with tool_result (shell command output)
                        else if (lineData.type === 'user' && lineData.message?.content) {
                          lineData.message.content.forEach((contentItem: any) => {
                            if (contentItem.type === 'tool_result') {
                              console.log(`[GENERATE_CODE] Found tool_result:`, contentItem);

                              publishTaskUpdate({
                                taskId: task.id,
                                message: {
                                  type: 'local_shell_call_output',
                                  call_id: contentItem.tool_use_id,
                                  output: JSON.stringify({
                                    output: contentItem.content,
                                    metadata: { exit_code: contentItem.is_error ? 1 : 0 }
                                  })
                                },
                              });
                            }
                          });
                        }
                      } catch (lineParseError) {
                        console.log(`[GENERATE_CODE] Failed to parse line ${index}:`, lineParseError);
                      }
                    });
                  }
                } catch (outputParseError) {
                  console.log(`[GENERATE_CODE] Failed to parse Claude output:`, outputParseError);
                }
              }

              // Format the message according to the expected UI types
              if (parsedMessage.type === 'local_shell_call') {
                // Shell command started
                publishTaskUpdate({
                  taskId: task.id,
                  message: {
                    type: 'local_shell_call',
                    status: 'completed',
                    action: parsedMessage.action,
                    call_id: parsedMessage.id || parsedMessage.call_id,
                    ...parsedMessage
                  },
                });
              } else if (parsedMessage.type === 'local_shell_call_output') {
                // Shell command output
                publishTaskUpdate({
                  taskId: task.id,
                  message: {
                    type: 'local_shell_call_output',
                    call_id: parsedMessage.call_id,
                    output: parsedMessage.output,
                    ...parsedMessage
                  },
                });
              } else if (parsedMessage.type === 'git') {
                // Git operations
                publishTaskUpdate({
                  taskId: task.id,
                  message: {
                    type: 'git',
                    output: parsedMessage.output || parsedMessage.message,
                    ...parsedMessage
                  },
                });
              } else if (parsedMessage.type === 'message' && parsedMessage.role === 'assistant') {
                // Final AI response
                // Extract text from content array if it exists
                let text = '';
                if (Array.isArray(parsedMessage.content)) {
                  const textContent = parsedMessage.content.find((c: any) => c.type === 'text' || c.type === 'input_text');
                  text = textContent?.text || '';
                } else if (typeof parsedMessage.content === 'string') {
                  text = parsedMessage.content;
                }

                publishTaskUpdate({
                  taskId: task.id,
                  message: {
                    type: 'message',
                    role: 'assistant',
                    status: 'completed',
                    data: {
                      text: text
                    }
                  },
                });
              } else if (!hasClaudeShellCommands) {
                // Only send text message if we didn't find Claude shell commands
                publishTaskUpdate({
                  taskId: task.id,
                  message: {
                    type: 'text',
                    content: line,
                  },
                });
              }

            } catch (lineError) {
              console.log(`[GENERATE_CODE] Failed to process line: ${line}`, lineError);
              continue;
            }
          }

          // If we processed any lines successfully, return early
          if (processedAnyLine) {
            return;
          }
        } catch (parseError) {
          // Skip bash error messages that aren't JSON
          if (message.includes('/bin/bash:') || message.includes('command not found') || message.includes('No such file or directory')) {
            console.log(`[GENERATE_CODE] Skipping bash error message in catch: ${message}`);
            return;
          }

          // If JSON parsing fails, treat as plain text
          console.log(`[GENERATE_CODE] Failed to parse JSON from ${modelType}, treating as text:`, message);
          console.log(`[GENERATE_CODE] Parse error:`, parseError);

          // For Claude, try to extract shell commands from the text message
          let hasClaudeShellCommandsInCatch = false;
          if (modelType === 'claude' && message.includes('"type":"end"')) {
            try {
              // Extract the JSON from the text message
              const jsonMatch = message.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const endMessage = JSON.parse(jsonMatch[0]);
                if (endMessage.type === 'end' && endMessage.output) {
                  const outputData = JSON.parse(endMessage.output);
                  if (outputData.stdout) {
                    // Parse each line of stdout as separate JSON messages
                    const lines = outputData.stdout.split('\n').filter((line: string) => line.trim());
                    console.log(`[GENERATE_CODE] Claude stdout lines count: ${lines.length}`);
                    lines.forEach((line: string) => {
                      try {
                        const lineData = JSON.parse(line);
                        console.log(`[GENERATE_CODE] Claude line data:`, lineData);
                        if (lineData.type === 'assistant' && lineData.message?.content) {
                          // Look for tool_use in the content
                          lineData.message.content.forEach((contentItem: any) => {
                            if (contentItem.type === 'tool_use') {
                              console.log(`[GENERATE_CODE] Found tool_use in catch:`, contentItem);
                              hasClaudeShellCommandsInCatch = true;

                              // Map different tool types to shell commands
                              let command = '';
                              let description = '';

                              if (contentItem.name === 'LS') {
                                command = `ls -la ${contentItem.input.path || '.'}`;
                                description = `List files in ${contentItem.input.path || 'current directory'}`;
                              } else if (contentItem.name === 'Bash') {
                                command = contentItem.input.command;
                                description = contentItem.input.description || command;
                              } else {
                                command = `${contentItem.name.toLowerCase()} ${JSON.stringify(contentItem.input)}`;
                                description = `Execute ${contentItem.name} tool`;
                              }

                              publishTaskUpdate({
                                taskId: task.id,
                                message: {
                                  type: 'local_shell_call',
                                  status: 'completed',
                                  action: {
                                    command: ['bash', '-c', command],
                                    description: description
                                  },
                                  call_id: contentItem.id,
                                  id: contentItem.id
                                },
                              });
                            }
                          });
                        } else if (lineData.type === 'user' && lineData.message?.content) {
                          // Look for tool_result in the content
                          lineData.message.content.forEach((contentItem: any) => {
                            if (contentItem.type === 'tool_result') {
                              publishTaskUpdate({
                                taskId: task.id,
                                message: {
                                  type: 'local_shell_call_output',
                                  call_id: contentItem.tool_use_id,
                                  output: JSON.stringify({
                                    output: contentItem.content,
                                    metadata: { exit_code: contentItem.is_error ? 1 : 0 }
                                  })
                                },
                              });
                            }
                          });
                        }
                      } catch (lineParseError) {
                        // Skip lines that aren't valid JSON
                      }
                    });
                  }
                }
              }
            } catch (extractError) {
              console.log(`[GENERATE_CODE] Failed to extract Claude shell commands:`, extractError);
            }
          }

          // Only send text message if we didn't find Claude shell commands
          if (!hasClaudeShellCommandsInCatch) {
            publishTaskUpdate({
              taskId: task.id,
              message: {
                type: 'text',
                content: message,
              },
            });
          }
        }
      },
    },
  });

    console.log(`[GENERATE_CODE] Successfully completed code generation for task ${task.id}`);
    console.log(`[GENERATE_CODE] Response type: ${typeof response}, Response truthy: ${!!response}`);
    console.log(`[GENERATE_CODE] Task mode: ${task.mode}, Repository: ${task.repository}`);

    // Enhanced PR creation logic with better debugging
    if (task.mode === 'code') {
      console.log(`[GENERATE_CODE] Code task detected - checking PR creation requirements`);

      // Check all requirements for PR creation
      const canCreatePR = {
        hasResponse: !!response,
        hasRepository: !!task.repository,
        hasToken: !!token && token.length > 0,
        isCodeMode: task.mode === 'code'
      };

      console.log(`[GENERATE_CODE] PR Creation Requirements:`, canCreatePR);

      if (!canCreatePR.hasRepository) {
        console.warn(`[GENERATE_CODE] Cannot create PR: No repository specified in task`);
        await publishTaskUpdate({
          taskId: task.id,
          message: {
            type: 'pull_request_skipped',
            data: { reason: 'No repository specified in task configuration' }
          }
        });
      } else if (!canCreatePR.hasToken) {
        console.warn(`[GENERATE_CODE] Cannot create PR: No GitHub token available`);
        await publishTaskUpdate({
          taskId: task.id,
          message: {
            type: 'pull_request_skipped',
            data: { reason: 'No GitHub token available' }
          }
        });
      } else if (!canCreatePR.hasResponse) {
        console.warn(`[GENERATE_CODE] Cannot create PR: No response from code generation`);
        await publishTaskUpdate({
          taskId: task.id,
          message: {
            type: 'pull_request_skipped',
            data: { reason: 'No response from code generation' }
          }
        });
      } else {
        // All requirements met - attempt PR creation
        try {
          console.log(`[GENERATE_CODE] All requirements met - attempting to create pull request for task ${task.id}`);
          console.log(`[GENERATE_CODE] Repository: ${task.repository}, GitHub token length: ${token.length}`);
          console.log(`[GENERATE_CODE] Task object:`, JSON.stringify(task, null, 2));
          console.log(`[GENERATE_CODE] Response summary:`, {
            type: typeof response,
            keys: response && typeof response === 'object' ? Object.keys(response) : 'N/A'
          });

          // Notify UI that PR creation is starting
          await publishTaskUpdate({
            taskId: task.id,
            message: {
              type: 'pull_request_creating',
              data: { repository: task.repository }
            }
          });

          const prResult = await vibekit.createPullRequest();
          console.log(`[GENERATE_CODE] Pull request created successfully:`, prResult);

          // Publish PR creation success
          await publishTaskUpdate({
            taskId: task.id,
            message: {
              type: 'pull_request_created',
              data: {
                url: (prResult as any)?.html_url || (prResult as any)?.url,
                number: (prResult as any)?.number,
                title: (prResult as any)?.title,
                branch: (prResult as any)?.head?.ref,
                repository: task.repository
              }
            }
          });

          return { ...response, pullRequest: prResult };
        } catch (prError) {
          console.error(`[GENERATE_CODE] Failed to create pull request:`, prError);
          console.error(`[GENERATE_CODE] PR Error details:`, {
            message: prError instanceof Error ? prError.message : String(prError),
            stack: prError instanceof Error ? prError.stack : 'No stack trace',
            repository: task.repository,
            tokenLength: token.length
          });

          // Publish PR creation failure with detailed error
          await publishTaskUpdate({
            taskId: task.id,
            message: {
              type: 'pull_request_failed',
              data: {
                error: prError instanceof Error ? prError.message : String(prError),
                repository: task.repository,
                details: 'Check server logs for more information'
              }
            }
          });

          // Still return the original response even if PR creation fails
          return response;
        }
      }
    } else {
      console.log(`[GENERATE_CODE] Not a code task (mode: ${task.mode}) - skipping PR creation`);
    }
    
    return response;

  } catch (error) {
    console.error(`[GENERATE_CODE] Failed to generate code for task ${task.id}:`, error);

    // Broadcast error to UI
    try {
      await publishTaskUpdate({
        taskId: task.id,
        message: {
          type: 'error',
          content: error instanceof Error ? error.message : String(error),
          timestamp: Date.now(),
        },
      });
    } catch (broadcastError) {
      console.error(`[GENERATE_CODE] Failed to broadcast error:`, broadcastError);
    }

    // Check for specific E2B connection timeout errors
    if (error instanceof Error && error.message.includes('Connect Timeout Error')) {
      console.error(`[GENERATE_CODE] E2B connection timeout - this may be a temporary network issue`);
      throw new Error(`Failed to generate code: E2B connection timeout. Please try again.`);
    }

    // Check for fetch failed errors (usually network related)
    if (error instanceof Error && error.message.includes('fetch failed')) {
      console.error(`[GENERATE_CODE] Network error during code generation`);
      throw new Error(`Failed to generate code: Network error. Please check your connection and try again.`);
    }

    // Check for API credit/quota errors
    if (error instanceof Error && (
      error.message.includes('insufficient_quota') ||
      error.message.includes('quota_exceeded') ||
      error.message.includes('billing') ||
      error.message.includes('credits')
    )) {
      console.error(`[GENERATE_CODE] API quota/billing error`);
      throw new Error(`Failed to generate code: API quota exceeded or billing issue. Please check your API credits.`);
    }

    // Check for authentication errors
    if (error instanceof Error && (
      error.message.includes('unauthorized') ||
      error.message.includes('invalid_api_key') ||
      error.message.includes('authentication')
    )) {
      console.error(`[GENERATE_CODE] API authentication error`);
      throw new Error(`Failed to generate code: Invalid API key or authentication failed.`);
    }

    // Re-throw the original error with additional context
    throw new Error(`Failed to generate code: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Activity to publish task status updates
export async function publishTaskStatus(data: {
  taskId: string;
  status: "IN_PROGRESS" | "DONE" | "MERGED";
  sessionId: string;
}): Promise<void> {
  console.log(`[PUBLISH_STATUS] Publishing status update for task ${data.taskId}: ${data.status}`);
  await sendUpdate({
    channel: 'tasks',
    topic: 'status',
    data
  });
}

// Activity to publish task updates
export async function publishTaskUpdate(data: {
  taskId: string;
  message: Record<string, unknown>;
}): Promise<void> {
  console.log(`[PUBLISH_UPDATE] Publishing update for task ${data.taskId}:`, data.message.type || 'unknown');
  await sendUpdate({
    channel: 'tasks',
    topic: 'update',
    data
  });
}