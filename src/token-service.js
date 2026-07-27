const crypto = require('crypto');

class TokenService {
  constructor() {
    this.activeTokens = new Map();
  }

  issue(seatId, capabilities, expiresInMinutes = 120) {
    const tokenId = `TOK-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const token = {
      id: tokenId,
      seatId,
      capabilities,
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + expiresInMinutes * 60000).toISOString(),
      status: 'active'
    };
    this.activeTokens.set(tokenId, token);
    return token;
  }

  validate(tokenId, requiredCapability) {
    const token = this.activeTokens.get(tokenId);
    if (!token) return { valid: false, reason: 'Token not found' };
    if (new Date() > new Date(token.expiresAt)) {
      this.activeTokens.delete(tokenId);
      return { valid: false, reason: 'Token expired' };
    }
    if (requiredCapability && !token.capabilities.includes(requiredCapability)) {
      return { valid: false, reason: `Capability "${requiredCapability}" not granted` };
    }
    return { valid: true, token };
  }

  revoke(tokenId) {
    this.activeTokens.delete(tokenId);
    return { revoked: true };
  }

  listActive() {
    return Array.from(this.activeTokens.values()).filter(t => new Date() <= new Date(t.expiresAt));
  }
}

module.exports = new TokenService();
