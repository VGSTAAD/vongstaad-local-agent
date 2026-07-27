const fs = require('fs');
const path = require('path');

const WORKFLOW_DIR = path.join(__dirname, 'workflows');

class WorkflowEngine {
  constructor(registry, ledger, graph) {
    this.registry = registry;
    this.ledger = ledger;
    this.graph = graph;
    if (!fs.existsSync(WORKFLOW_DIR)) fs.mkdirSync(WORKFLOW_DIR, { recursive: true });
  }

  initiate(title, description, initiator, steps = []) {
    const id = `WF-${Date.now()}`;
    const workflow = {
      id,
      title,
      description,
      initiator,
      status: 'initiated',
      createdAt: new Date().toISOString(),
      steps: steps.length > 0 ? steps : this._defaultSteps(),
      currentStep: 0,
      artifacts: [],
      discussion: []
    };
    fs.writeFileSync(path.join(WORKFLOW_DIR, `${id}.json`), JSON.stringify(workflow, null, 2));
    this.ledger.append({ type: 'WORKFLOW_INITIATED', workflowId: id, title, initiator });
    return workflow;
  }

  _defaultSteps() {
    return [
      { name: 'discussion', status: 'pending', required: true },
      { name: 'dcp', status: 'pending', required: true },
      { name: 'council', status: 'pending', required: false },
      { name: 'approval', status: 'pending', required: true },
      { name: 'deployment', status: 'pending', required: false },
      { name: 'certification', status: 'pending', required: false },
      { name: 'complete', status: 'pending', required: false }
    ];
  }

  advanceStep(workflowId, stepName, artifact = null) {
    const file = path.join(WORKFLOW_DIR, `${workflowId}.json`);
    if (!fs.existsSync(file)) return { error: 'Workflow not found' };
    const workflow = JSON.parse(fs.readFileSync(file, 'utf-8'));

    // Find the step index
    const stepIndex = workflow.steps.findIndex(s => s.name === stepName);
    if (stepIndex === -1) return { error: `Step "${stepName}" not found` };
    if (workflow.steps[stepIndex].status === 'completed') {
      return { error: `Step "${stepName}" already completed` };
    }

    // Mark step as completed
    workflow.steps[stepIndex].status = 'completed';
    workflow.steps[stepIndex].completedAt = new Date().toISOString();
    if (artifact) {
      workflow.artifacts.push({ step: stepName, artifact, timestamp: new Date().toISOString() });
    }

    // If this was the last step, complete the workflow
    const remaining = workflow.steps.filter(s => s.required && s.status !== 'completed');
    if (remaining.length === 0) {
      workflow.status = 'completed';
      workflow.completedAt = new Date().toISOString();
    } else {
      workflow.currentStep = workflow.steps.findIndex(s => s.required && s.status !== 'completed');
    }

    fs.writeFileSync(file, JSON.stringify(workflow, null, 2));
    this.ledger.append({ type: 'WORKFLOW_STEP_COMPLETED', workflowId, step: stepName });

    return { success: true, workflow };
  }

  addDiscussion(workflowId, seatId, message) {
    const file = path.join(WORKFLOW_DIR, `${workflowId}.json`);
    if (!fs.existsSync(file)) return { error: 'Workflow not found' };
    const workflow = JSON.parse(fs.readFileSync(file, 'utf-8'));

    workflow.discussion.push({
      seatId,
      message,
      timestamp: new Date().toISOString()
    });
    workflow.steps[0].status = 'in-progress';

    fs.writeFileSync(file, JSON.stringify(workflow, null, 2));
    return { success: true, workflow };
  }

  listWorkflows() {
    if (!fs.existsSync(WORKFLOW_DIR)) return [];
    return fs.readdirSync(WORKFLOW_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => JSON.parse(fs.readFileSync(path.join(WORKFLOW_DIR, f), 'utf-8')))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getWorkflow(workflowId) {
    const file = path.join(WORKFLOW_DIR, `${workflowId}.json`);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  }
}

module.exports = WorkflowEngine;
