// Time‑bound capability tokens
class ITokenService {
  issue() { throw new Error("Not implemented"); }
  validate() { throw new Error("Not implemented"); }
  revoke() { throw new Error("Not implemented"); }
  listActive() { throw new Error("Not implemented"); }
}
module.exports = ITokenService;
