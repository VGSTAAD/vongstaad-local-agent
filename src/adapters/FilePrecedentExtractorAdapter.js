const IPrecedentExtractor = require('../ports/IPrecedentExtractor');
const fs = require('fs');
const path = require('path');
class FilePrecedentExtractorAdapter extends IPrecedentExtractor {
  constructor() { super(); this.PRECEDENT_DIR = path.join(__dirname, '../../precedent-bank'); this.INDEX_FILE = path.join(this.PRECEDENT_DIR, 'index.json'); if (!fs.existsSync(this.PRECEDENT_DIR)) fs.mkdirSync(this.PRECEDENT_DIR, { recursive: true }); if (!fs.existsSync(this.INDEX_FILE)) fs.writeFileSync(this.INDEX_FILE, '[]'); }
  extract(ledger) {
    const events = ledger.query(e => e.type === 'CODE_REVIEW', 500);
    const index = JSON.parse(fs.readFileSync(this.INDEX_FILE, 'utf-8'));
    const newCases = [];
    for (const event of events) {
      const caseId = `CASE-${event.id}`;
      if (fs.existsSync(path.join(this.PRECEDENT_DIR, `${caseId}.json`))) continue;
      const precedent = { caseId, timestamp: event.timestamp, seatId: event.seatId, repo: event.repo, commit: event.commit, recommendation: event.recommendation, dcpId: event.dcpId, tags: [], status: 'extracted' };
      if (event.recommendation === 'reject') precedent.tags.push('rejection');
      else if (event.recommendation === 'approve') precedent.tags.push('approval');
      else precedent.tags.push('review-required');
      fs.writeFileSync(path.join(this.PRECEDENT_DIR, `${caseId}.json`), JSON.stringify(precedent, null, 2));
      index.push({ caseId, timestamp: event.timestamp, recommendation: event.recommendation, tags: precedent.tags });
      newCases.push(precedent);
    }
    fs.writeFileSync(this.INDEX_FILE, JSON.stringify(index, null, 2));
    return newCases;
  }
}
module.exports = FilePrecedentExtractorAdapter;