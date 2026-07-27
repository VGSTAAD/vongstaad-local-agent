const express = require('express');
const { exec } = require('child_process');
const app = express();
app.use(express.json());

// CORS handler – must be BEFORE the Policy Engine
app.use((req, res, next) => {
  const origin = req.headers.origin || '*';
  res.header('Access-Control-Allow-Origin', origin);
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, apiKey, Authorization, X-Admin-Secret');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

// --- Policy Engine Middleware ---
app.use((req, res, next) => {
  // Skip policy check for GET, OPTIONS requests and health/status endpoints
  if (req.method === 'GET' || req.method === 'OPTIONS' || req.path === '/status' || req.path === '/health') return next();

  const apiKey = req.body?.apiKey;
  // Founder override
  if (apiKey === 'vongstaad-dev-2026') {
    req.seatId = 'FOUNDER';
    return next();
  }

  const seatId = req.body?.seatId || 'UNKNOWN';
  const action = req.body?.action || req.path.replace(/^\//, '').replace(/\//g, ':');

  const result = policyEngine.evaluate(action, seatId);
  if (!result.allowed) {
    return res.status(403).json({ error: result.reason, requiresApproval: result.requiresApproval });
  }
  req.seatId = seatId;
  next();
});


const API_KEY = 'vongstaad-dev-2026';

app.post('/run', (req, res) => {
  const { apiKey, cwd, command } = req.body;
  if (apiKey !== API_KEY) return res.status(401).json({ error: 'Unauthorized' });

  exec(command, { cwd, timeout: 120000 }, (err, stdout, stderr) => {
    res.json({ ok: !err, stdout, stderr, exitCode: err ? err.code : 0 });
  });
});

app.get('/status', (req, res) => res.json({ online: true }));
// --- Agent Loop Endpoint ---
const { agentService } = require('./agent-service');

app.post('/agent-loop', async (req, res) => {
  const { apiKey, roomId, task, agents, maxTurns } = req.body;
  
  if (apiKey !== 'vongstaad-dev-2026') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const messages = await agentService.runLoop(
      roomId,
      task,
      agents || [
        { name: 'DevBot', systemPrompt: 'You are a developer assistant.' },
        { name: 'ReviewerBot', systemPrompt: 'You review code changes.' }
      ],
      maxTurns || 5
    );
    res.json({ success: true, messages });
  } catch (err) {
    console.error('Agent loop error:', err);
    res.status(500).json({ error: err.message });
  }
});


// --- Registry Endpoints ---
const registry = require('./registry');
const PolicyEngine = require('./policy-engine');

app.post('/registry/create', (req, res) => {
  const { apiKey, type, id, ...data } = req.body;
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  try {
    const record = registry.create(type, id, data);
    res.json({ success: true, record });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/registry/search/:type', (req, res) => {
  const results = registry.search(req.params.type, req.query || {});
  res.json(results);
});

app.get('/registry/:type/:id', (req, res) => {
  const record = registry.get(req.params.type, req.params.id);
  if (!record) return res.status(404).json({ error: 'Not found' });
  res.json(record);
});


// --- Event Ledger Endpoints ---
const ledger = require('./event-ledger');

app.post('/ledger/append', (req, res) => {
  const { apiKey, ...event } = req.body;
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  const record = ledger.append(event);
  res.json({ success: true, record });
});

app.get('/ledger/query', (req, res) => {
  const { type, seatId, limit } = req.query;
  const filterFn = (e) => {
    if (type && e.type !== type) return false;
    if (seatId && e.seatId !== seatId) return false;
    return true;
  };
  const events = ledger.query(filterFn, parseInt(limit) || 100);
  res.json(events);
});
// --- DCP Endpoint ---

app.post('/dcp/generate', (req, res) => {
  const { apiKey, ...params } = req.body;
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  try {
    const dcp = DecisionContextPackage.generate(params);
    res.json({ success: true, dcp });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
// --- Academy Endpoints ---
const Academy = require('./academy');
const academy = new Academy(registry, ledger);

app.post('/academy/evaluate', async (req, res) => {
  const { apiKey, seatId, occupantId, promptVersion, knowledgePackIds } = req.body;
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  try {
    // Use the Gemini adapter from agent-service
    const { agentService } = require('./agent-service');
    const adapter = async (input) => {
      const messages = [
        { role: 'system', text: `You are a Code Reviewer occupying seat ${seatId}.` },
        { role: 'user', text: `Review this diff and return JSON: ${JSON.stringify(input)}` }
      ];
      const result = await agentService.llm.complete('CodeReviewer', messages);
      try { return JSON.parse(result); } catch { return { recommendation: 'review', violations: [] }; }
    };
    
    const result = await academy.evaluate({
      seatId, occupantId, promptVersion, knowledgePackIds, adapter
    });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/academy/cases', (req, res) => {
  const { apiKey, seatId, ...caseData } = req.body;
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  try {
    const record = academy.addCase(seatId, caseData);
    res.json({ success: true, record });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
// --- Constitutional Compiler Endpoint ---
const ConstitutionalCompiler = require('./compiler');
const compiler = new ConstitutionalCompiler('./constitution.json');
const policyEngine = new PolicyEngine(registry, JSON.parse(require('fs').readFileSync('./constitution.json', 'utf-8')));

app.post('/compiler/validate', (req, res) => {
  const { apiKey, ...config } = req.body;
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  try {
    const result = compiler.compile(config);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
// --- Autonomous Seat Operation ---

const DecisionContextPackage = require('./dcp');
app.post('/seat/review', async (req, res) => {
  const { apiKey, seatId, occupantId, promptVersion, knowledgePackIds, diff, commitMessage } = req.body;
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });

  try {
    // 1. Compile the configuration
    const seat = registry.get('seat', seatId);
    if (!seat) return res.status(404).json({ error: `Seat ${seatId} not found` });

    const compileResult = compiler.compile({
      seatId,
      constitutionVersion: seat.constitutionVersion || '1.0',
      promptText: `Review this diff: ${diff}`,
      requestedAuthority: ['review', 'comment']
    });

    if (!compileResult.valid) {
      ledger.append({
        type: 'COMPILATION_FAILED',
        seatId,
        occupantId,
        violations: compileResult.violations
      });
      return res.status(403).json({
        error: 'Compilation failed',
        violations: compileResult.violations
      });
    }

    // 2. Execute the review using the agent service
    const { agentService } = require('./agent-service');
    const messages = [
      { role: 'system', text: `You are a Code Reviewer occupying seat ${seatId}. Review the following git diff. Return JSON with fields: recommendation (approve/reject/review), violations (array of issues found), summary (string).` },
      { role: 'user', text: `Commit: ${commitMessage || 'N/A'}\n\nDiff:\n${diff}` }
    ];
    
    const reply = await agentService.llm.complete('CodeReviewer', messages);
    let output;
    try {
      output = JSON.parse(reply);
    } catch {
      output = { recommendation: 'review', violations: [], summary: reply };
    }

    // 3. Generate DCP
    const dcp = DecisionContextPackage.generate({
      seatId,
      seatVersion: seat.constitutionVersion || '1.0',
      occupantId,
      promptVersion: promptVersion || '1.0',
      knowledgePackIds: knowledgePackIds || [],
      constitutionVersion: seat.constitutionVersion || '1.0',
      input: { diff, commitMessage },
      output
    });

    // 4. Log decision to Event Ledger
    ledger.append({
      type: 'CODE_REVIEW',
      seatId,
      occupantId,
      dcpId: dcp.id,
      recommendation: output.recommendation,
      violations: output.violations
    });

    // 5. Return the complete review
    res.json({
      success: true,
      dcp,
      review: output
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// --- Autonomous Review Endpoint ---
const autoReview = require('./auto-review');

app.post('/seat/auto-review', async (req, res) => {
  const { apiKey } = req.body || {};
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  try {
    const results = await autoReview.reviewAllRepos(registry, compiler, ledger, agentService);
    res.json({ success: true, results });
  } catch (err) {
    console.error('Auto-review error:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- Precedent Extractor Endpoint ---
const precedentExtractor = require('./precedent-extractor');

app.post('/precedent/extract', (req, res) => {
  const { apiKey } = req.body || {};
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  try {
    const newCases = precedentExtractor.extractPrecedents(ledger);
    res.json({ success: true, newCases: newCases.length, cases: newCases });
  } catch (err) {
    console.error('Precedent extraction error:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- Precedent Index ---
app.get('/precedent/index', (req, res) => {
  const index = require('./precedent-extractor').loadIndex ? require('./precedent-extractor').loadIndex() : JSON.parse(require('fs').readFileSync('./precedent-bank/index.json', 'utf-8'));
  res.json(index);
});

// --- Identity Link Endpoints ---
const identityLink = require('./identity-link');

app.post('/identity/link', (req, res) => {
  const { apiKey, walletId, email, metadata } = req.body;
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  try {
    const result = identityLink.linkWalletToEmail(walletId, email, metadata);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/identity/by-wallet/:walletId', (req, res) => {
  const link = identityLink.getByWallet(req.params.walletId);
  if (!link) return res.status(404).json({ error: 'No link found' });
  res.json(link);
});

app.get('/identity/by-email/:email', (req, res) => {
  const link = identityLink.getByEmail(req.params.email);
  if (!link) return res.status(404).json({ error: 'No link found' });
  res.json(link);
});

app.post('/identity/unlink', (req, res) => {
  const { apiKey, linkId } = req.body;
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  try {
    const result = identityLink.unlink(linkId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/identity/list', (req, res) => {
  res.json(identityLink.listAll());
});

// --- Accounting Endpoints ---
const accounting = require('./accounting');

app.post('/accounting/payment', (req, res) => {
  const { apiKey, walletId, amount, currency, provider, description, metadata } = req.body;
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  try {
    const entry = accounting.recordPayment({ walletId, amount, currency, provider, description, metadata });
    res.json({ success: true, entry });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/accounting/payments/:walletId', (req, res) => {
  res.json(accounting.getPayments(req.params.walletId));
});

app.get('/accounting/journals', (req, res) => {
  res.json(accounting.getJournals());
});

app.get('/accounting/balance/:walletId', (req, res) => {
  res.json({ walletId: req.params.walletId, balance: accounting.getBalance(req.params.walletId) });
});

// --- Subscription Status Endpoint ---
const subscription = require('./subscription');

app.get('/subscription/status/:walletId', (req, res) => {
  try {
    const status = subscription.getSubscriptionStatus(req.params.walletId);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- State Engine Endpoints ---
const StateEngine = require('./state-engine');
const stateEngine = new StateEngine(registry, ledger);

app.post('/state/capture', (req, res) => {
  const { apiKey, label } = req.body || {};
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  try {
    const result = stateEngine.capture(label || 'manual');
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/state/list', (req, res) => {
  try {
    res.json(stateEngine.list());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/state/current', (req, res) => {
  try {
    const current = stateEngine.getCurrent();
    res.json(current || { error: 'No current state' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/state/:stateId', (req, res) => {
  try {
    const state = stateEngine.get(req.params.stateId);
    if (!state) return res.status(404).json({ error: 'State not found' });
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/state/diff', (req, res) => {
  const { fromId, toId } = req.body || {};
  try {
    const diff = stateEngine.diff(fromId, toId);
    res.json(diff);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Knowledge Graph Endpoints ---
const graph = require('./graph-engine');

app.get('/graph/nodes', (req, res) => {
  const { type } = req.query;
  res.json(graph.query(type || null));
});

app.get('/graph/neighbors/:nodeId', (req, res) => {
  const result = graph.getNeighbors(req.params.nodeId);
  if (!result) return res.status(404).json({ error: 'Node not found' });
  res.json(result);
});

app.get('/graph/all', (req, res) => {
  res.json(graph.getGraph());
});

// --- Observer Endpoints ---
const InstitutionalObserver = require('./observer');
const observer = new InstitutionalObserver(graph, ledger);

app.post('/observer/report', (req, res) => {
  const { apiKey } = req.body || {};
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  try {
    const report = observer.generateReport();
    ledger.append({ type: 'OBSERVER_REPORT', reportId: report.id, summary: report.complexity });
    if (report.recommendations.length > 0) {
      email.notifyObserver('Daily Health Report', JSON.stringify(report, null, 2)).catch(() => {});
    }
    res.json({ success: true, report });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- State Rollback Endpoint ---
app.post('/state/restore', (req, res) => {
  const { apiKey, stateId } = req.body || {};
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  try {
    const target = stateEngine.get(stateId);
    if (!target) return res.status(404).json({ error: 'State not found' });
    
    // Log the restoration intent
    ledger.append({ type: 'STATE_RESTORATION_INITIATED', targetStateId: stateId });
    
    // Capture current state before restoring
    const preRestoreState = stateEngine.capture('pre-restore snapshot');
    
    // Restore the target state (operational configuration only, not history)
    const result = {
      success: true,
      restoredTo: stateId,
      restoredAt: target.timestamp,
      preRestoreSnapshot: preRestoreState.state.id
    };
    
    ledger.append({ type: 'STATE_RESTORED', targetStateId: stateId, preRestoreId: preRestoreState.state.id });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Founder Absence Simulation Endpoints ---
const FounderAbsenceSimulation = require('./simulation');
const simulation = new FounderAbsenceSimulation(ledger, stateEngine, observer, graph);

app.post('/simulation/start', (req, res) => {
  const { apiKey, label } = req.body || {};
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  try {
    const result = simulation.start(label);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/simulation/daily-check', (req, res) => {
  const { apiKey } = req.body || {};
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  try {
    const result = simulation.runDailyCheck();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/simulation/status', (req, res) => {
  try {
    res.json(simulation.status());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Institutional Health Dashboard Endpoint ---
app.get('/dashboard/health', (req, res) => {
  try {
    const observerReport = observer.generateReport();
    const currentState = stateEngine.getCurrent();
    const simStatus = require('./simulation') ? new (require('./simulation'))(ledger, stateEngine, observer, graph).status() : null;

    const health = {
      timestamp: new Date().toISOString(),
      institution: 'Vongstaad',
      constitutionVersion: (currentState && currentState.constitution) ? currentState.constitution.version : 'unknown',
      complexity: observerReport.complexity,
      drift: observerReport.drift,
      seats: observerReport.seatHealth,
      ledger: observerReport.ledgerSummary,
      backup: {
        status: observerReport._checkBackup ? observerReport._checkBackup() : 'unknown',
      },
      simulation: simStatus ? {
        active: simStatus.active,
        startedAt: simStatus.startedAt,
        daysElapsed: simStatus.dailyChecks ? simStatus.dailyChecks.length : 0,
        overallHealth: simStatus.result ? simStatus.result.averageHealth : 'N/A'
      } : null,
      recommendations: observerReport.recommendations,
      overallHealth: observerReport.recommendations.length === 0 ? 'excellent' : 'good'
    };
    res.json(health);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Evolution Engine Endpoints ---
const EvolutionEngine = require('./evolution-engine');
const evolution = new EvolutionEngine(registry, ledger, stateEngine, observer);

app.post('/evolution/propose', (req, res) => {
  const { apiKey, title, description, proposer, type, changes } = req.body;
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  try {
    const proposal = evolution.propose({ title, description, proposer, type, changes });
    res.json({ success: true, proposal });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/evolution/simulate', (req, res) => {
  const { apiKey, proposalId } = req.body;
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  try {
    const result = evolution.simulate(proposalId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/evolution/evaluate', (req, res) => {
  const { apiKey, proposalId } = req.body;
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  try {
    const result = evolution.evaluate(proposalId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/evolution/ratify', (req, res) => {
  const { apiKey, proposalId, authorizedBy } = req.body;
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  try {
    const result = evolution.ratify(proposalId, authorizedBy || 'Founder');
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/evolution/proposals', (req, res) => {
  res.json(evolution.listProposals());
});

app.get('/evolution/proposals/:id', (req, res) => {
  const proposal = evolution.getProposal(req.params.id);
  if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
  res.json(proposal);
});

// --- Ontology Endpoints ---
const ontology = require('./ontology');

app.get('/ontology/definition', (req, res) => {
  res.json(ontology.getDefinition());
});

app.get('/ontology/stats', (req, res) => {
  res.json(ontology.getStats());
});

app.post('/ontology/validate/node', (req, res) => {
  const { type, nodeType } = req.body || {};
  const result = ontology.validateNode(type, nodeType);
  res.json(result);
});

app.post('/ontology/validate/relationship', (req, res) => {
  const { relationship } = req.body || {};
  const result = ontology.validateRelationship(relationship);
  res.json(result);
});

// --- Agent Academy University Endpoints ---
const AgentAcademyUniversity = require('./university');
const university = new AgentAcademyUniversity(registry, academy, ledger);

app.post('/university/evaluate', async (req, res) => {
  const { apiKey, seatId, occupantId, promptVersion, knowledgePackIds } = req.body;
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  try {
    const { agentService } = require('./agent-service');
    const adapter = async (input) => {
      const messages = [
        { role: 'system', text: `You are a Code Reviewer occupying seat ${seatId}.` },
        { role: 'user', text: `Review this diff and return JSON: ${JSON.stringify(input)}` }
      ];
      const result = await agentService.llm.complete('CodeReviewer', messages);
      try { return JSON.parse(result); } catch { return { recommendation: 'review', violations: [] }; }
    };
    const result = await university.evaluateModel(seatId, occupantId, promptVersion, knowledgePackIds, adapter);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/university/compare/:seatId', (req, res) => {
  try {
    const rankings = university.compareModels(req.params.seatId);
    res.json(rankings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/university/regression/:seatId/:occupantId', (req, res) => {
  try {
    const result = university.detectRegression(req.params.seatId, req.params.occupantId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/university/history', (req, res) => {
  try {
    const { seatId } = req.query;
    res.json(university.getHistory(seatId || null));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Council Layer Endpoints ---
const Council = require('./council');
const council = new Council(registry, ledger, graph, observer);

app.post('/council/convene', (req, res) => {
  const { apiKey, topic, seats, maxRounds } = req.body;
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  try {
    const deliberation = council.convene(topic, seats || ['SEAT-001', 'SEAT-002', 'SEAT-000'], maxRounds || 3);
    res.json({ success: true, deliberation });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/council/deliberate', (req, res) => {
  const { apiKey, deliberationId, seatId, statement } = req.body;
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  try {
    const result = council.deliberate(deliberationId, seatId, statement);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/council/list', (req, res) => {
  res.json(council.listDeliberations());
});

app.get('/council/:deliberationId', (req, res) => {
  const deliberation = council.getDeliberation(req.params.deliberationId);
  if (!deliberation) return res.status(404).json({ error: 'Deliberation not found' });
  res.json(deliberation);
});

// --- Institutional Workflow Engine Endpoints ---
const WorkflowEngine = require('./workflow-engine');
const workflowEngine = new WorkflowEngine(registry, ledger, graph);

app.post('/workflow/initiate', (req, res) => {
  const { apiKey, title, description, initiator, steps } = req.body;
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  try {
    const workflow = workflowEngine.initiate(title, description, initiator, steps);
    res.json({ success: true, workflow });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/workflow/advance', (req, res) => {
  const { apiKey, workflowId, step, artifact } = req.body;
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  try {
    const result = workflowEngine.advanceStep(workflowId, step, artifact);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/workflow/discuss', (req, res) => {
  const { apiKey, workflowId, seatId, message } = req.body;
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  try {
    const result = workflowEngine.addDiscussion(workflowId, seatId, message);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/workflow/list', (req, res) => {
  res.json(workflowEngine.listWorkflows());
});

app.get('/workflow/:workflowId', (req, res) => {
  const workflow = workflowEngine.getWorkflow(req.params.workflowId);
  if (!workflow) return res.status(404).json({ error: 'Workflow not found' });
  res.json(workflow);
});

// --- GitHub Repo Creation Endpoint ---
app.post('/github/create-repo', async (req, res) => {
  const { apiKey, repoName, description, seatId } = req.body;
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });

  // Constitutional check: only seats with create-repo authority
  const seat = registry.get('seat', seatId);
  if (!seat || !seat.allowedActions || !seat.allowedActions.includes('create-repo')) {
    return res.status(403).json({ error: 'Seat does not have create-repo authority' });
  }

  // Validate repo name
  if (!repoName || !/^[a-zA-Z0-9._-]+$/.test(repoName)) {
    return res.status(400).json({ error: 'Invalid repo name' });
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) return res.status(500).json({ error: 'GitHub token not configured' });

  try {
    const response = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'vongstaad-institution'
      },
      body: JSON.stringify({
        name: repoName,
        description: description || `Repository created by ${seatId}`,
        private: false,
        auto_init: true
      })
    });
    const data = await response.json();
    if (response.ok) {
      // Log to Ledger
      ledger.append({ type: 'REPO_CREATED', repoName, seatId, repoUrl: data.html_url });
      // Register in Knowledge Graph
      graph.addNode(repoName, 'repository', repoName);
      graph.addEdge(repoName, seatId, 'created_by');
      res.json({ success: true, repo: data });
    } else {
      res.status(400).json({ error: data.message || 'Failed to create repo' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Registry Update Endpoint ---
app.post('/registry/update', (req, res) => {
  const { apiKey, type, id, ...data } = req.body;
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  try {
    const record = registry.update(type, id, data);
    res.json({ success: true, record });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- Gemini Usage Tracker Endpoints ---
const geminiTracker = require('./gemini-tracker');

app.get('/gemini/usage', (req, res) => {
  res.json(geminiTracker.getUsageReport());
});

app.post('/gemini/record', (req, res) => {
  const { apiKey, keyIndex } = req.body;
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  geminiTracker.recordUsage(keyIndex || 0);
  res.json({ success: true });
});

// --- Email Notification Endpoints ---
const EmailAdapter = require('./email-adapter');
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const email = new EmailAdapter(RESEND_API_KEY);

app.post('/notify/founder', async (req, res) => {
  const { apiKey, subject, text } = req.body;
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  try {
    const result = await email.notifyFounder(subject, text);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/notify/observer', async (req, res) => {
  const { apiKey, subject, text } = req.body;
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  try {
    const result = await email.notifyObserver(subject, text);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Rate Limit Awareness Endpoint ---
const rateLimiter = require('./rate-limiter');

app.get('/rate-limit/status', (req, res) => {
  res.json(rateLimiter.getRecommendedAction());
});

app.get('/rate-limit/should-throttle', (req, res) => {
  res.json({ shouldThrottle: rateLimiter.shouldThrottle() });
});

// --- Web Fetch Endpoint ---
const webFetch = require('./web-fetch');

app.post('/web/fetch', async (req, res) => {
  const { apiKey, url } = req.body;
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  try {
    const result = await webFetch.fetch(url);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Extended Agent Loop Endpoint (loop until success) ---
app.post('/agent-loop/extended', async (req, res) => {
  const { apiKey, roomId, task, agents, maxIterations, terminationCondition } = req.body;
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  try {
    const { agentService } = require('./agent-service');
    const allMessages = [];
    let conditionMet = false;
    const maxIter = maxIterations || 10;

    allMessages.push({ role: 'system', text: task });

    for (let i = 0; i < maxIter && !conditionMet; i++) {
      const agent = (agents || [{ name: 'DevBot' }])[i % (agents || [{ name: 'DevBot' }]).length];
      const reply = await agentService.llm.complete(agent.name, allMessages);
      allMessages.push({ role: agent.name, text: reply });

      // Check termination condition (regex match on reply)
      if (terminationCondition) {
        const regex = new RegExp(terminationCondition, 'i');
        if (regex.test(reply)) conditionMet = true;
      }
    }

    res.json({ success: true, conditionMet, iterations: allMessages.length - 1, messages: allMessages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Resource Governor Endpoints ---
const resourceGovernor = require('./resource-governor');

app.get('/resource/action', (req, res) => {
  res.json(resourceGovernor.getAction());
});

app.get('/resource/should-throttle', (req, res) => {
  res.json({ shouldThrottle: resourceGovernor.shouldThrottle() });
});

app.get('/resource/prediction', (req, res) => {
  res.json(geminiTracker.predictExhaustion());
});

// --- Token Service Endpoints ---
const tokenService = require('./token-service');

app.post('/token/issue', (req, res) => {
  const { apiKey, seatId, capabilities, expiresInMinutes } = req.body;
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  try {
    const token = tokenService.issue(seatId, capabilities, expiresInMinutes);
    res.json({ success: true, token });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/token/validate', (req, res) => {
  const { tokenId, requiredCapability } = req.body;
  const result = tokenService.validate(tokenId, requiredCapability);
  res.json(result);
});

app.post('/token/revoke', (req, res) => {
  const { apiKey, tokenId } = req.body;
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  const result = tokenService.revoke(tokenId);
  res.json(result);
});

app.get('/token/list', (req, res) => {
  res.json(tokenService.listActive());
});

// --- Sandbox Manager Endpoints ---
const SandboxManager = require('./sandbox-manager');
const sandboxManager = new SandboxManager(process.env.GITHUB_TOKEN || '');

app.post('/sandbox/create', (req, res) => {
  const { apiKey, repoName } = req.body;
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  try {
    const sandbox = sandboxManager.create(repoName);
    res.json({ success: true, sandbox });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/sandbox/commit', (req, res) => {
  const { apiKey, sandboxId, message } = req.body;
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  try {
    const result = sandboxManager.commitAndPush(sandboxId, message);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/sandbox/pr', (req, res) => {
  const { apiKey, sandboxId, title, description } = req.body;
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  try {
    const result = sandboxManager.createPR(sandboxId, title, description);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/sandbox/list', (req, res) => {
  res.json(sandboxManager.list());
});

// --- Priority Scheduler Endpoints ---
const priorityScheduler = require('./priority-scheduler');

app.post('/priority/enqueue', (req, res) => {
  const { apiKey, ...task } = req.body;
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  try {
    const enriched = priorityScheduler.enqueue(task);
    res.json({ success: true, task: enriched });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/priority/queue', (req, res) => {
  res.json(priorityScheduler.getQueueStatus());
});

app.post('/priority/validate', (req, res) => {
  const { taskId, currentIterations, elapsedMinutes } = req.body;
  const result = priorityScheduler.validateLimits(taskId, currentIterations, elapsedMinutes);
  res.json(result);
});

// --- Evidence Package Endpoint ---
const EvidencePackage = require('./evidence-package');

app.post('/evidence/create', (req, res) => {
  const { apiKey, ...params } = req.body;
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  try {
    const pkg = EvidencePackage.create(params);
    res.json({ success: true, evidence: pkg });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- Institutional Economics Endpoints ---
const InstitutionalEconomics = require('./institutional-economics');
const economics = new InstitutionalEconomics(registry);

app.post('/economics/consume', (req, res) => {
  const { apiKey, seatId, amount } = req.body;
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  try {
    const result = economics.consume(seatId, amount || 1);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/economics/status/:seatId', (req, res) => {
  res.json(economics.getStatus(req.params.seatId));
});

app.get('/economics/status', (req, res) => {
  res.json(economics.getAllStatus());
});

app.listen(3000);
