const fs = require('fs');
const path = require('path');

const COUNCIL_FILE = path.join(__dirname, 'council-deliberations.json');

class Council {
  constructor(registry, ledger, graph, observer) {
    this.registry = registry;
    this.ledger = ledger;
    this.graph = graph;
    this.observer = observer;
    if (!fs.existsSync(COUNCIL_FILE)) fs.writeFileSync(COUNCIL_FILE, JSON.stringify([], null, 2));
  }

  convene(topic, seats, maxRounds = 3) {
    const id = `DELIB-${Date.now()}`;
    const deliberation = {
      id,
      topic,
      seats,
      maxRounds,
      startedAt: new Date().toISOString(),
      rounds: [],
      status: 'convened',
      conclusion: null
    };

    const deliberations = JSON.parse(fs.readFileSync(COUNCIL_FILE, 'utf-8'));
    deliberations.push(deliberation);
    fs.writeFileSync(COUNCIL_FILE, JSON.stringify(deliberations, null, 2));

    this.ledger.append({ type: 'COUNCIL_CONVENED', deliberationId: id, topic, seats });
    return deliberation;
  }

  deliberate(deliberationId, seatId, statement) {
    const deliberations = JSON.parse(fs.readFileSync(COUNCIL_FILE, 'utf-8'));
    const delib = deliberations.find(d => d.id === deliberationId);
    if (!delib) return { error: 'Deliberation not found' };
    if (delib.status !== 'convened' && delib.status !== 'in-progress') {
      return { error: 'Deliberation is not active' };
    }

    const currentRound = delib.rounds.length;
    const roundIndex = currentRound === 0 ? 0 : currentRound;

    if (!delib.rounds[roundIndex]) {
      delib.rounds[roundIndex] = [];
    }

    delib.rounds[roundIndex].push({
      seatId,
      statement,
      timestamp: new Date().toISOString()
    });
    delib.status = 'in-progress';

    // Check if all seats have spoken in this round
    const speakersThisRound = delib.rounds[roundIndex].map(s => s.seatId);
    const allSpoken = delib.seats.every(s => speakersThisRound.includes(s));

    if (allSpoken && delib.rounds.length >= delib.maxRounds) {
      delib.status = 'completed';
      delib.conclusion = this._generateConclusion(delib);
      this.ledger.append({
        type: 'COUNCIL_CONCLUDED',
        deliberationId,
        conclusion: delib.conclusion.summary
      });
    }

    fs.writeFileSync(COUNCIL_FILE, JSON.stringify(deliberations, null, 2));
    this.ledger.append({ type: 'COUNCIL_STATEMENT', deliberationId, seatId });

    return { success: true, deliberation: delib };
  }

  _generateConclusion(delib) {
    const allStatements = delib.rounds.flat();
    const seatCount = delib.seats.length;

    // Analyze sentiment (simple keyword analysis)
    const approveKeywords = ['approve', 'support', 'recommend', 'proceed', 'healthy'];
    const rejectKeywords = ['reject', 'concern', 'risk', 'violation', 'warning', 'issue'];

    let approveCount = 0;
    let rejectCount = 0;

    for (const s of allStatements) {
      const text = s.statement.toLowerCase();
      if (approveKeywords.some(k => text.includes(k))) approveCount++;
      if (rejectKeywords.some(k => text.includes(k))) rejectCount++;
    }

    const consensus = approveCount > rejectCount ? 'approve' :
                      rejectCount > approveCount ? 'reject' : 'divided';

    return {
      totalStatements: allStatements.length,
      seatsParticipated: [...new Set(allStatements.map(s => s.seatId))].length,
      approveSignals: approveCount,
      rejectSignals: rejectCount,
      consensus,
      summary: consensus === 'approve'
        ? `Council reached consensus to proceed on: ${delib.topic}`
        : consensus === 'reject'
        ? `Council recommends rejection of: ${delib.topic}`
        : `Council is divided on: ${delib.topic}`
    };
  }

  listDeliberations() {
    return JSON.parse(fs.readFileSync(COUNCIL_FILE, 'utf-8'));
  }

  getDeliberation(deliberationId) {
    const deliberations = JSON.parse(fs.readFileSync(COUNCIL_FILE, 'utf-8'));
    return deliberations.find(d => d.id === deliberationId) || null;
  }
}

module.exports = Council;
