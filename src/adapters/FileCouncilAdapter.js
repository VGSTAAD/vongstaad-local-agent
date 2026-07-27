const ICouncil = require('../ports/ICouncil');
const fs = require('fs');
const path = require('path');
class FileCouncilAdapter extends ICouncil {
  constructor() {
    super();
    this.COUNCIL_FILE = path.join(__dirname, '../../council-deliberations.json');
    if (!fs.existsSync(this.COUNCIL_FILE)) fs.writeFileSync(this.COUNCIL_FILE, '[]');
  }
  convene(topic, seats, maxRounds = 3) {
    const deliberations = JSON.parse(fs.readFileSync(this.COUNCIL_FILE, 'utf-8'));
    const id = `DELIB-${Date.now()}`;
    const delib = { id, topic, seats, maxRounds, startedAt: new Date().toISOString(), rounds: [], status: 'convened', conclusion: null };
    deliberations.push(delib);
    fs.writeFileSync(this.COUNCIL_FILE, JSON.stringify(deliberations, null, 2));
    return delib;
  }
  deliberate(deliberationId, seatId, statement) {
    const deliberations = JSON.parse(fs.readFileSync(this.COUNCIL_FILE, 'utf-8'));
    const delib = deliberations.find(d => d.id === deliberationId);
    if (!delib) return { error: 'Deliberation not found' };
    const roundIndex = delib.rounds.length;
    if (!delib.rounds[roundIndex]) delib.rounds[roundIndex] = [];
    delib.rounds[roundIndex].push({ seatId, statement, timestamp: new Date().toISOString() });
    if (delib.seats.every(s => delib.rounds[roundIndex].some(r => r.seatId === s)) && delib.rounds.length >= delib.maxRounds) {
      delib.status = 'completed';
      const all = delib.rounds.flat();
      const approve = all.filter(s => ['approve','support','recommend','proceed','healthy'].some(k => s.statement.toLowerCase().includes(k))).length;
      const reject = all.filter(s => ['reject','concern','risk','violation','warning'].some(k => s.statement.toLowerCase().includes(k))).length;
      delib.conclusion = { totalStatements: all.length, seatsParticipated: [...new Set(all.map(s => s.seatId))].length, approveSignals: approve, rejectSignals: reject, consensus: approve > reject ? 'approve' : reject > approve ? 'reject' : 'divided', summary: approve > reject ? 'Council reached consensus.' : reject > approve ? 'Council recommends rejection.' : 'Council is divided.' };
    }
    fs.writeFileSync(this.COUNCIL_FILE, JSON.stringify(deliberations, null, 2));
    return { success: true, deliberation: delib };
  }
  listDeliberations() { return JSON.parse(fs.readFileSync(this.COUNCIL_FILE, 'utf-8')); }
  getDeliberation(id) { return JSON.parse(fs.readFileSync(this.COUNCIL_FILE, 'utf-8')).find(d => d.id === id) || null; }
}
module.exports = FileCouncilAdapter;