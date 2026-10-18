/** A task editor is bound to its entry task; stale multi-task drafts cannot widen it. */
export function completionForEntry(
  taskId: string | undefined,
  completed: string[] = [],
) {
  return taskId && completed.includes(taskId) ? [taskId] : [];
}
