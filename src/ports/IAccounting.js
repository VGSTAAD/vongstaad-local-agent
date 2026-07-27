// Mock accounting wing with double‑entry journals
class IAccounting {
  recordPayment() { throw new Error("Not implemented"); }
  getPayments() { throw new Error("Not implemented"); }
  getJournals() { throw new Error("Not implemented"); }
  getBalance() { throw new Error("Not implemented"); }
}
module.exports = IAccounting;
