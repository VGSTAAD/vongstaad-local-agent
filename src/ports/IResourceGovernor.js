// Gemini quota management and auto‑throttle
class IResourceGovernor {
  getAction() { throw new Error("Not implemented"); }
  shouldThrottle() { throw new Error("Not implemented"); }
  shouldReduce() { throw new Error("Not implemented"); }
}
module.exports = IResourceGovernor;
