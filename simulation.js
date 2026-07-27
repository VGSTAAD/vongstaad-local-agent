const fs = require('fs');
const path = require('path');

const SIM_FILE = path.join(__dirname, 'simulation-state.json');

class FounderAbsenceSimulation {
  constructor(ledger, stateEngine, observer, graph) {
    this.ledger = ledger;
    this.stateEngine = stateEngine;
    this.observer = observer;
    this.graph = graph;
  }

  start(label = 'Founder Absence Simulation') {
    if (fs.existsSync(SIM_FILE)) {
      const current = JSON.parse(fs.readFileSync(SIM_FILE, 'utf-8'));
      if (current.active) return { error: 'Simulation already active' };
    }

    const startSnapshot = this.stateEngine.capture('simulation-start');
    const sim = {
      active: true,
      startedAt: new Date().toISOString(),
      startSnapshotId: startSnapshot.state.id,
      label,
      dailyChecks: []
    };
    fs.writeFileSync(SIM_FILE, JSON.stringify(sim, null, 2));

    this.ledger.append({ type: 'SIMULATION_STARTED', label, snapshotId: startSnapshot.state.id });
    return { success: true, simulation: sim };
  }

  runDailyCheck() {
    if (!fs.existsSync(SIM_FILE)) return { error: 'No simulation active' };
    const sim = JSON.parse(fs.readFileSync(SIM_FILE, 'utf-8'));
    if (!sim.active) return { error: 'Simulation not active' };

    const observerReport = this.observer.generateReport();
    const currentState = this.stateEngine.capture('simulation-daily');
    const graphData = this.graph.getGraph();

    const check = {
      date: new Date().toISOString(),
      day: sim.dailyChecks.length + 1,
      observerReportId: observerReport.id,
      complexity: observerReport.complexity,
      drift: observerReport.drift,
      seatsActive: observerReport.seatHealth.filter(s => s.health === 'active').length,
      totalNodes: graphData.nodes.length,
      totalEdges: graphData.edges.length,
      backupStatus: this._checkBackup(),
      overallHealth: this._computeHealth(observerReport)
    };

    sim.dailyChecks.push(check);
    sim.lastCheck = new Date().toISOString();

    // After 30 days, mark as completed
    const daysElapsed = Math.floor((Date.now() - new Date(sim.startedAt).getTime()) / (1000 * 60 * 60 * 24));
    if (daysElapsed >= 30) {
      sim.active = false;
      sim.completedAt = new Date().toISOString();
      sim.result = this._generateFinalResult(sim);
      this.ledger.append({ type: 'SIMULATION_COMPLETED', result: sim.result });
    }

    fs.writeFileSync(SIM_FILE, JSON.stringify(sim, null, 2));
    this.ledger.append({ type: 'SIM_DAILY_CHECK', day: check.day, health: check.overallHealth });

    return { success: true, check, simulation: sim };
  }

  status() {
    if (!fs.existsSync(SIM_FILE)) return { active: false, message: 'No simulation found' };
    return JSON.parse(fs.readFileSync(SIM_FILE, 'utf-8'));
  }

  _checkBackup() {
    const backupDir = '/home/mhk/backups';
    if (!fs.existsSync(backupDir)) return 'unknown';
    const files = fs.readdirSync(backupDir).filter(f => f.startsWith('vongstaad-institution-'));
    if (files.length === 0) return 'missing';
    const latest = files.sort().reverse()[0];
    const stat = fs.statSync(path.join(backupDir, latest));
    const hoursAgo = (Date.now() - stat.mtimeMs) / (1000 * 60 * 60);
    return hoursAgo < 25 ? 'recent' : 'outdated';
  }

  _computeHealth(report) {
    const driftOk = report.drift.status === 'stable';
    const complexityOk = report.complexity.status === 'healthy';
    const seatsOk = report.seatHealth.every(s => s.health === 'active');
    if (driftOk && complexityOk && seatsOk) return 'excellent';
    if (driftOk && complexityOk) return 'good';
    return 'warning';
  }

  _generateFinalResult(sim) {
    const checks = sim.dailyChecks;
    if (checks.length === 0) return 'no data';
    const healthScores = checks.map(c => c.overallHealth === 'excellent' ? 3 : c.overallHealth === 'good' ? 2 : 1);
    const avg = healthScores.reduce((a, b) => a + b, 0) / healthScores.length;
    return {
      totalDays: checks.length,
      averageHealth: avg >= 2.5 ? 'excellent' : avg >= 1.5 ? 'good' : 'warning',
      passed: avg >= 2,
      message: avg >= 2
        ? 'The institution survived the Founder Absence Simulation. It maintained constitutional integrity and operational autonomy.'
        : 'The institution showed signs of degradation during the simulation. Review Observer reports for corrective action.'
    };
  }
}

module.exports = FounderAbsenceSimulation;
