class RegistryService {
  constructor(registryAdapter) {
    this.adapter = registryAdapter;
  }
  create(type, id, data) { return this.adapter.create(type, id, data); }
  get(type, id) { return this.adapter.get(type, id); }
  search(type, filter) { return this.adapter.search(type, filter); }
  update(type, id, data) { return this.adapter.update(type, id, data); }
  delete(type, id) { return this.adapter.delete(type, id); }
}
module.exports = RegistryService;
