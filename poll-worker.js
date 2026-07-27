const WORKER_URL = 'https://vongstaad-agent-worker.restless-pond-8b7b.workers.dev';
const LOCAL_API = 'http://localhost:3001';
const API_KEY = 'vongstaad-dev-2026';
const POLL_INTERVAL = 3000;

async function markTask(taskId, status, result) {
  await fetch(`${WORKER_URL}/command/${taskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, result })
  });
}

async function executeCommand(taskId, command) {
  try {
    await markTask(taskId, 'executing', '');
    const resp = await fetch(`${LOCAL_API}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: API_KEY, command, cwd: '/home/mhk/workspaces' })
    });
    const data = await resp.json();
    const resultText = data.ok ? (data.stdout || data.stderr) : (data.stderr || data.stdout || 'Execution error');
    await markTask(taskId, 'completed', resultText);
  } catch (err) {
    await markTask(taskId, 'completed', `Error: ${err.message}`);
  }
}

async function executeApiRequest(taskId, method, path, body) {
  try {
    await markTask(taskId, 'executing', '');
    const fetchOptions = {
      method: method || 'GET',
      headers: { 'Content-Type': 'application/json', 'apiKey': API_KEY }
    };
    if (body && method !== 'GET') {
      fetchOptions.body = JSON.stringify(body);
    }
    const resp = await fetch(`${LOCAL_API}${path}`, fetchOptions);
    const contentType = resp.headers.get('content-type') || '';
    let result;
    if (contentType.includes('application/json')) {
      result = JSON.stringify(await resp.json());
    } else {
      result = await resp.text();
    }
    await markTask(taskId, 'completed', result);
  } catch (err) {
    await markTask(taskId, 'completed', `Error: ${err.message}`);
  }
}

async function poll() {
  try {
    const resp = await fetch(`${WORKER_URL}/command/pending`);
    const data = await resp.json();
    if (data.pending) {
      const { taskId, type, command, method, path, body } = data;
      if (type === 'api') {
        await executeApiRequest(taskId, method, path, body);
      } else {
        await executeCommand(taskId, command);
      }
    }
  } catch (err) {
    console.error('Poll error:', err.message);
  }
}

async function main() {
  console.log('Error‑safe poll-worker started');
  while (true) {
    await poll();
    await new Promise(r => setTimeout(r, POLL_INTERVAL));
  }
}
main();
