"use client";
import { Archive, Check, Dot, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useEffect, useState } from "react";

import { useHydratedTaskStore } from "@/hooks/useHydratedTaskStore";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { TextShimmer } from "@/components/ui/text-shimmer";
import Link from "next/link";

export default function TaskList() {
  const { getActiveTasks, getArchivedTasks, archiveTask, removeTask } =
    useHydratedTaskStore();
  const activeTasks = getActiveTasks();
  const archivedTasks = getArchivedTasks();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="max-w-3xl mx-auto w-full p-1 rounded-lg bg-muted">
      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">
            <Check />
            Tasks
          </TabsTrigger>
          <TabsTrigger value="archived">
            <Archive />
            Archive
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <div className="flex flex-col gap-1">
            {activeTasks.length === 0 ? (
              <p className="text-muted-foreground p-2">No active tasks yet.</p>
            ) : (
              activeTasks.map((task) => (
                <div
                  key={task.id}
                  className="border rounded-lg bg-background p-4 flex items-center justify-between"
                >
                  <Link href={`/task/${task.id}`} className="flex-1">
                    <div>
                      <div className="flex items-center gap-x-2">
                        {task.hasChanges && (
                          <div className="size-2 rounded-full bg-blue-500 " />
                        )}
                        <h3 className="font-medium">{task.title}</h3>
                      </div>
                      {task.status === "IN_PROGRESS" ? (
                        <div>
                          <TextShimmer className="text-sm">
                            {`${
                              task.statusMessage || "Working on your task"
                            }...`}
                          </TextShimmer>
                        </div>
                      ) : (
                        <div className="flex items-center gap-0">
                          <p className="text-sm text-muted-foreground">
                            {mounted
                              ? formatDistanceToNow(new Date(task.createdAt), {
                                  addSuffix: true,
                                })
                              : 'Loading...'
                            }
                          </p>
                          <Dot className="size-4 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">
                            {task.repository}
                          </p>
                        </div>
                      )}
                    </div>
                  </Link>
                  {task.status === "DONE" && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => archiveTask(task.id)}
                    >
                      <Archive />
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </TabsContent>
        <TabsContent value="archived">
          <div className="flex flex-col gap-1">
            {archivedTasks.length === 0 ? (
              <p className="text-muted-foreground p-2">
                No archived tasks yet.
              </p>
            ) : (
              archivedTasks.map((task) => (
                <div
                  key={task.id}
                  className="border rounded-lg p-4 flex items-center justify-between bg-background"
                >
                  <div>
                    <h3 className="font-medium text-muted-foreground">
                      {task.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Status: {task.status} • Branch: {task.branch}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeTask(task.id);
                    }}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
