"use client";
import { useEffect, useRef } from "react";

import TaskNavbar from "./_components/navbar";
import MessageInput from "./_components/message-input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTemporalSubscription } from "@/hooks/useTemporalSubscription";
import { getTemporalSubscriptionToken } from "@/app/actions/temporal";
import { useHydratedTaskStore } from "@/hooks/useHydratedTaskStore";
import { useWorkflowSync } from "@/hooks/useWorkflowSync";
import { Terminal, RefreshCw } from "lucide-react";
import { TextShimmer } from "@/components/ui/text-shimmer";
import { Markdown } from "@/components/markdown";
import { MarkdownErrorBoundary } from "@/components/markdown-error-boundary";
import { sanitizeMarkdownContent, hasProblematicTags, extractProblematicTags } from "@/lib/content-sanitizer";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Props {
  id: string;
}

export default function TaskClientPage({ id }: Props) {
  // All hooks must be called at the top level, before any conditional logic
  const { getTaskById } = useHydratedTaskStore();
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const { latestData, isRecovering, recoverMissedUpdates } = useTemporalSubscription({
    refreshToken: getTemporalSubscriptionToken,
    enabled: true,
    taskId: id,
  });

  // Sync workflow status when component mounts
  useWorkflowSync(id);

  // Get task after all hooks are called
  const task = getTaskById(id);

  useEffect(() => {
    if (latestData?.channel === "tasks" && latestData.topic === "update") {
      // Handle real-time task updates here if needed
      // For now, updates are handled in the Container component
    }
  }, [latestData]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      );
      if (viewport) {
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: "smooth",
        });
      }
    }
  }, [task?.messages]);

  // Function to get the output message for a given shell call message
  const getOutputForCall = (callId: string) => {
    return task?.messages.find(
      (message) =>
        message.type === "local_shell_call_output" &&
        message.data?.call_id === callId
    );
  };

  // If task is not found, show a loading or error state
  if (!task) {
    return (
      <div className="flex flex-col h-screen">
        <div className="flex items-center justify-center flex-1">
          <p className="text-muted-foreground">Task not found or loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <TaskNavbar
        id={id}
        onRecovery={recoverMissedUpdates}
        isRecovering={isRecovering}
      />
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar for chat messages */}
        <div className="w-150 border-r border-border bg-card flex flex-col min-h-0">
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-4 flex flex-col gap-y-3 min-h-full">
              <div className="bg-muted rounded-xl px-4 py-3 text-right max-w-[80%] min-w-fit self-end">
                <p className="whitespace-pre-wrap break-words">{task?.title}</p>
              </div>
              {task?.messages
                .filter(
                  (message) =>
                    (message.role === "assistant" || message.role === "user") &&
                    (message.type === "message" || message.type === "claude_working" || 
                     message.type === "pull_request_created" || message.type === "pull_request_failed")
                )
                .map((message, index) => {
                  // Generate a more robust key based on message content and position
                  const messageKey = `message-${index}-${message.data?.id || message.data?.call_id || `msg-${index}`}-${message.type}-${message.role}`;

                  return (
                    <div
                      key={messageKey}
                      className="mt-2 flex-wrap flex flex-col"
                    >
                      {message.role === "assistant" && message.type === "claude_working" && (
                        <div className="flex items-start gap-x-2">
                          <Terminal className="size-4 text-orange-500" />
                          <div className="-mt-1">
                            <TextShimmer>
                              {(message.data?.text as string) || "Claude is working..."}
                            </TextShimmer>
                          </div>
                        </div>
                      )}
                      {message.role === "assistant" && message.type === "message" && (
                        <MarkdownErrorBoundary>
                          <Markdown
                            repoUrl={
                              task?.repository
                                ? `https://github.com/${task.repository}`
                                : undefined
                            }
                            branch={task?.branch}
                          >
                            {(() => {
                              const rawContent = (message.data?.text as string) || '';

                              // Debug logging for problematic content
                              if (hasProblematicTags(rawContent)) {
                                const problematicTags = extractProblematicTags(rawContent);
                                console.warn('Found problematic tags in message content:', problematicTags);
                                console.warn('Raw content:', rawContent);
                              }

                              return sanitizeMarkdownContent(rawContent);
                            })()}
                          </Markdown>
                        </MarkdownErrorBoundary>
                      )}
                      {message.role === "user" && (
                        <div className="bg-muted rounded-xl px-4 py-3 text-right self-end max-w-[80%] min-w-fit">
                          <p className="whitespace-pre-wrap break-words">{(message.data?.text as string) || ''}</p>
                        </div>
                      )}
                      {message.type === "pull_request_created" && (
                        <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span className="font-medium text-green-700 dark:text-green-300">Pull Request Created</span>
                          </div>
                          <p className="text-sm text-green-600 dark:text-green-400 mb-2">
                            {(message.data as any)?.title || 'A new pull request has been created for your changes.'}
                          </p>
                          {(message.data as any)?.url && (
                            <a 
                              href={(message.data as any).url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-sm text-green-600 dark:text-green-400 hover:underline"
                            >
                              View Pull Request #{(message.data as any)?.number}
                            </a>
                          )}
                          {(message.data as any)?.branch && (
                            <p className="text-xs text-green-500 dark:text-green-500 mt-1">
                              Branch: {(message.data as any).branch}
                            </p>
                          )}
                        </div>
                      )}
                      {message.type === "pull_request_failed" && (
                        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                            <span className="font-medium text-red-700 dark:text-red-300">Pull Request Failed</span>
                          </div>
                          <p className="text-sm text-red-600 dark:text-red-400">
                            Failed to create pull request: {(message.data as any)?.error || 'Unknown error'}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              {task?.status === "IN_PROGRESS" && (
                <div className="flex items-start gap-x-2 mt-2">
                  <Terminal className="size-4 text-muted-foreground" />
                  <div className="-mt-1">
                    <TextShimmer>
                      {task?.statusMessage
                        ? `${task.statusMessage}...`
                        : "Working on task..."}
                    </TextShimmer>
                  </div>
                </div>
              )}
              {isRecovering && (
                <div className="flex items-start gap-x-2 mt-2">
                  <RefreshCw className="size-4 text-blue-500 animate-spin" />
                  <div className="-mt-1">
                    <TextShimmer>
                      Recovering missed updates...
                    </TextShimmer>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Message input component */}
          <div className="flex-shrink-0 border-t border-border">
            <MessageInput task={task} />
          </div>
        </div>

        {/* Right panel for details */}
        <div className="flex-1 bg-muted relative">
          {/* Fade overlay at the top */}
          <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-muted to-transparent pointer-events-none z-10" />
          <ScrollArea ref={scrollAreaRef} className="h-full">
            <div className="max-w-3xl mx-auto w-full py-10 px-6">
              {/* Details content will go here */}
              <div className="flex flex-col gap-y-10">
                {/* Show Claude working indicator in right panel */}
                {(task?.messages.some(msg => msg.type === "claude_working") ||
                  (task?.status === "IN_PROGRESS" && task?.model?.includes('claude') && task?.messages.length === 0)) && (
                  <div className="flex flex-col">
                    <div className="flex items-start gap-x-2">
                      <div className="flex items-center gap-2 bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg p-4 w-full">
                        <Terminal className="size-5 text-orange-500 animate-pulse" />
                        <div className="flex flex-col">
                          <span className="font-medium text-sm text-orange-700 dark:text-orange-300">
                            Claude is working
                          </span>
                          <span className="text-xs text-orange-600 dark:text-orange-400">
                            Analyzing codebase and executing commands...
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {(() => {
                  // Deduplicate shell calls using a Set
                  const seenCallIds = new Set<string>();
                  const uniqueMessages: any[] = [];
                  
                  task?.messages.forEach((message) => {
                    if (message.type === "local_shell_call") {
                      const callId = message.data?.call_id || message.data?.id;
                      if (callId && seenCallIds.has(callId)) {
                        return; // Skip duplicate
                      }
                      if (callId) seenCallIds.add(callId);
                    }
                    uniqueMessages.push(message);
                  });
                  
                  return uniqueMessages;
                })()
                  .map((message, index) => {
                    if (message.type === "local_shell_call") {
                      const output = getOutputForCall(
                        message.data?.call_id as string
                      );
                      const shellKey = `shell-${index}-${message.data?.call_id || message.data?.id || `msg-${index}`}-${message.type}`;

                      return (
                        <div
                          key={shellKey}
                          className="flex flex-col"
                        >
                          <div className="flex items-start gap-x-2">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <p className="font-medium font-mono text-sm -mt-1 truncate max-w-md cursor-help">
                                    {(
                                      message.data as {
                                        action?: { command?: string[] };
                                      }
                                    )?.action?.command
                                      ?.slice(1)
                                      .join(" ")}
                                  </p>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-sm break-words">
                                    {(
                                      message.data as {
                                        action?: { command?: string[] };
                                      }
                                    )?.action?.command
                                      ?.slice(1)
                                      .join(" ")}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          {output && (
                            <div className="mt-2">
                              <div className="rounded-md bg-background border">
                                <div className="flex items-center gap-2 bg-sidebar border-b p-4 py-2 rounded-t-lg">
                                  <Terminal className="size-4 text-muted-foreground" />
                                  <span className="font-medium text-sm">
                                    shell
                                  </span>
                                </div>
                                <ScrollArea>
                                  <pre className="whitespace-pre-wrap leading-relaxed p-4 max-h-[300px] text-[13px]">
                                    {(() => {
                                      try {
                                        const parsed = JSON.parse(
                                          (output.data as { output?: string })
                                            ?.output || "{}"
                                        );
                                        return parsed.output || "No output";
                                      } catch {
                                        return "Failed to parse output";
                                      }
                                    })()}
                                  </pre>
                                </ScrollArea>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    }
                    return null;
                  })}
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}