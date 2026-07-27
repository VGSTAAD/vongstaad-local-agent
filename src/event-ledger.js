const fs = require('fs');
const path = require('path');

const LEDGER_FILE = path.join(__dirname, 'event-ledger.jsonl');

function append(event) {
  const record = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    ...event
  };
  fs.appendFileSync(LEDGER_FILE, JSON.stringify(record) + '\n');
  return record;
}

function query(filterFn, limit = 100) {
  if (!fs.existsSync(LEDGER_FILE)) return [];
  const lines = fs.readFileSync(LEDGER_FILE, 'utf-8').trim().split('\n');
  const events = lines.map(line => JSON.parse(line));
  const filtered = events.filter(filterFn);
  return filtered.slice(-limit);
}

module.exports = { append, query };
