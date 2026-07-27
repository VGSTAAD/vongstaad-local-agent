const WORKER_URL = 'https://vongstaad-agent-worker.restless-pond-8b7b.workers.dev';
const LOCAL_RUN = 'http://localhost:3000/run';
const API_KEY = 'vongstaad-dev-2026';
const POLL_INTERVAL = 3000;

async function poll() {
  try {
    const resp = await fetch(`${WORKER_URL}/command/pending`);
    const data = await resp.json();
    if (data.pending) {
      const { taskId, command } = data;
      console.log('Executing:', command);

      // 1. Mark as executing (prevents re-execution but dashboard keeps polling)
      await fetch(`${WORKER_URL}/command/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'executing' })
      });

      // 2. Execute locally
      const execResp = await fetch(LOCAL_RUN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: API_KEY, command, cwd: '/home/mhk/workspaces' })
      });
      const execResult = await execResp.json();
      const resultText = execResult.ok
        ? execResult.stdout || execResult.stderr
        : execResult.stderr || execResult.stdout || 'Execution error';

      // 3. Mark completed with the real result
      await fetch(`${WORKER_URL}/command/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed', result: resultText })
      });
      console.log('Completed:', resultText.slice(0, 200));
    }
  } catch (err) {
    console.error('Poll error:', err.message);
  }
}

async function main() {
  console.log('Polling worker started. Checking immediately…');
  await poll();
  while (true) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL));
    await poll();
  }
}
main();
