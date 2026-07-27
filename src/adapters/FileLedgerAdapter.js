const ILedger = require('../ports/ILedger');
const fs = require('fs');
const path = require('path');

class FileLedgerAdapter extends ILedger {
  constructor() {
    super();
    this.LEDGER_FILE = path.join(__dirname, '../../event-ledger.jsonl');
  }

  append(event) {
    const record = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      ...event
    };
    fs.appendFileSync(this.LEDGER_FILE, JSON.stringify(record) + '\n');
    return record;
  }

  query(filterFn, limit = 100) {
    if (!fs.existsSync(this.LEDGER_FILE)) return [];
    const lines = fs.readFileSync(this.LEDGER_FILE, 'utf-8').trim().split('\n');
    const events = lines.map(line => JSON.parse(line));
    const filtered = events.filter(filterFn);
    return filtered.slice(-limit);
  }
}
module.exports = FileLedgerAdapter;
