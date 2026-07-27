const IEvolution = require('../ports/IEvolution');
const fs = require('fs');
const path = require('path');

class FileEvolutionAdapter extends IEvolution {
  constructor(registry, ledger, stateEngine, observer) {
    super();
    this.registry = registry;
    this.ledger = ledger;
    this.stateEngine = stateEngine;
    this.observer = observer;
    this.PROPOSALS_DIR = path.join(__dirname, '../../evolution-proposals');
    if (!fs.existsSync(this.PROPOSALS_DIR)) fs.mkdirSync(this.PROPOSALS_DIR, { recursive: true });
  }

  propose({ title, description, proposer, type, changes }) {
    const id = `PROP-${Date.now()}`;
    const proposal = { id, title, description, proposer, type, changes, status: 'proposed', createdAt: new Date().toISOString(), simulations: [], evaluations: [], ratification: null };
    fs.writeFileSync(path.join(this.PROPOSALS_DIR, `${id}.json`), JSON.stringify(proposal, null, 2));
    this.ledger.append({ type: 'PROPOSAL_CREATED', proposalId: id, title, proposer });
    return proposal;
  }

  simulate(proposalId) {
    const file = path.join(this.PROPOSALS_DIR, `${proposalId}.json`);
    if (!fs.existsSync(file)) return { error: 'Proposal not found' };
    const proposal = JSON.parse(fs.readFileSync(file, 'utf-8'));
    const preSimState = this.stateEngine.capture(`pre-simulation of ${proposalId}`);
    const observerReport = this.observer.generateReport();
    const simulation = { id: `SIM-${Date.now()}`, proposalId, preSimStateId: preSimState.state.id, timestamp: new Date().toISOString(), observerReport: { complexity: observerReport.complexity, drift: observerReport.drift }, result: observerReport.drift.status === 'stable' && observerReport.complexity.status === 'healthy' ? 'passed' : 'warning' };
    proposal.simulations.push(simulation);
    proposal.status = 'simulated';
    fs.writeFileSync(file, JSON.stringify(proposal, null, 2));
    this.ledger.append({ type: 'PROPOSAL_SIMULATED', proposalId, simulationId: simulation.id, result: simulation.result });
    return { success: true, simulation, proposal };
  }

  evaluate(proposalId) {
    const file = path.join(this.PROPOSALS_DIR, `${proposalId}.json`);
    if (!fs.existsSync(file)) return { error: 'Proposal not found' };
    const proposal = JSON.parse(fs.readFileSync(file, 'utf-8'));
    const allPassed = proposal.simulations.every(s => s.result === 'passed');
    const evaluation = { id: `EVAL-${Date.now()}`, proposalId, timestamp: new Date().toISOString(), simulations: proposal.simulations.length, allPassed, recommendation: allPassed ? 'approve' : 'revise', comments: allPassed ? 'All simulations passed. Ready for ratification.' : 'Some simulations raised warnings.' };
    proposal.evaluations.push(evaluation);
    proposal.status = allPassed ? 'evaluated' : 'needs_revision';
    fs.writeFileSync(file, JSON.stringify(proposal, null, 2));
    this.ledger.append({ type: 'PROPOSAL_EVALUATED', proposalId, evaluationId: evaluation.id, recommendation: evaluation.recommendation });
    return { success: true, evaluation, proposal };
  }

  ratify(proposalId, authorizedBy = 'Founder') {
    const file = path.join(this.PROPOSALS_DIR, `${proposalId}.json`);
    if (!fs.existsSync(file)) return { error: 'Proposal not found' };
    const proposal = JSON.parse(fs.readFileSync(file, 'utf-8'));
    if (proposal.status !== 'evaluated') return { error: 'Proposal must be evaluated before ratification' };
    proposal.ratification = { id: `RAT-${Date.now()}`, proposalId, authorizedBy, timestamp: new Date().toISOString() };
    proposal.status = 'ratified';
    this.stateEngine.capture(`post-ratification of ${proposalId}`);
    fs.writeFileSync(file, JSON.stringify(proposal, null, 2));
    this.ledger.append({ type: 'PROPOSAL_RATIFIED', proposalId, authorizedBy });
    return { success: true, proposal };
  }

  listProposals() {
    if (!fs.existsSync(this.PROPOSALS_DIR)) return [];
    return fs.readdirSync(this.PROPOSALS_DIR).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(path.join(this.PROPOSALS_DIR, f), 'utf-8'))).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getProposal(proposalId) {
    const file = path.join(this.PROPOSALS_DIR, `${proposalId}.json`);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  }
}
module.exports = FileEvolutionAdapter;
