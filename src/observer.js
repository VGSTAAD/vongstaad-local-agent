const fs = require('fs');

class InstitutionalObserver {
  constructor(graph, ledger) {
    this.graph = graph;
    this.ledger = ledger;
  }

  generateReport() {
    const graphData = this.graph.getGraph();
    const ledgerEvents = this.ledger.query(() => true, 500);

    return {
      id: `OBS-${Date.now()}`,
      timestamp: new Date().toISOString(),
      complexity: this._measureComplexity(graphData),
      drift: this._detectDrift(graphData),
      seatHealth: this._assessSeats(graphData),
      ledgerSummary: this._summarizeLedger(ledgerEvents),
      recommendations: this._generateRecommendations(graphData, ledgerEvents)
    };
  }

  _measureComplexity(graph) {
    const nodes = graph.nodes.length;
    const edges = graph.edges.length;
    const seatCount = graph.nodes.filter(n => n.type === 'seat').length;
    const precedentCount = graph.nodes.filter(n => n.type === 'precedent').length;
    const ratio = edges / Math.max(nodes, 1);
    return {
      totalNodes: nodes,
      totalEdges: edges,
      seatCount,
      precedentCount,
      densityRatio: ratio.toFixed(2),
      status: ratio > 2 ? 'warning' : 'healthy'
    };
  }

  _detectDrift(graph) {
    const constitution = graph.nodes.find(n => n.type === 'constitution');
    const seats = graph.nodes.filter(n => n.type === 'seat');
    const warnings = [];

    // Check all seats are governed by constitution
    for (const seat of seats) {
      const governed = graph.edges.some(e => 
        e.source === seat.id && e.target === (constitution?.id || 'CONST-001') && e.relationship === 'governed_by'
      );
      if (!governed) warnings.push(`Seat ${seat.id} is not governed by the constitution`);
    }

    // Check for appointments without seats
    const appointments = graph.nodes.filter(n => n.type === 'appointment');
    for (const apt of appointments) {
      const hasSeat = graph.edges.some(e => e.source === apt.id && e.relationship === 'occupies');
      if (!hasSeat) warnings.push(`Appointment ${apt.id} has no seat association`);
    }

    return {
      status: warnings.length === 0 ? 'stable' : 'warning',
      warnings
    };
  }

  _assessSeats(graph) {
    const seats = graph.nodes.filter(n => n.type === 'seat');
    return seats.map(seat => {
      const hasAppointment = graph.edges.some(e => 
        e.relationship === 'occupies' && e.target === seat.id
      );
      return {
        seatId: seat.id,
        label: seat.label,
        occupied: hasAppointment,
        health: hasAppointment ? 'active' : 'vacant'
      };
    });
  }

  _summarizeLedger(events) {
    const types = {};
    for (const event of events) {
      types[event.type] = (types[event.type] || 0) + 1;
    }
    return {
      totalEvents: events.length,
      types
    };
  }

  _generateRecommendations(graph, events) {
    const recommendations = [];
    const seats = graph.nodes.filter(n => n.type === 'seat');
    const occupiedSeats = seats.filter(seat => 
      graph.edges.some(e => e.relationship === 'occupies' && e.target === seat.id)
    );

    if (occupiedSeats.length < seats.length) {
      recommendations.push(`${seats.length - occupiedSeats.length} seats are vacant — consider appointing occupants`);
    }

    const reviewEvents = events.filter(e => e.type === 'CODE_REVIEW');
    if (reviewEvents.length > 0) {
      const recentReview = reviewEvents[reviewEvents.length - 1];
      const oneHourAgo = Date.now() - 3600000;
      if (new Date(recentReview.timestamp).getTime() < oneHourAgo) {
        recommendations.push('No code review in the last hour — consider running autonomous review');
      }
    }

    return recommendations;
  }
}

module.exports = InstitutionalObserver;
