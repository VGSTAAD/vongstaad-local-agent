const express = require('express');
const app = express();
app.use(express.json());

// CORS
app.use((req, res, next) => {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, apiKey');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

// ── Adapters (AI layer) ────────────────────────────────────
const { WorkerGeminiAdapter } = require('./adapters/WorkerGeminiAdapter');
const { FileRoomRepository } = require('./adapters/FileRoomRepository');
const { LocalShellAdapter } = require('./adapters/LocalShellAdapter');
const { SearchAdapter } = require('./adapters/SearchAdapter');
const { AgentLoopService } = require('./services/AgentLoopService');

const WORKER_URL = 'https://vongstaad-agent-worker.restless-pond-8b7b.workers.dev';
const llmProvider = new WorkerGeminiAdapter(WORKER_URL, 'gemini-3-flash-preview');
const roomRepo = new FileRoomRepository(__dirname + '/../agent-rooms');
const shell = new LocalShellAdapter('/home/mhk/workspaces');
const search = new SearchAdapter();
const agentLoop = new AgentLoopService(llmProvider, roomRepo, { devServer: shell, search });

// ── Institutional Adapters (governance layer) ──────────────
const FileRegistryAdapter = require('./adapters/FileRegistryAdapter');
const FileLedgerAdapter = require('./adapters/FileLedgerAdapter');
const FileStateEngineAdapter = require('./adapters/FileStateEngineAdapter');
const FileObserverAdapter = require('./adapters/FileObserverAdapter');
const FileAcademyAdapter = require('./adapters/FileAcademyAdapter');
const FileEvolutionAdapter = require('./adapters/FileEvolutionAdapter');
const FileSimulationAdapter = require('./adapters/FileSimulationAdapter');
const FileCompilerAdapter = require('./adapters/FileCompilerAdapter');
const FilePrecedentExtractorAdapter = require('./adapters/FilePrecedentExtractorAdapter');
const FileIdentityLinkAdapter = require('./adapters/FileIdentityLinkAdapter');
const FileAccountingAdapter = require('./adapters/FileAccountingAdapter');
const FileSubscriptionAdapter = require('./adapters/FileSubscriptionAdapter');
const FileTokenServiceAdapter = require('./adapters/FileTokenServiceAdapter');
const geminiTracker = require('./gemini-tracker');
const FileResourceGovernorAdapter = require('./adapters/FileResourceGovernorAdapter');
const FilePrioritySchedulerAdapter = require('./adapters/FilePrioritySchedulerAdapter');
const FileEvidencePackageAdapter = require('./adapters/FileEvidencePackageAdapter');
const FileInstitutionalEconomicsAdapter = require('./adapters/FileInstitutionalEconomicsAdapter');
const FileWorkflowEngineAdapter = require('./adapters/FileWorkflowEngineAdapter');
const FileCouncilAdapter = require('./adapters/FileCouncilAdapter');
const FileGraphAdapter = require('./adapters/FileGraphAdapter');

const registry = new FileRegistryAdapter();
const ledger = new FileLedgerAdapter();
const graph = new FileGraphAdapter();
const stateEngine = new FileStateEngineAdapter(registry, ledger);
const observer = new FileObserverAdapter(graph, ledger);
const academy = new FileAcademyAdapter(registry, ledger);
const compiler = new FileCompilerAdapter();
const evolution = new FileEvolutionAdapter(registry, ledger, stateEngine, observer);
const simulation = new FileSimulationAdapter(observer, stateEngine, graph);
const precedentExtractor = new FilePrecedentExtractorAdapter();
const identityLink = new FileIdentityLinkAdapter();
const accounting = new FileAccountingAdapter();
const subscription = new FileSubscriptionAdapter(identityLink, accounting);
const tokenService = new FileTokenServiceAdapter();
const resourceGovernor = new FileResourceGovernorAdapter(geminiTracker);
const priorityScheduler = new FilePrioritySchedulerAdapter();
const evidencePackage = new FileEvidencePackageAdapter();
const economics = new FileInstitutionalEconomicsAdapter(registry);
const workflowEngine = new FileWorkflowEngineAdapter();
const council = new FileCouncilAdapter();

// ── Routes ──────────────────────────────────────────────────
app.get('/status', (req, res) => res.json({ online: true }));

// Registry
app.get('/registry/search/:type', (req, res) => res.json(registry.search(req.params.type, req.query || {})));
app.get('/registry/:type/:id', (req, res) => res.json(registry.get(req.params.type, req.params.id) || { error: 'Not found' }));
app.post('/registry/create', (req, res) => {
  const { apiKey, type, id, ...data } = req.body;
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  try { return res.json({ success: true, record: registry.create(type, id, data) }); } catch(e) { return res.status(400).json({ error: e.message }); }
});

// Ledger
app.get('/ledger/query', (req, res) => res.json(ledger.query(() => true, 100)));
app.post('/ledger/append', (req, res) => {
  const { apiKey, ...event } = req.body;
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  return res.json({ success: true, record: ledger.append(event) });
});

// Observer
app.post('/observer/report', (req, res) => {
  const { apiKey } = req.body || {};
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  return res.json({ success: true, report: observer.generateReport() });
});

// Academy
app.post('/academy/evaluate', async (req, res) => {
  const { apiKey, seatId, occupantId, promptVersion, knowledgePackIds } = req.body;
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  const result = await academy.evaluate({ seatId, occupantId, promptVersion, knowledgePackIds, adapter: async (input) => {
    const messages = [{ role: 'system', text: `You are a Code Reviewer.` }, { role: 'user', text: JSON.stringify(input) }];
    const reply = await llmProvider.complete('CodeReviewer', messages);
    try { return JSON.parse(reply); } catch { return { recommendation: 'review', violations: [] }; }
  }});
  return res.json({ success: true, ...result });
});

// Evolution
app.get('/evolution/proposals', (req, res) => res.json(evolution.listProposals()));
app.post('/evolution/propose', (req, res) => {
  const { apiKey, ...data } = req.body;
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  return res.json({ success: true, proposal: evolution.propose(data) });
});
app.post('/evolution/simulate', (req, res) => {
  const { apiKey, proposalId } = req.body;
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  return res.json(evolution.simulate(proposalId));
});
app.post('/evolution/evaluate', (req, res) => {
  const { apiKey, proposalId } = req.body;
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  return res.json(evolution.evaluate(proposalId));
});
app.post('/evolution/ratify', (req, res) => {
  const { apiKey, proposalId, authorizedBy } = req.body;
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  return res.json(evolution.ratify(proposalId, authorizedBy || 'Founder'));
});

// Simulation
app.get('/simulation/status', (req, res) => res.json(simulation.status()));
app.post('/simulation/start', (req, res) => {
  const { apiKey, label } = req.body || {};
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  return res.json(simulation.start(label));
});
app.post('/simulation/daily-check', (req, res) => {
  const { apiKey } = req.body || {};
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  return res.json(simulation.runDailyCheck());
});

// Compiler
app.post('/compiler/validate', (req, res) => {
  const { apiKey, ...config } = req.body;
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  return res.json(compiler.compile(config));
});

// Other endpoints can be added similarly...
// For now, we include the ones critical for the dashboard.

// Economics
app.get('/economics/status', (req, res) => res.json(economics.getAllStatus()));
app.get('/economics/status/:seatId', (req, res) => res.json(economics.getStatus(req.params.seatId)));
app.post('/economics/consume', (req, res) => {
  const { apiKey, seatId, amount } = req.body;
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  return res.json(economics.consume(seatId, amount || 1));
});

// Council
app.get('/council/list', (req, res) => res.json(council.listDeliberations()));
app.get('/council/:id', (req, res) => res.json(council.getDeliberation(req.params.id) || {}));
app.post('/council/convene', (req, res) => {
  const { apiKey, topic, seats, maxRounds } = req.body;
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  return res.json({ success: true, deliberation: council.convene(topic, seats, maxRounds) });
});
app.post('/council/deliberate', (req, res) => {
  const { apiKey, deliberationId, seatId, statement } = req.body;
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  return res.json(council.deliberate(deliberationId, seatId, statement));
});

// Workflow
app.get('/workflow/list', (req, res) => res.json(workflowEngine.listWorkflows()));
app.get('/workflow/:id', (req, res) => res.json(workflowEngine.getWorkflow(req.params.id) || {}));
app.post('/workflow/initiate', (req, res) => {
  const { apiKey, title, description, initiator } = req.body;
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  return res.json({ success: true, workflow: workflowEngine.initiate(title, description, initiator) });
});
app.post('/workflow/advance', (req, res) => {
  const { apiKey, workflowId, step, artifact } = req.body;
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  return res.json(workflowEngine.advanceStep(workflowId, step, artifact));
});
app.post('/workflow/discuss', (req, res) => {
  const { apiKey, workflowId, seatId, message } = req.body;
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  return res.json(workflowEngine.addDiscussion(workflowId, seatId, message));
});

// Graph
app.get('/graph/nodes', (req, res) => res.json(graph.query(req.query.type || null)));
app.get('/graph/all', (req, res) => res.json(graph.getGraph()));
app.get('/graph/neighbors/:nodeId', (req, res) => res.json(graph.getNeighbors(req.params.nodeId) || {}));

// Identity
app.get('/identity/list', (req, res) => res.json(identityLink.listAll()));
app.get('/identity/by-wallet/:walletId', (req, res) => res.json(identityLink.getByWallet(req.params.walletId) || {}));
app.get('/identity/by-email/:email', (req, res) => res.json(identityLink.getByEmail(req.params.email) || {}));
app.post('/identity/link', (req, res) => {
  const { apiKey, walletId, email, metadata } = req.body;
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  return res.json(identityLink.link(walletId, email, metadata));
});
app.post('/identity/unlink', (req, res) => {
  const { apiKey, linkId } = req.body;
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  return res.json(identityLink.unlink(linkId));
});

// Accounting
app.get('/accounting/payments/:walletId', (req, res) => res.json(accounting.getPayments(req.params.walletId)));
app.get('/accounting/journals', (req, res) => res.json(accounting.getJournals()));
app.get('/accounting/balance/:walletId', (req, res) => res.json({ walletId: req.params.walletId, balance: accounting.getBalance(req.params.walletId) }));
app.post('/accounting/payment', (req, res) => {
  const { apiKey, ...data } = req.body;
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  return res.json({ success: true, entry: accounting.recordPayment(data) });
});

// Subscription
app.get('/subscription/status/:walletId', (req, res) => res.json(subscription.getStatus(req.params.walletId)));

// Token
app.get('/token/list', (req, res) => res.json(tokenService.listActive()));
app.post('/token/issue', (req, res) => {
  const { apiKey, seatId, capabilities, expiresInMinutes } = req.body;
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  return res.json({ success: true, token: tokenService.issue(seatId, capabilities, expiresInMinutes) });
});
app.post('/token/validate', (req, res) => {
  const { tokenId, requiredCapability } = req.body;
  return res.json(tokenService.validate(tokenId, requiredCapability));
});
app.post('/token/revoke', (req, res) => {
  const { apiKey, tokenId } = req.body;
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  return res.json(tokenService.revoke(tokenId));
});

app.listen(3001, () => console.log('Hexagonal institution server running on port 3001'));
