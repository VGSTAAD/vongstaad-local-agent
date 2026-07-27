const IResourceGovernor = require('../ports/IResourceGovernor');
class FileResourceGovernorAdapter extends IResourceGovernor {
  constructor(geminiTracker) { super(); this.tracker = geminiTracker; }
  getAction() { const report = this.tracker.getUsageReport(); const pred = this.tracker.predictExhaustion(); if (report.risk === 'HIGH' || (pred.willExhaust && pred.hoursRemaining < 6)) return { action: 'THROTTLE', message: 'Quota critical.', affectedOperations: ['academy','council','auto_review'], prediction: pred }; if (report.risk === 'MEDIUM' || (pred.willExhaust && pred.hoursRemaining < 12)) return { action: 'REDUCE', message: 'Quota elevated.', affectedOperations: ['academy'], prediction: pred }; return { action: 'NORMAL', message: 'Quota normal.', prediction: pred }; }
  shouldThrottle() { return this.getAction().action === 'THROTTLE'; }
  shouldReduce() { const a = this.getAction().action; return a === 'THROTTLE' || a === 'REDUCE'; }
}
module.exports = FileResourceGovernorAdapter;