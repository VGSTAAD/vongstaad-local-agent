const IInstitutionalEconomics = require('../ports/IInstitutionalEconomics');
class FileInstitutionalEconomicsAdapter extends IInstitutionalEconomics {
  constructor(registry) { super(); this.registry = registry; this.budgets = new Map(); }
  _init() { if (this.budgets.size === 0) { const seats = this.registry.search('seat'); seats.forEach(s => this.budgets.set(s.id, { seatId: s.id, total: s.dailyBudget || 100, used: 0, remaining: s.dailyBudget || 100, history: [] })); } }
  consume(seatId, amount = 1) { this._init(); const b = this.budgets.get(seatId); if (!b) return { allowed: false }; if (b.remaining < amount) return { allowed: false, budget: b }; b.used += amount; b.remaining = b.total - b.used; b.history.push({ timestamp: new Date().toISOString(), amount, remaining: b.remaining }); return { allowed: true, budget: b }; }
  getStatus(seatId) { this._init(); return this.budgets.get(seatId) || { error: 'Seat not found' }; }
  getAllStatus() { this._init(); const s = {}; for (const [id, b] of this.budgets) s[id] = { used: b.used, total: b.total, remaining: b.remaining, utilization: ((b.used / b.total) * 100).toFixed(1) + '%' }; return s; }
}
module.exports = FileInstitutionalEconomicsAdapter;