// Institutional state snapshots and rollback
class IStateEngine {
  capture() { throw new Error("Not implemented"); }
  list() { throw new Error("Not implemented"); }
  get() { throw new Error("Not implemented"); }
  diff() { throw new Error("Not implemented"); }
  restore() { throw new Error("Not implemented"); }
  getCurrent() { throw new Error("Not implemented"); }
}
module.exports = IStateEngine;
