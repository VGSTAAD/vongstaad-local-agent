const WorkerRelayAdapter = require('./src/adapters/WorkerRelayAdapter');
const https = require('https');
const WORKER_URL = 'https://vongstaad-agent-worker.restless-pond-8b7b.workers.dev';
const LOCAL_API = 'http://localhost:3001';
const API_KEY = 'vongstaad-dev-2026';
const POLL_INTERVAL = 3000;

const CIRCUIT_THRESHOLD = 5;
const CIRCUIT_COOLDOWN = 60_000;

let relay = new WorkerRelayAdapter(WORKER_URL);
let consecutiveErrors = 0;
let circuitOpenUntil = 0;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function executeApiRequest(taskId, method, path, body) {
  try {
    const fetchOptions = {
      method: method || 'GET',
      headers: { 'Content-Type': 'application/json' }
    };
    if (body && method !== 'GET') fetchOptions.body = JSON.stringify(body);
    const resp = await fetch(LOCAL_API + path, fetchOptions);
    const result = await resp.json();
    await relay.markTaskComplete(taskId, JSON.stringify(result));
  } catch (err) {
    await relay.markTaskComplete(taskId, 'Error: ' + err.message);
  }
}

async function executeCommand(taskId, cmd) {
  try {
    const resp = await fetch(LOCAL_API + '/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: API_KEY, command: cmd, cwd: '/home/mhk/workspaces' })
    });
    const data = await resp.json();
    const resultText = data.success ? (data.data.stdout || data.data.stderr) : (data.data?.stderr || data.data?.stdout || 'Execution error');
    await relay.markTaskComplete(taskId, resultText);
  } catch (err) {
    await relay.markTaskComplete(taskId, 'Error: ' + err.message);
  }
}

async function poll() {
  const healthy = await relay.healthCheck();
  if (!healthy) {
    console.warn('Health check failed');
    consecutiveErrors++;
    return;
  }
  try {
    const cmd = await relay.fetchPendingCommand();
    if (cmd.pending) {
      const { taskId, command: task } = cmd;
      if (task && task.type === 'api') {
        await executeApiRequest(taskId, task.method, task.path, task.body);
      } else {
        const cmdText = typeof task === 'string' ? task : (task.command || '');
        await executeCommand(taskId, cmdText);
      }
      consecutiveErrors = 0;
    }
  } catch (err) {
    console.error('Poll error:', err.message);
    consecutiveErrors++;
    if (consecutiveErrors >= CIRCUIT_THRESHOLD) {
      console.error('Circuit breaker OPEN for ' + CIRCUIT_COOLDOWN/1000 + 's');
      circuitOpenUntil = Date.now() + CIRCUIT_COOLDOWN;
    }
  }
}

async function main() {
  console.log('Final resilient poll-worker started (hexagonal relay)');
  while (true) {
    if (circuitOpenUntil > Date.now()) {
      console.log('Circuit open, pausing…');
      await sleep(POLL_INTERVAL);
      continue;
    }
    if (circuitOpenUntil && Date.now() >= circuitOpenUntil) {
      console.log('Circuit half-open, trying again');
      circuitOpenUntil = 0;
      consecutiveErrors = 0;
    }
    await poll();
    await sleep(POLL_INTERVAL);
  }
}
main();
