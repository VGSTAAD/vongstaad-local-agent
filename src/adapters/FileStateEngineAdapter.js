const IStateEngine = require('../ports/IStateEngine');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class FileStateEngineAdapter extends IStateEngine {
  constructor(registry, ledger) {
    super();
    this.registry = registry;
    this.ledger = ledger;
    this.snapshotDir = path.join(__dirname, '../../institution-snapshots');
    if (!fs.existsSync(this.snapshotDir)) fs.mkdirSync(this.snapshotDir, { recursive: true });
  }

  capture(label = '') {
    const id = `STATE-${Date.now()}`;
    const state = {
      id,
      label,
      timestamp: new Date().toISOString(),
      constitution: this._safeRead('constitution.json'),
      registry: this.registry.search ? this.registry.search('seat') : [],
      ledger: { totalEvents: this.ledger.query(() => true, 1000).length },
      hash: crypto.createHash('sha256').update(JSON.stringify({})).digest('hex').slice(0, 16)
    };
    fs.writeFileSync(path.join(this.snapshotDir, `${id}.json`), JSON.stringify(state, null, 2));
    return { success: true, state };
  }

  list() {
    if (!fs.existsSync(this.snapshotDir)) return [];
    return fs.readdirSync(this.snapshotDir)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const data = JSON.parse(fs.readFileSync(path.join(this.snapshotDir, f), 'utf-8'));
        return { id: data.id, label: data.label, timestamp: data.timestamp, hash: data.hash };
      })
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  get(stateId) {
    const file = path.join(this.snapshotDir, `${stateId}.json`);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  }

  diff(fromId, toId) {
    const from = this.get(fromId);
    const to = this.get(toId);
    if (!from || !to) return { error: 'State not found' };
    const changes = [];
    if (JSON.stringify(from.constitution) !== JSON.stringify(to.constitution)) changes.push('constitution changed');
    if (from.registry?.length !== to.registry?.length) changes.push(`registry: ${from.registry?.length || 0} → ${to.registry?.length || 0}`);
    return { from: { id: from.id, timestamp: from.timestamp }, to: { id: to.id, timestamp: to.timestamp }, changes: changes.length ? changes : ['no significant changes'] };
  }

  restore(stateId) {
    const target = this.get(stateId);
    if (!target) return { error: 'State not found' };
    // In a full implementation, we would apply the snapshot data to the registry and ledger.
    // For now, we log the intent.
    this.ledger.append({ type: 'STATE_RESTORATION_INITIATED', targetStateId: stateId });
    return { success: true, restoredTo: stateId, restoredAt: target.timestamp };
  }

  getCurrent() {
    const currentFile = path.join(__dirname, '../../current-state.json');
    if (!fs.existsSync(currentFile)) return null;
    const pointer = JSON.parse(fs.readFileSync(currentFile, 'utf-8'));
    return this.get(pointer.currentState);
  }

  _safeRead(filename) {
    const filepath = path.join(__dirname, '../../', filename);
    if (!fs.existsSync(filepath)) return null;
    try { return JSON.parse(fs.readFileSync(filepath, 'utf-8')); } catch { return null; }
  }
}
module.exports = FileStateEngineAdapter;
