/**
 * Port: IFactStore
 * Version 1.0 – Frozen
 */
class IFactStore {
  async append(fact) { throw new Error('Not implemented'); }
  async getAll() { throw new Error('Not implemented'); }
  async findById(id) { throw new Error('Not implemented'); }
  async replay() { throw new Error('Not implemented'); }
}
module.exports = IFactStore;
