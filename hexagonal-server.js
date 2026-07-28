const http = require('http');
const JsonlFactStore = require('./adapters/JsonlFactStore');
const AuthorityService = require('./services/AuthorityService');

const FACT_FILE = process.env.FACT_FILE || './institution-facts.jsonl';
const PORT = process.env.PORT || 3001;
const API_KEY = process.env.API_KEY || 'vongstaad-dev-2026';

// Instantiate adapters and services (composition root)
const factStore = new JsonlFactStore(FACT_FILE);
const authority = new AuthorityService(factStore);

// --- Response envelope helper ---
function envelope(success, data, error = null) {
  return JSON.stringify({ success, data, error });
}

// --- Auth helper ---
function checkAuth(body) {
  const b = typeof body === 'string' ? JSON.parse(body) : body;
  return b && b.apiKey === API_KEY;
}

// --- Routes ---
async function handleRequest(req, res) {
  const { method, url } = req;
  const path = url.split('?')[0];
  const body = await readBody(req);

  // Health
  if (path === '/status' && method === 'GET') {
    return ok({ online: true });
  }

  // Registry (projection of offices, seats, occupants)
  if (path === '/registry' && method === 'GET') {
    const offices = Array.from(authority.offices.values());
    const seats = Array.from(authority.seats.values());
    const occupants = Array.from(authority.occupants.values());
    return ok({ offices, seats, occupants });
  }

  // Ledger – replay all facts
  if (path === '/ledger' && method === 'GET') {
    const facts = await factStore.getAll();
    return ok(facts);
  }

  // Observer – basic institutional health
  if (path === '/observer' && method === 'GET') {
    const totalFacts = (await factStore.getAll()).length;
    return ok({
      totalFacts,
      constitutionVersion: authority.constitutionVersion,
      offices: Array.from(authority.offices.keys()),
      seats: Array.from(authority.seats.keys()),
    });
  }

  // Academy – evaluation stub (will be enriched later)
  if (path === '/academy' && method === 'GET') {
    return ok({
      constitutionCompliance: '100%',
      architectureScore: 'passed',
      implementationScore: 'in progress',
    });
  }

  // Simulation – stub (future)
  if (path === '/simulation' && method === 'GET') {
    return ok({ status: 'idle', lastRun: null });
  }

  // Console command – received from dashboard via relay
  if (path === '/run' && method === 'POST') {
    if (!checkAuth(body)) return err(401, 'Unauthorized');
    const { command, cwd } = JSON.parse(body);
    const execSync = require('child_process').execSync;
    try {
      const stdout = execSync(command, { cwd: cwd || process.cwd(), timeout: 15000, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
      return ok({ stdout, stderr: '', exitCode: 0 });
    } catch (e) {
      return ok({ stdout: e.stdout || '', stderr: e.stderr || e.message, exitCode: e.status || 1 });
    }
  }

  // Agent loop (Chat) – placeholder that will call Gemini later
  if (path === '/agent-loop' && method === 'POST') {
    if (!checkAuth(body)) return err(401, 'Unauthorized');
    const { task } = JSON.parse(body);
    // For now, echo with a prefix to show the chain works
    const reply = `[Agent V1.0] You said: "${task}"`;
    return ok({ messages: [{ role: 'system', text: task }, { role: 'DevBot', text: reply }] });
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(envelope(false, null, 'Not found'));
}

function ok(data) {
  return {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: envelope(true, data),
  };
}

function err(code, message) {
  return {
    status: code,
    headers: { 'Content-Type': 'application/json' },
    body: envelope(false, null, message),
  };
}

function readBody(req) {
  return new Promise((resolve) => {
    let d = '';
    req.on('data', c => d += c);
    req.on('end', () => resolve(d));
  });
}

// --- Start ---
(async () => {
  await factStore.init();
  await authority.init();

  const server = http.createServer(async (req, res) => {
    try {
      const result = await handleRequest(req, res);
      res.writeHead(result.status, result.headers);
      res.end(result.body);
    } catch (e) {
      console.error(e);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(envelope(false, null, e.message));
    }
  });

  server.listen(PORT, () => {
    console.log(`Institutional hexagonal server listening on port ${PORT}`);
  });
})();
