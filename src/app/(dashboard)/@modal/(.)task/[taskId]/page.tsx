"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import { TaskDetailModal } from "~/components/task-detail-modal";
import { TaskDialog } from "~/components/task-dialog";
import { api } from "~/trpc/react";

export default function TaskModalPage() {
  const params = useParams<{ taskId: string }>();
  const router = useRouter();
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const { data: task } = api.task.getById.useQuery(
    { id: params.taskId },
    { enabled: !!params.taskId }
  );

  const handleClose = () => {
    router.back();
  };

  const handleEdit = () => {
    setEditDialogOpen(true);
  };

  const handleEditClose = (open: boolean) => {
    setEditDialogOpen(open);
  };

  return (
    <>
      <TaskDetailModal
        taskId={params.taskId}
        open={true}
        onOpenChange={handleClose}
        onEdit={handleEdit}
      />
      {task && (
        <TaskDialog
          open={editDialogOpen}
          onOpenChange={handleEditClose}
          task={{
            id: task.id,
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            projectId: task.projectId,
            estimatedTime: task.estimatedTime,
            dueDate: task.dueDate,
            tags: task.tags,
            isBillable: task.isBillable,
            hourlyRate: task.hourlyRate,
            currency: task.currency,
            billingStatus: task.billingStatus,
            project: task.project,
          }}
        />
      )}
    </>
  );
}
