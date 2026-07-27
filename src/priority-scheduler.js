const PRIORITY_CLASSES = {
  CRITICAL: { label: 'CRITICAL', maxIterations: 50, maxTimeMinutes: 30, preempt: true },
  HIGH:     { label: 'HIGH',     maxIterations: 25, maxTimeMinutes: 15, preempt: false },
  NORMAL:   { label: 'NORMAL',   maxIterations: 10, maxTimeMinutes: 5,  preempt: false },
  LOW:      { label: 'LOW',      maxIterations: 5,  maxTimeMinutes: 2,  preempt: false },
  RESEARCH: { label: 'RESEARCH', maxIterations: 5,  maxTimeMinutes: 5,  preempt: false }
};

class PriorityScheduler {
  constructor() {
    this.taskQueue = [];
    this.activeTasks = new Map();
  }

  enqueue(task) {
    const priority = PRIORITY_CLASSES[task.priority] ? task.priority : 'NORMAL';
    const limits = PRIORITY_CLASSES[priority];
    const enriched = {
      ...task,
      priority,
      maxIterations: task.maxIterations || limits.maxIterations,
      maxTimeMinutes: task.maxTimeMinutes || limits.maxTimeMinutes,
      createdAt: new Date().toISOString(),
      status: 'queued'
    };
    this.taskQueue.push(enriched);
    // Sort: CRITICAL first, then HIGH, etc.
    const order = ['CRITICAL', 'HIGH', 'NORMAL', 'LOW', 'RESEARCH'];
    this.taskQueue.sort((a, b) => order.indexOf(a.priority) - order.indexOf(b.priority));
    return enriched;
  }

  dequeue() {
    const task = this.taskQueue.shift();
    if (task) {
      task.status = 'active';
      task.startedAt = new Date().toISOString();
      this.activeTasks.set(task.id || task.startedAt, task);
    }
    return task;
  }

  complete(taskId) {
    const task = this.activeTasks.get(taskId);
    if (task) {
      task.status = 'completed';
      task.completedAt = new Date().toISOString();
      this.activeTasks.delete(taskId);
    }
    return task;
  }

  getQueueStatus() {
    return {
      queued: this.taskQueue.length,
      active: this.activeTasks.size,
      tasks: this.taskQueue.slice(0, 10).map(t => ({ id: t.id, priority: t.priority, status: t.status }))
    };
  }

  validateLimits(taskId, currentIterations, elapsedMinutes) {
    const task = this.activeTasks.get(taskId);
    if (!task) return { valid: true };
    if (currentIterations > task.maxIterations) {
      return { valid: false, reason: `Exceeded max iterations (${task.maxIterations})`, stop: true };
    }
    if (elapsedMinutes > task.maxTimeMinutes) {
      return { valid: false, reason: `Exceeded max time (${task.maxTimeMinutes} min)`, stop: true };
    }
    return { valid: true };
  }
}

module.exports = new PriorityScheduler();
