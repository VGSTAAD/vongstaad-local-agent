// Immutable event history
class ILedger {
  append() { throw new Error("Not implemented"); }
  query() { throw new Error("Not implemented"); }
}
module.exports = ILedger;
