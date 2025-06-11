"use client";
import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Task } from "@/stores/tasks";
import { createTaskAction } from "@/app/actions/temporal";
import { useHydratedTaskStore } from "@/hooks/useHydratedTaskStore";

export default function MessageInput({ task }: { task: Task }) {
  const { updateTask } = useHydratedTaskStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [messageValue, setMessageValue] = useState("");



  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "60px"; // Reset to min height
      textarea.style.height = Math.max(60, textarea.scrollHeight) + "px";
    }
  };

  const handleSendMessage = async () => {
    if (messageValue.trim() && task.status !== "IN_PROGRESS") {
      try {
        await createTaskAction({
          task,
          prompt: messageValue,
        });

        updateTask(task.id, {
          ...task,
          status: "IN_PROGRESS",
          statusMessage: "Working on task...",
          messages: [
            ...task.messages,
            {
              role: "user",
              type: "message",
              data: { text: messageValue, id: crypto.randomUUID() },
            },
          ],
        });

        setMessageValue("");
      } catch (error) {
        console.error("Error sending message:", error);
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [messageValue]);

  // Don't render if task is not available
  if (!task) {
    return null;
  }

  return (
    <div className="p-4">
      {task.status === "IN_PROGRESS" && (
        <div className="mb-2 text-xs text-muted-foreground text-center">
          Task is in progress. Please wait for completion before sending another message.
        </div>
      )}

      <div className="p-0.5 rounded-xl bg-muted">
        <div className="flex flex-col gap-y-2 border bg-background rounded-xl p-3">
          <textarea
            ref={textareaRef}
            value={messageValue}
            onChange={(e) => setMessageValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="w-full min-h-[60px] resize-none border-none p-0 focus:outline-none focus:border-transparent overflow-hidden"
          />
          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              onClick={handleSendMessage}
              disabled={!messageValue.trim() || task.status === "IN_PROGRESS"}
            >
              <Send className="size-4" />
              Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
