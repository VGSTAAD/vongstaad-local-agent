const IObserver = require('../ports/IObserver');

class FileObserverAdapter extends IObserver {
  constructor(graph, ledger) {
    super();
    this.graph = graph;
    this.ledger = ledger;
  }

  generateReport() {
    const graphData = this.graph.getGraph();
    const ledgerEvents = this.ledger.query(() => true, 500);

    const complexity = this._measureComplexity(graphData);
    const drift = this._detectDrift(graphData);
    const seatHealth = this._assessSeats(graphData);
    const ledgerSummary = this._summarizeLedger(ledgerEvents);
    const recommendations = this._generateRecommendations(graphData, ledgerEvents);

    return {
      id: `OBS-${Date.now()}`,
      timestamp: new Date().toISOString(),
      complexity,
      drift,
      seatHealth,
      ledgerSummary,
      recommendations
    };
  }

  _measureComplexity(graph) {
    const nodes = graph.nodes.length;
    const edges = graph.edges.length;
    const seatCount = graph.nodes.filter(n => n.type === 'seat').length;
    const precedentCount = graph.nodes.filter(n => n.type === 'precedent').length;
    const ratio = edges / Math.max(nodes, 1);
    return { totalNodes: nodes, totalEdges: edges, seatCount, precedentCount, densityRatio: ratio.toFixed(2), status: ratio > 2 ? 'warning' : 'healthy' };
  }

  _detectDrift(graph) {
    const constitution = graph.nodes.find(n => n.type === 'constitution');
    const seats = graph.nodes.filter(n => n.type === 'seat');
    const warnings = [];
    for (const seat of seats) {
      const governed = graph.edges.some(e => e.source === seat.id && e.target === (constitution?.id || 'CONST-001') && e.relationship === 'governed_by');
      if (!governed) warnings.push(`Seat ${seat.id} is not governed by the constitution`);
    }
    return { status: warnings.length === 0 ? 'stable' : 'warning', warnings };
  }

  _assessSeats(graph) {
    const seats = graph.nodes.filter(n => n.type === 'seat');
    return seats.map(seat => {
      const hasAppointment = graph.edges.some(e => e.relationship === 'occupies' && e.target === seat.id);
      return { seatId: seat.id, label: seat.label, occupied: hasAppointment, health: hasAppointment ? 'active' : 'vacant' };
    });
  }

  _summarizeLedger(events) {
    const types = {};
    for (const event of events) { types[event.type] = (types[event.type] || 0) + 1; }
    return { totalEvents: events.length, types };
  }

  _generateRecommendations(graph, events) {
    const recommendations = [];
    const seats = graph.nodes.filter(n => n.type === 'seat');
    const occupiedSeats = seats.filter(seat => graph.edges.some(e => e.relationship === 'occupies' && e.target === seat.id));
    if (occupiedSeats.length < seats.length) recommendations.push(`${seats.length - occupiedSeats.length} seats vacant`);
    const reviewEvents = events.filter(e => e.type === 'CODE_REVIEW');
    if (reviewEvents.length > 0) {
      const recent = reviewEvents[reviewEvents.length - 1];
      if (Date.now() - new Date(recent.timestamp).getTime() > 3600000) recommendations.push('No recent code review');
    }
    return recommendations;
  }
}
module.exports = FileObserverAdapter;
