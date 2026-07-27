const IAccounting = require('../ports/IAccounting');
const fs = require('fs');
const path = require('path');
class FileAccountingAdapter extends IAccounting {
  constructor() {
    super();
    this.LEDGER_FILE = path.join(__dirname, '../../accounting-ledger.json');
    this.JOURNAL_DIR = path.join(__dirname, '../../accounting-journals');
    if (!fs.existsSync(this.JOURNAL_DIR)) fs.mkdirSync(this.JOURNAL_DIR, { recursive: true });
  }
  recordPayment({ walletId, amount, currency, provider, description, metadata = {} }) {
    const entries = fs.existsSync(this.LEDGER_FILE) ? JSON.parse(fs.readFileSync(this.LEDGER_FILE, 'utf-8')) : [];
    const entry = { id: `PAY-${Date.now()}`, walletId, amount, currency, provider, description, metadata, timestamp: new Date().toISOString(), status: 'recorded' };
    entries.push(entry);
    fs.writeFileSync(this.LEDGER_FILE, JSON.stringify(entries, null, 2));
    const journal = { id: `JRN-${Date.now()}`, paymentId: entry.id, walletId, entries: [
      { account: '1001 - Cash', debit: amount, credit: 0, description: `Payment from ${walletId}` },
      { account: '4001 - Revenue', debit: 0, credit: amount, description: description || 'Service revenue' },
      { account: '2001 - Tax Payable', debit: 0, credit: Math.round(amount * 0.1 * 100) / 100, description: 'Estimated VAT/GST (10%)' }
    ], metadata: { provider, currency, timestamp: entry.timestamp }, createdAt: new Date().toISOString(), status: 'posted' };
    fs.writeFileSync(path.join(this.JOURNAL_DIR, `${journal.id}.json`), JSON.stringify(journal, null, 2));
    return entry;
  }
  getPayments(walletId = null) {
    if (!fs.existsSync(this.LEDGER_FILE)) return [];
    const entries = JSON.parse(fs.readFileSync(this.LEDGER_FILE, 'utf-8'));
    return walletId ? entries.filter(e => e.walletId === walletId) : entries;
  }
  getJournals() {
    if (!fs.existsSync(this.JOURNAL_DIR)) return [];
    return fs.readdirSync(this.JOURNAL_DIR).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(path.join(this.JOURNAL_DIR, f), 'utf-8')));
  }
  getBalance(walletId) {
    const payments = this.getPayments(walletId);
    return payments.reduce((sum, p) => sum + p.amount, 0);
  }
}
module.exports = FileAccountingAdapter;