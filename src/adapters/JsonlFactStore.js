const fs = require('fs').promises;
const path = require('path');
const IFactStore = require('../ports/IFactStore');

class JsonlFactStore extends IFactStore {
  constructor(filePath) {
    super();
    this.filePath = filePath;
    this.ready = false;
  }

  async init() {
    try { await fs.access(this.filePath); }
    catch { await fs.writeFile(this.filePath, ''); }
    this.ready = true;
  }

  async append(fact) {
    if (!this.ready) throw new Error('Store not initialized');
    if (!fact.id || !fact.type || !fact.authority) {
      throw new Error('Fact missing required fields: id, type, authority');
    }
    const validTypes = [
      'FOUNDER_REGISTERED','MISSION_ESTABLISHED','CONSTITUTION_RATIFIED',
      'VERSION_1_DECLARED','OFFICES_CREATED','SEATS_CREATED',
      'OCCUPANTS_APPOINTED','TECHNICAL_FOUNDATION_RATIFIED',
      'TECH_STACK_REGISTERED','SYSTEM_STRUCTURE_REGISTERED',
      'FACT_SCHEMA_REGISTERED','DECISION_RECORDED',
      'AI_ADAPTER_REGISTERED','ADAPTERS_REGISTERED',
      'API_CONTRACT_REGISTERED','ENGINEERING_DISCIPLINE_REGISTERED',
      'SECURITY_POLICY_REGISTERED','RECOVERY_POLICY_REGISTERED',
      'INSTITUTION_OPERATION_STARTED','EVOLUTION_PROTOCOL_REGISTERED'
    ];
    if (!validTypes.includes(fact.type)) {
      throw new Error(`Unknown fact type: ${fact.type}`);
    }
    const line = JSON.stringify(fact) + '\n';
    await fs.appendFile(this.filePath, line, 'utf8');
  }

  async getAll() {
    if (!this.ready) throw new Error('Store not initialized');
    const raw = await fs.readFile(this.filePath, 'utf8');
    if (!raw.trim()) return [];
    return raw.trim().split('\n').map(line => JSON.parse(line));
  }

  async findById(id) {
    const all = await this.getAll();
    return all.find(f => f.id === id) || null;
  }

  async replay() {
    return this.getAll();
  }
}
module.exports = JsonlFactStore;
