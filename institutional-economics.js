class InstitutionalEconomics {
  constructor(registry) {
    this.registry = registry;
    this.budgets = new Map();
  }

  initialize() {
    const seats = this.registry.search('seat');
    for (const seat of seats) {
      const budget = seat.dailyBudget || 100;
      this.budgets.set(seat.id, {
        seatId: seat.id,
        total: budget,
        used: 0,
        remaining: budget,
        history: []
      });
    }
    return this.budgets.size;
  }

  consume(seatId, amount = 1) {
    if (!this.budgets.has(seatId)) {
      this.initialize();
      if (!this.budgets.has(seatId)) return { allowed: false, reason: 'Seat not found' };
    }

    const budget = this.budgets.get(seatId);
    if (budget.remaining < amount) {
      return {
        allowed: false,
        reason: `Budget exhausted — used ${budget.used}/${budget.total}`,
        budget
      };
    }

    budget.used += amount;
    budget.remaining = budget.total - budget.used;
    budget.history.push({
      timestamp: new Date().toISOString(),
      amount,
      remaining: budget.remaining
    });

    return { allowed: true, budget };
  }

  getStatus(seatId) {
    if (!this.budgets.has(seatId)) {
      this.initialize();
    }
    return this.budgets.get(seatId) || { error: 'Seat not found' };
  }

  getAllStatus() {
    if (this.budgets.size === 0) this.initialize();
    const status = {};
    for (const [id, budget] of this.budgets) {
      status[id] = {
        used: budget.used,
        total: budget.total,
        remaining: budget.remaining,
        utilization: ((budget.used / budget.total) * 100).toFixed(1) + '%'
      };
    }
    return status;
  }
}

module.exports = InstitutionalEconomics;
