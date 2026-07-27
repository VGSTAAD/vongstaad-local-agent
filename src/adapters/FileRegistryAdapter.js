const IRegistry = require('../ports/IRegistry');
const fs = require('fs');
const path = require('path');

class FileRegistryAdapter extends IRegistry {
  constructor() {
    super();
    this.DATA_DIR = path.join(__dirname, '../../registry-data');
    this.ENTITY_TYPES = ['seat', 'appointment', 'certification', 'precedent', 'knowledge-pack', 'prompt', 'constitution'];
    if (!fs.existsSync(this.DATA_DIR)) fs.mkdirSync(this.DATA_DIR, { recursive: true });
    for (const type of this.ENTITY_TYPES) {
      const dir = path.join(this.DATA_DIR, type);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }
  }

  _filePath(type, id) { return path.join(this.DATA_DIR, type, `${id}.json`); }

  create(type, id, data) {
    if (!this.ENTITY_TYPES.includes(type)) throw new Error(`Invalid entity type: ${type}`);
    const file = this._filePath(type, id);
    if (fs.existsSync(file)) throw new Error(`${type} ${id} already exists`);
    const record = { id, type, created: new Date().toISOString(), ...data };
    fs.writeFileSync(file, JSON.stringify(record, null, 2));
    return record;
  }

  get(type, id) {
    const file = this._filePath(type, id);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  }

  search(type, filter = {}) {
    const dir = path.join(this.DATA_DIR, type);
    if (!fs.existsSync(dir)) return [];
    const results = [];
    for (const filename of fs.readdirSync(dir)) {
      const record = JSON.parse(fs.readFileSync(path.join(dir, filename), 'utf-8'));
      let match = true;
      for (const key of Object.keys(filter)) {
        if (record[key] !== filter[key]) { match = false; break; }
      }
      if (match) results.push(record);
    }
    return results;
  }

  update(type, id, data) {
    const file = this._filePath(type, id);
    if (!fs.existsSync(file)) throw new Error(`${type} ${id} not found`);
    const record = JSON.parse(fs.readFileSync(file, 'utf-8'));
    Object.assign(record, data, { updated: new Date().toISOString() });
    fs.writeFileSync(file, JSON.stringify(record, null, 2));
    return record;
  }

  delete(type, id) {
    const file = this._filePath(type, id);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
}
module.exports = FileRegistryAdapter;
