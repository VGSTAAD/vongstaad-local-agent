const fs = require('fs');
const path = require('path');

const LEDGER_FILE = path.join(__dirname, 'accounting-ledger.json');
const JOURNAL_DIR = path.join(__dirname, 'accounting-journals');

function ensureDir() {
  if (!fs.existsSync(JOURNAL_DIR)) fs.mkdirSync(JOURNAL_DIR, { recursive: true });
}

function loadLedger() {
  if (!fs.existsSync(LEDGER_FILE)) return [];
  return JSON.parse(fs.readFileSync(LEDGER_FILE, 'utf-8'));
}

function saveLedger(entries) {
  fs.writeFileSync(LEDGER_FILE, JSON.stringify(entries, null, 2));
}

function recordPayment({ walletId, amount, currency, provider, description, metadata = {} }) {
  ensureDir();
  const entries = loadLedger();
  
  const entry = {
    id: `PAY-${Date.now()}`,
    walletId,
    amount,
    currency,
    provider,
    description,
    metadata,
    timestamp: new Date().toISOString(),
    status: 'recorded'
  };
  
  entries.push(entry);
  saveLedger(entries);
  
  // Generate a journal entry for this payment
  generateJournalEntry(entry);
  
  return entry;
}

function generateJournalEntry(payment) {
  ensureDir();
  const journalId = `JRN-${Date.now()}`;
  const journal = {
    id: journalId,
    paymentId: payment.id,
    walletId: payment.walletId,
    entries: [
      {
        account: '1001 - Cash',
        debit: payment.amount,
        credit: 0,
        description: `Payment received from ${payment.walletId}`
      },
      {
        account: '4001 - Revenue',
        debit: 0,
        credit: payment.amount,
        description: `${payment.description || 'Service revenue'}`
      },
      {
        account: '2001 - Tax Payable',
        debit: 0,
        credit: Math.round(payment.amount * 0.1 * 100) / 100,
        description: 'Estimated VAT/GST (10%)'
      }
    ],
    metadata: {
      provider: payment.provider,
      currency: payment.currency,
      timestamp: payment.timestamp
    },
    createdAt: new Date().toISOString(),
    status: 'posted'
  };
  
  const journalFile = path.join(JOURNAL_DIR, `${journalId}.json`);
  fs.writeFileSync(journalFile, JSON.stringify(journal, null, 2));
  return journal;
}

function getPayments(walletId = null) {
  const entries = loadLedger();
  if (walletId) return entries.filter(e => e.walletId === walletId);
  return entries;
}

function getJournals(paymentId = null) {
  ensureDir();
  const files = fs.readdirSync(JOURNAL_DIR).filter(f => f.endsWith('.json'));
  const journals = files.map(f => JSON.parse(fs.readFileSync(path.join(JOURNAL_DIR, f), 'utf-8')));
  if (paymentId) return journals.filter(j => j.paymentId === paymentId);
  return journals;
}

function getBalance(walletId) {
  const payments = getPayments(walletId);
  return payments.reduce((sum, p) => sum + p.amount, 0);
}

module.exports = { recordPayment, getPayments, getJournals, getBalance };
