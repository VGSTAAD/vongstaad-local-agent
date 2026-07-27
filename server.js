const express = require('express');
const app = express();
app.use(express.json());

// ── CORS ──────────────────────────────────────────────
app.use((req, res, next) => {
  const origin = req.headers.origin || '*';
  res.header('Access-Control-Allow-Origin', origin);
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, apiKey');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

// ── Adapters ──────────────────────────────────────────
const { WorkerGeminiAdapter } = require('./adapters/WorkerGeminiAdapter');
const { FileRoomRepository } = require('./adapters/FileRoomRepository');
const { LocalShellAdapter } = require('./adapters/LocalShellAdapter');
const { SearchAdapter } = require('./adapters/SearchAdapter');
const { AgentLoopService } = require('./services/AgentLoopService');

const WORKER_URL = 'https://vongstaad-agent-worker.restless-pond-8b7b.workers.dev';

const llmProvider = new WorkerGeminiAdapter(WORKER_URL, 'gemini-3-flash-preview');
const roomRepo = new FileRoomRepository(__dirname + '/../agent-rooms');
const shellAdapter = new LocalShellAdapter('/home/mhk/workspaces');
const searchAdapter = new SearchAdapter();

const agentLoopService = new AgentLoopService(llmProvider, roomRepo, {
  devServer: shellAdapter,
  search: searchAdapter
});

// ── Institutional Modules ─────────────────────────────
let registry, ledger, academy, compiler, observer, graph, stateEngine, evolution;
let council, workflowEngine, university, simulation, economics, tokenService, sandboxManager;

try { registry = require('../registry'); } catch(e) { console.warn('registry not loaded'); }
try { ledger = require('../event-ledger'); } catch(e) { console.warn('ledger not loaded'); }
try { academy = require('../academy'); } catch(e) { console.warn('academy not loaded'); }
try { compiler = require('../compiler'); } catch(e) { console.warn('compiler not loaded'); }
try { observer = require('../observer'); } catch(e) { console.warn('observer not loaded'); }
try { graph = require('../graph-engine'); } catch(e) { console.warn('graph not loaded'); }
try { stateEngine = require('../state-engine'); } catch(e) { console.warn('stateEngine not loaded'); }
try { evolution = require('../evolution-engine'); } catch(e) { console.warn('evolution not loaded'); }
try { council = require('../council'); } catch(e) { console.warn('council not loaded'); }
try { workflowEngine = require('../workflow-engine'); } catch(e) { console.warn('workflow not loaded'); }
try { university = require('../university'); } catch(e) { console.warn('university not loaded'); }
try { simulation = require('../simulation'); } catch(e) { console.warn('simulation not loaded'); }
try { economics = require('../institutional-economics'); } catch(e) { console.warn('economics not loaded'); }
try { tokenService = require('../token-service'); } catch(e) { console.warn('tokenService not loaded'); }
try { sandboxManager = require('../sandbox-manager'); } catch(e) { console.warn('sandbox not loaded'); }

// ── Routes ────────────────────────────────────────────
app.get('/status', (req, res) => res.json({ online: true }));

app.post('/run', (req, res) => {
  const { apiKey, command } = req.body;
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  shellAdapter.run(command).then(result => {
    res.json({ ok: true, stdout: result, stderr: '', exitCode: 0 });
  }).catch(err => {
    res.json({ ok: false, stdout: '', stderr: err.message, exitCode: 1 });
  });
});

app.post('/agent-loop', async (req, res) => {
  const { apiKey, roomId, task, agents, maxTurns } = req.body;
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  try {
    const messages = await agentLoopService.runLoop(
      roomId, task,
      agents || [{ name: 'DevBot' }, { name: 'ReviewerBot' }],
      maxTurns || 5
    );
    res.json({ success: true, messages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Institutional module endpoints (only if the modules loaded)
if (registry) {
  app.get('/registry/search/:type', (req, res) => {
    res.json(registry.search(req.params.type) || []);
  });
  app.get('/registry/:type/:id', (req, res) => {
    const record = registry.get(req.params.type, req.params.id);
    if (!record) return res.status(404).json({ error: 'Not found' });
    res.json(record);
  });
}
if (ledger) {
  app.get('/ledger/query', (req, res) => {
    const { type, seatId, limit } = req.query;
    const events = ledger.query(e => {
      if (type && e.type !== type) return false;
      if (seatId && e.seatId !== seatId) return false;
      return true;
    }, parseInt(limit) || 100);
    res.json(events);
  });
  app.post('/ledger/append', (req, res) => {
    const { apiKey, ...event } = req.body;
    if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
    const record = ledger.append(event);
    res.json({ success: true, record });
  });
}
if (academy) {
  app.post('/academy/evaluate', async (req, res) => {
    const { apiKey, seatId, occupantId, promptVersion, knowledgePackIds } = req.body;
    if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
    try {
      const result = await academy.evaluate({
        seatId, occupantId, promptVersion, knowledgePackIds,
        adapter: async (input) => ({ recommendation: 'review', violations: [] })
      });
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}
if (observer) {
  app.post('/observer/report', (req, res) => {
    const { apiKey } = req.body || {};
    if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
    const report = observer.generateReport();
    if (ledger) ledger.append({ type: 'OBSERVER_REPORT', reportId: report.id });
    res.json({ success: true, report });
  });
}
if (evolution) {
  app.get('/evolution/proposals', (req, res) => res.json(evolution.listProposals()));
  app.post('/evolution/propose', (req, res) => {
    const { apiKey, ...data } = req.body;
    if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
    res.json({ success: true, proposal: evolution.propose(data) });
  });
  app.post('/evolution/simulate', (req, res) => {
    const { apiKey, proposalId } = req.body;
    if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
    res.json(evolution.simulate(proposalId));
  });
  app.post('/evolution/evaluate', (req, res) => {
    const { apiKey, proposalId } = req.body;
    if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
    res.json(evolution.evaluate(proposalId));
  });
  app.post('/evolution/ratify', (req, res) => {
    const { apiKey, proposalId, authorizedBy } = req.body;
    if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
    res.json(evolution.ratify(proposalId, authorizedBy));
  });
}

// ── Start ─────────────────────────────────────────────
const PORT = 3000;
app.listen(PORT, () => console.log(`Hexagonal institution server running on port ${PORT}`));
