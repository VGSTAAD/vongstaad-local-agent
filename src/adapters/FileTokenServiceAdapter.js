const ITokenService = require('../ports/ITokenService');
const crypto = require('crypto');
class FileTokenServiceAdapter extends ITokenService {
  constructor() { super(); this.tokens = new Map(); }
  issue(seatId, capabilities, expiresInMinutes = 120) { const id = `TOK-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`; const token = { id, seatId, capabilities, issuedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + expiresInMinutes * 60000).toISOString(), status: 'active' }; this.tokens.set(id, token); return token; }
  validate(tokenId, requiredCapability) { const t = this.tokens.get(tokenId); if (!t) return { valid: false, reason: 'Token not found' }; if (new Date() > new Date(t.expiresAt)) { this.tokens.delete(tokenId); return { valid: false, reason: 'Token expired' }; } if (requiredCapability && !t.capabilities.includes(requiredCapability)) return { valid: false, reason: `Capability "${requiredCapability}" not granted` }; return { valid: true, token: t }; }
  revoke(tokenId) { this.tokens.delete(tokenId); return { revoked: true }; }
  listActive() { return Array.from(this.tokens.values()).filter(t => new Date() <= new Date(t.expiresAt)); }
}
module.exports = FileTokenServiceAdapter;