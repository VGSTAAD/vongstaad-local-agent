const WORKER_URL = 'https://vongstaad-agent-worker.restless-pond-8b7b.workers.dev';
const LOCAL_API = 'http://localhost:3001';
const API_KEY = 'vongstaad-dev-2026';
const POLL_INTERVAL = 3000;

// Circuit breaker
const CIRCUIT_BREAK_THRESHOLD = 5;   // consecutive non-recoverable errors
const CIRCUIT_COOLDOWN_MS = 60_000;  // 1 minute
let consecutiveErrors = 0;
let circuitOpenUntil = 0;

async function fetchWithRetry(url, options, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const resp = await fetch(url, options);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const contentType = resp.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        return await resp.json();
      }
      // If we get HTML/plaintext, treat as non-recoverable for circuit breaker
      throw new Error('Non-JSON response');
    } catch (err) {
      if (i === retries - 1) throw err;
      console.warn(`Retry ${i + 1}/${retries} for ${url}: ${err.message}`);
      await new Promise(r => setTimeout(r, 2000 * (i + 1)));
    }
  }
}

async function healthCheck() {
  try {
    const resp = await fetch(`${WORKER_URL}/health`);
    return resp.ok;
  } catch {
    return false;
  }
}

async function markTask(taskId, status, result) {
  await fetchWithRetry(`${WORKER_URL}/command/${taskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, result })
  });
}

async function executeApiRequest(taskId, method, path, body) {
  try {
    await markTask(taskId, 'executing', '');
    const fetchOptions = {
      method: method || 'GET',
      headers: { 'Content-Type': 'application/json' }
    };
    if (body && method !== 'GET') {
      fetchOptions.body = JSON.stringify(body);
    }
    const resp = await fetchWithRetry(`${LOCAL_API}${path}`, fetchOptions);
    const resultText = typeof resp === 'string' ? resp : JSON.stringify(resp);
    await markTask(taskId, 'completed', resultText);
  } catch (err) {
    await markTask(taskId, 'completed', `Error: ${err.message}`);
  }
}

async function executeCommand(taskId, command) {
  try {
    await markTask(taskId, 'executing', '');
    const resp = await fetchWithRetry(`${LOCAL_API}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: API_KEY, command, cwd: '/home/mhk/workspaces' })
    });
    const data = resp;
    const resultText = data.ok ? (data.stdout || data.stderr) : (data.stderr || data.stdout || 'Execution error');
    await markTask(taskId, 'completed', resultText);
  } catch (err) {
    await markTask(taskId, 'completed', `Error: ${err.message}`);
  }
}

async function poll() {
  // Health gate: if Worker is unreachable, skip cycle
  const healthy = await healthCheck();
  if (!healthy) {
    console.warn('Health check failed, skipping cycle');
    return;
  }

  try {
    const data = await fetchWithRetry(`${WORKER_URL}/command/pending`, {});
    if (data && data.pending) {
      const { taskId, command: task } = data;

      if (task && task.type === 'api') {
        await executeApiRequest(taskId, task.method, task.path, task.body);
      } else {
        // Plain command
        const cmd = typeof task === 'string' ? task : (task.command || '');
        await executeCommand(taskId, cmd);
      }
      // Reset circuit on success
      consecutiveErrors = 0;
    }
  } catch (err) {
    console.error('Poll error:', err.message);
    consecutiveErrors++;
    if (consecutiveErrors >= CIRCUIT_BREAK_THRESHOLD) {
      console.error(`Circuit breaker OPEN for ${CIRCUIT_COOLDOWN_MS/1000}s`);
      circuitOpenUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
    }
  }
}

async function main() {
  console.log('Resilient poll-worker with circuit breaker started');
  while (true) {
    // If circuit is open, wait until cooldown expires
    if (circuitOpenUntil > Date.now()) {
      console.log('Circuit open, pausing...');
      await new Promise(r => setTimeout(r, POLL_INTERVAL));
      continue;
    }
    // If circuit just closed, reset error count
    if (circuitOpenUntil && Date.now() >= circuitOpenUntil) {
      console.log('Circuit half-open, trying again');
      circuitOpenUntil = 0;
      consecutiveErrors = 0;
    }
    await poll();
    await new Promise(r => setTimeout(r, POLL_INTERVAL));
  }
}
main();
