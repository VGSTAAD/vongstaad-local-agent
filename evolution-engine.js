const fs = require('fs');
const path = require('path');

const PROPOSALS_DIR = path.join(__dirname, 'evolution-proposals');

class EvolutionEngine {
  constructor(registry, ledger, stateEngine, observer) {
    this.registry = registry;
    this.ledger = ledger;
    this.stateEngine = stateEngine;
    this.observer = observer;
    if (!fs.existsSync(PROPOSALS_DIR)) fs.mkdirSync(PROPOSALS_DIR, { recursive: true });
  }

  propose({ title, description, proposer, type, changes }) {
    const id = `PROP-${Date.now()}`;
    const proposal = {
      id,
      title,
      description,
      proposer,
      type,
      changes,
      status: 'proposed',
      createdAt: new Date().toISOString(),
      simulations: [],
      evaluations: [],
      ratification: null
    };
    fs.writeFileSync(path.join(PROPOSALS_DIR, `${id}.json`), JSON.stringify(proposal, null, 2));
    this.ledger.append({ type: 'PROPOSAL_CREATED', proposalId: id, title, proposer });
    return proposal;
  }

  simulate(proposalId) {
    const file = path.join(PROPOSALS_DIR, `${proposalId}.json`);
    if (!fs.existsSync(file)) return { error: 'Proposal not found' };
    const proposal = JSON.parse(fs.readFileSync(file, 'utf-8'));

    // Capture current state before simulation
    const preSimState = this.stateEngine.capture(`pre-simulation of ${proposalId}`);
    
    // Run Observer to check health after simulated change
    const observerReport = this.observer.generateReport();
    
    const simulation = {
      id: `SIM-${Date.now()}`,
      proposalId,
      preSimStateId: preSimState.state.id,
      timestamp: new Date().toISOString(),
      observerReport: {
        complexity: observerReport.complexity,
        drift: observerReport.drift
      },
      result: observerReport.drift.status === 'stable' && observerReport.complexity.status === 'healthy' ? 'passed' : 'warning'
    };

    proposal.simulations.push(simulation);
    proposal.status = 'simulated';
    fs.writeFileSync(file, JSON.stringify(proposal, null, 2));
    this.ledger.append({ type: 'PROPOSAL_SIMULATED', proposalId, simulationId: simulation.id, result: simulation.result });

    return { success: true, simulation, proposal };
  }

  evaluate(proposalId) {
    const file = path.join(PROPOSALS_DIR, `${proposalId}.json`);
    if (!fs.existsSync(file)) return { error: 'Proposal not found' };
    const proposal = JSON.parse(fs.readFileSync(file, 'utf-8'));

    // Simple evaluation: check all simulations passed
    const allPassed = proposal.simulations.every(s => s.result === 'passed');
    const evaluation = {
      id: `EVAL-${Date.now()}`,
      proposalId,
      timestamp: new Date().toISOString(),
      simulations: proposal.simulations.length,
      allPassed,
      recommendation: allPassed ? 'approve' : 'revise',
      comments: allPassed ? 'All simulations passed. Ready for ratification.' : 'Some simulations raised warnings. Review before proceeding.'
    };

    proposal.evaluations.push(evaluation);
    proposal.status = allPassed ? 'evaluated' : 'needs_revision';
    fs.writeFileSync(file, JSON.stringify(proposal, null, 2));
    this.ledger.append({ type: 'PROPOSAL_EVALUATED', proposalId, evaluationId: evaluation.id, recommendation: evaluation.recommendation });

    return { success: true, evaluation, proposal };
  }

  ratify(proposalId, authorizedBy = 'Founder') {
    const file = path.join(PROPOSALS_DIR, `${proposalId}.json`);
    if (!fs.existsSync(file)) return { error: 'Proposal not found' };
    const proposal = JSON.parse(fs.readFileSync(file, 'utf-8'));

    if (proposal.status !== 'evaluated') return { error: 'Proposal must be evaluated before ratification' };

    proposal.ratification = {
      id: `RAT-${Date.now()}`,
      proposalId,
      authorizedBy,
      timestamp: new Date().toISOString()
    };
    proposal.status = 'ratified';

    // Capture post-ratification state
    this.stateEngine.capture(`post-ratification of ${proposalId}`);

    fs.writeFileSync(file, JSON.stringify(proposal, null, 2));
    this.ledger.append({ type: 'PROPOSAL_RATIFIED', proposalId, authorizedBy });

    return { success: true, proposal };
  }

  listProposals() {
    if (!fs.existsSync(PROPOSALS_DIR)) return [];
    return fs.readdirSync(PROPOSALS_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => JSON.parse(fs.readFileSync(path.join(PROPOSALS_DIR, f), 'utf-8')))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getProposal(proposalId) {
    const file = path.join(PROPOSALS_DIR, `${proposalId}.json`);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  }
}

module.exports = EvolutionEngine;
