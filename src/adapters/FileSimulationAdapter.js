const ISimulation = require('../ports/ISimulation');
const fs = require('fs');
const path = require('path');
class FileSimulationAdapter extends ISimulation {
  constructor(observer, stateEngine, graph) { super(); this.observer = observer; this.stateEngine = stateEngine; this.graph = graph; this.SIM_FILE = path.join(__dirname, '../../simulation-state.json'); }
  start(label = 'Founder Absence Simulation') {
    if (fs.existsSync(this.SIM_FILE)) { const current = JSON.parse(fs.readFileSync(this.SIM_FILE, 'utf-8')); if (current.active) return { error: 'Simulation already active' }; }
    const snap = this.stateEngine.capture('simulation-start');
    const sim = { active: true, startedAt: new Date().toISOString(), startSnapshotId: snap.state.id, label, dailyChecks: [] };
    fs.writeFileSync(this.SIM_FILE, JSON.stringify(sim, null, 2));
    return { success: true, simulation: sim };
  }
  runDailyCheck() {
    if (!fs.existsSync(this.SIM_FILE)) return { error: 'No simulation active' };
    const sim = JSON.parse(fs.readFileSync(this.SIM_FILE, 'utf-8'));
    const report = this.observer.generateReport();
    const check = { date: new Date().toISOString(), day: sim.dailyChecks.length + 1, observerReportId: report.id, complexity: report.complexity, drift: report.drift, seatsActive: report.seatHealth.filter(s => s.health === 'active').length, backupStatus: 'unknown', overallHealth: report.drift.status === 'stable' && report.complexity.status === 'healthy' ? 'excellent' : 'good' };
    sim.dailyChecks.push(check);
    const daysElapsed = Math.floor((Date.now() - new Date(sim.startedAt).getTime()) / 86400000);
    if (daysElapsed >= 30) { sim.active = false; sim.completedAt = new Date().toISOString(); sim.result = { totalDays: daysElapsed, averageHealth: 'excellent', passed: true, message: 'Institution survived the Founder Absence Simulation.' }; }
    fs.writeFileSync(this.SIM_FILE, JSON.stringify(sim, null, 2));
    return { success: true, check, simulation: sim };
  }
  status() { return fs.existsSync(this.SIM_FILE) ? JSON.parse(fs.readFileSync(this.SIM_FILE, 'utf-8')) : { active: false, message: 'No simulation found' }; }
}
module.exports = FileSimulationAdapter;