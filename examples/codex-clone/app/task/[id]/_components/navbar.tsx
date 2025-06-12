"use client";
import { ArrowLeft, Dot, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { useHydratedTaskStore } from "@/hooks/useHydratedTaskStore";
import { useWorkflowSync } from "@/hooks/useWorkflowSync";
import { useNavigation } from "@/hooks/useNavigation";

interface Props {
  id: string;
  onRecovery?: () => Promise<void>;
  isRecovering?: boolean;
}

export default function TaskNavbar({ id, onRecovery, isRecovering = false }: Props) {
  const { navigateBack } = useNavigation();
  const { getTaskById } = useHydratedTaskStore();
  const task = getTaskById(id);
  const [mounted, setMounted] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { syncWorkflowStatus } = useWorkflowSync(id);

  useEffect(() => {
    setMounted(true);

    // Add keyboard shortcut for back navigation (Escape key)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Only trigger if not in an input field
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && !target.isContentEditable) {
          navigateBack('/');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigateBack]);

  // Prevent hydration mismatch by only showing time on client
  const timeAgo = mounted && task?.createdAt && typeof task.createdAt === 'string'
    ? formatDistanceToNow(new Date(task.createdAt), { addSuffix: true })
    : 'Loading...';

  const handleBack = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    console.log('Back button clicked');
    navigateBack('/');
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // First sync workflow status
      await syncWorkflowStatus();

      // Then trigger recovery if available
      if (onRecovery) {
        await onRecovery();
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="h-14 border-b flex items-center px-4">
      <div className="flex items-center gap-x-2 flex-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleBack}
          onDoubleClick={handleBack}
          title="Go back (or press Escape)"
          className="hover:bg-accent transition-colors"
        >
          <ArrowLeft />
        </Button>
        <div className="h-8 border-r" />
        <div className="flex flex-col gap-x-2 ml-4">
          <h3 className=" font-medium">{task?.title}</h3>
          <div className="flex items-center gap-x-0">
            <p className="text-sm text-muted-foreground">
              {timeAgo}
            </p>
            <Dot className="size-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{task?.repository}</p>
          </div>
        </div>
      </div>

      {/* Refresh button - always visible for workflow sync and recovery */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleRefresh}
        disabled={isRefreshing || isRecovering}
        title={`Sync workflow status and recover missed updates (current: ${task?.status || 'unknown'})`}
        className="flex items-center gap-2"
      >
        <RefreshCw className={`size-4 ${(isRefreshing || isRecovering) ? 'animate-spin' : ''}`} />
        {isRecovering ? 'Recovering...' : isRefreshing ? 'Syncing...' : 'Refresh'}
      </Button>
    </div>
  );
}
