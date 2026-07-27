const express = require('express');
const { exec } = require('child_process');
const app = express();
app.use(express.json());

app.use((req, res, next) => {
  const origin = req.headers.origin || '*';
  res.header('Access-Control-Allow-Origin', origin);
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, apiKey, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

const DANGEROUS = ['fuser -k', 'pkill', 'kill ', 'shutdown', 'reboot', 'rm -rf /'];
app.post('/run', (req, res) => {
  const { apiKey, command, allowDangerous } = req.body;
  if (apiKey !== 'vongstaad-dev-2026') return res.status(401).json({ error: 'Unauthorized' });
  const cmd = (command || '').trim();
  if (DANGEROUS.some(d => cmd.startsWith(d)) && !allowDangerous) {
    return res.status(403).json({ error: 'Dangerous command blocked. Set allowDangerous: true to execute.' });
  }
  exec(cmd, { timeout: 30000 }, (err, stdout, stderr) => {
    res.json({ ok: !err, stdout: stdout || '', stderr: stderr || '' });
  });
});

app.get('/status', (req, res) => res.json({ online: true }));
app.listen(3000, () => console.log('Local agent running on port 3000'));
