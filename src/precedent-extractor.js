const fs = require('fs');
const path = require('path');

const PRECEDENT_DIR = path.join(__dirname, 'precedent-bank');
const INDEX_FILE = path.join(PRECEDENT_DIR, 'index.json');

function ensureDir() {
  if (!fs.existsSync(PRECEDENT_DIR)) fs.mkdirSync(PRECEDENT_DIR, { recursive: true });
}

function loadIndex() {
  if (!fs.existsSync(INDEX_FILE)) return [];
  return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf-8'));
}

function saveIndex(index) {
  fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));
}

function extractPrecedents(ledger) {
  ensureDir();
  const events = ledger.query(e => e.type === 'CODE_REVIEW', 500);
  const index = loadIndex();
  const newCases = [];

  for (const event of events) {
    const caseId = `CASE-${event.id}`;
    const caseFile = path.join(PRECEDENT_DIR, `${caseId}.json`);
    if (fs.existsSync(caseFile)) continue; // already extracted

    const precedent = {
      caseId,
      timestamp: event.timestamp,
      seatId: event.seatId,
      repo: event.repo,
      commit: event.commit,
      recommendation: event.recommendation,
      dcpId: event.dcpId,
      tags: [],
      status: 'extracted'
    };

    // Auto-tag based on recommendation
    if (event.recommendation === 'reject') precedent.tags.push('rejection');
    if (event.recommendation === 'approve') precedent.tags.push('approval');
    if (event.recommendation === 'review') precedent.tags.push('review-required');

    // If violations were logged in the same event (we could also fetch the full DCP), add them
    if (event.violations) {
      precedent.violations = event.violations;
      precedent.tags.push('violation');
    }

    fs.writeFileSync(caseFile, JSON.stringify(precedent, null, 2));
    index.push({
      caseId,
      timestamp: event.timestamp,
      recommendation: event.recommendation,
      tags: precedent.tags
    });
    newCases.push(precedent);
  }

  saveIndex(index);
  return newCases;
}

module.exports = { extractPrecedents };
