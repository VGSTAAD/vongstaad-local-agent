const fs = require('fs');

class PolicyEngine {
  constructor(registry, constitution) {
    this.registry = registry;
    this.constitution = constitution;
  }

  evaluate(action, seatId) {
    // Founder override — the admin chat's API key maps to full authority
    if (seatId === 'FOUNDER') return { allowed: true, reason: 'Founder authority', requiresApproval: false, sandboxOnly: false };

    // Get the seat
    const seat = this.registry.get('seat', seatId);
    if (!seat) return { allowed: false, reason: `Seat ${seatId} not found`, requiresApproval: false, sandboxOnly: false };

    // Check constitutional forbidden actions
    const forbiddenActions = this.constitution?.forbiddenActions || [];
    const actionVerb = action.split(':')[0]; // e.g., "merge" from "merge:branch"
    if (forbiddenActions.includes(actionVerb)) {
      return { allowed: false, reason: `Action "${actionVerb}" is constitutionally forbidden`, requiresApproval: false, sandboxOnly: false };
    }

    // Check seat authority
    const allowedActions = seat.allowedActions || [];
    if (allowedActions.includes(action)) {
      return { allowed: true, reason: 'Authorized', requiresApproval: false, sandboxOnly: false };
    }

    // If not explicitly allowed, deny
    return { allowed: false, reason: `Action "${action}" not in seat authority`, requiresApproval: true, sandboxOnly: false };
  }
}

module.exports = PolicyEngine;
