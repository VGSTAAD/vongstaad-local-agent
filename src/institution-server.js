// ── Hexagonal Institution Server (Clean Slate) ────────────────
const express = require('express');
const app = express();
app.use(express.json());

// ── CORS ──────────────────────────────────────────────────────
app.use((req, res, next) => {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, apiKey');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

// ── Adapters (Hexagonal Core) ─────────────────────────────────
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
const agentLoop = new AgentLoopService(llmProvider, roomRepo, {
  devServer: shell,
  search: search
});

// ── Institutional Modules (safe load, no crash) ───────────────
let registry, ledger, academy, compiler, observer, graph, stateEngine, evolution;
let council, workflowEngine, university, simulation, economics, tokenService, sandboxManager;

function tryLoad(name) {
  try { return require(`../${name}`); } catch { return null; }
}
registry = tryLoad('registry');
ledger = tryLoad('event-ledger');
academy = tryLoad('academy');
compiler = tryLoad('compiler');
observer = tryLoad('observer');
graph = tryLoad('graph-engine');
stateEngine = tryLoad('state-engine');
evolution = tryLoad('evolution-engine');
council = tryLoad('council');
workflowEngine = tryLoad('workflow-engine');
university = tryLoad('university');
simulation = tryLoad('simulation');
economics = tryLoad('institutional-economics');
tokenService = tryLoad('token-service');
sandboxManager = tryLoad('sandbox-manager');


// ── Instantiate classes that need dependencies ──────────────
if (stateEngine && registry && ledger) {
  try {
    stateEngine = new (require('../state-engine'))(registry, ledger);
  } catch(e) { console.warn('stateEngine init failed'); }
}
if (observer && graph && ledger) {
  try {
    observer = new (require('../observer'))(graph, ledger);
  } catch(e) { console.warn('observer init failed'); }
}
if (evolution && registry && ledger && stateEngine && observer) {
  try {
    evolution = new (require('../evolution-engine'))(registry, ledger, stateEngine, observer);
  } catch(e) { console.warn('evolution init failed'); }
}
if (simulation && ledger && stateEngine && observer && graph) {
  try {
    simulation = new (require('../simulation'))(ledger, stateEngine, observer, graph);
  } catch(e) { console.warn('simulation init failed'); }
}
if (academy && registry && ledger) {
  try {
    academy = new (require('../academy'))(registry, ledger);
  } catch(e) { console.warn('academy init failed'); }
}

// ── Routes ────────────────────────────────────────────────────
app.get('/status', (req, res) => res.json({ online: true }));

app.post('/run', async (req, res) => {
  const { apiKey, command } = req.body;
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  try {
    const output = await shell.run(command);
    res.json({ ok: true, stdout: output, stderr: '', exitCode: 0 });
  } catch (err) {
    res.json({ ok: false, stdout: '', stderr: err.message, exitCode: 1 });
  }
});

app.post('/agent-loop', async (req, res) => {
  const { apiKey, roomId, task, agents, maxTurns } = req.body;
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  try {
    const messages = await agentLoop.runLoop(
      roomId, task,
      agents || [{ name: 'DevBot' }, { name: 'ReviewerBot' }],
      maxTurns || 5
    );
    res.json({ success: true, messages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Institutional Endpoints (only if module loaded) ───────────
if (registry) {
  app.get('/registry/search/:type', (req, res) => {
    res.json(registry.search(req.params.type, req.query || {}) || []);
  });
  app.get('/registry/:type/:id', (req, res) => {
    const record = registry.get(req.params.type, req.params.id);
    if (!record) return res.status(404).json({ error: 'Not found' });
    res.json(record);
  });
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
    try {
      const report = observer.generateReport();
      if (ledger) ledger.append({ type: 'OBSERVER_REPORT', reportId: report.id });
      res.json({ success: true, report });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

if (evolution) {
  app.get('/evolution/proposals', (req, res) => res.json(evolution.listProposals() || []));
  app.post('/evolution/propose', (req, res) => {
    const { apiKey, ...data } = req.body;
    if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
    try {
      const proposal = evolution.propose(data);
      res.json({ success: true, proposal });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });
  app.post('/evolution/simulate', (req, res) => {
    const { apiKey, proposalId } = req.body;
    if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
    try {
      res.json(evolution.simulate(proposalId));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });
  app.post('/evolution/evaluate', (req, res) => {
    const { apiKey, proposalId } = req.body;
    if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
    try {
      res.json(evolution.evaluate(proposalId));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });
  app.post('/evolution/ratify', (req, res) => {
    const { apiKey, proposalId, authorizedBy } = req.body;
    if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
    try {
      res.json(evolution.ratify(proposalId, authorizedBy));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });
}

// ── Start ─────────────────────────────────────────────────────
const PORT = 3000;
app.listen(PORT, () => console.log(`Sovereign institution server listening on port ${PORT}`));
