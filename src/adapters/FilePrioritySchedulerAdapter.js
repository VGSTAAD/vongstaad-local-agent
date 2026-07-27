const IPriorityScheduler = require('../ports/IPriorityScheduler');
const CLASSES = { CRITICAL: { maxIterations: 50, maxTimeMinutes: 30 }, HIGH: { maxIterations: 25, maxTimeMinutes: 15 }, NORMAL: { maxIterations: 10, maxTimeMinutes: 5 }, LOW: { maxIterations: 5, maxTimeMinutes: 2 }, RESEARCH: { maxIterations: 5, maxTimeMinutes: 5 } };
class FilePrioritySchedulerAdapter extends IPriorityScheduler {
  constructor() { super(); this.queue = []; this.active = new Map(); }
  enqueue(task) { const p = CLASSES[task.priority] ? task.priority : 'NORMAL'; const limits = CLASSES[p]; const t = { ...task, priority: p, maxIterations: task.maxIterations || limits.maxIterations, maxTimeMinutes: task.maxTimeMinutes || limits.maxTimeMinutes, createdAt: new Date().toISOString(), status: 'queued' }; this.queue.push(t); this.queue.sort((a, b) => ['CRITICAL','HIGH','NORMAL','LOW','RESEARCH'].indexOf(a.priority) - ['CRITICAL','HIGH','NORMAL','LOW','RESEARCH'].indexOf(b.priority)); return t; }
  dequeue() { const t = this.queue.shift(); if (t) { t.status = 'active'; t.startedAt = new Date().toISOString(); this.active.set(t.id || t.startedAt, t); } return t; }
  complete(taskId) { const t = this.active.get(taskId); if (t) { t.status = 'completed'; t.completedAt = new Date().toISOString(); this.active.delete(taskId); } return t; }
  getQueueStatus() { return { queued: this.queue.length, active: this.active.size, tasks: this.queue.slice(0, 10).map(t => ({ id: t.id, priority: t.priority, status: t.status })) }; }
  validateLimits(taskId, iters, mins) { const t = this.active.get(taskId); if (!t) return { valid: true }; if (iters > t.maxIterations) return { valid: false, reason: `Exceeded max iterations (${t.maxIterations})`, stop: true }; if (mins > t.maxTimeMinutes) return { valid: false, reason: `Exceeded max time (${t.maxTimeMinutes} min)`, stop: true }; return { valid: true }; }
}
module.exports = FilePrioritySchedulerAdapter;