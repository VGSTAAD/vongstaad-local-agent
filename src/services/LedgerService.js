class LedgerService {
  constructor(ledgerAdapter) {
    this.adapter = ledgerAdapter;
  }
  append(event) { return this.adapter.append(event); }
  query(filter, limit) { return this.adapter.query(filter, limit); }
}
module.exports = LedgerService;
