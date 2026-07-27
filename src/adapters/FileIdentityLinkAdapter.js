const IIdentityLink = require('../ports/IIdentityLink');
const fs = require('fs');
const path = require('path');
class FileIdentityLinkAdapter extends IIdentityLink {
  constructor() {
    super();
    this.LINKS_FILE = path.join(__dirname, '../../identity-links.json');
  }
  link(walletId, email, metadata = {}) {
    const links = fs.existsSync(this.LINKS_FILE) ? JSON.parse(fs.readFileSync(this.LINKS_FILE, 'utf-8')) : [];
    if (links.find(l => l.walletId === walletId)) return { success: false, error: 'Wallet already linked' };
    if (links.find(l => l.email === email)) return { success: false, error: 'Email already linked' };
    const link = { id: `LINK-${Date.now()}`, walletId, email, metadata, createdAt: new Date().toISOString(), status: 'active' };
    links.push(link);
    fs.writeFileSync(this.LINKS_FILE, JSON.stringify(links, null, 2));
    return { success: true, link };
  }
  getByWallet(walletId) {
    if (!fs.existsSync(this.LINKS_FILE)) return null;
    return JSON.parse(fs.readFileSync(this.LINKS_FILE, 'utf-8')).find(l => l.walletId === walletId && l.status === 'active') || null;
  }
  getByEmail(email) {
    if (!fs.existsSync(this.LINKS_FILE)) return null;
    return JSON.parse(fs.readFileSync(this.LINKS_FILE, 'utf-8')).find(l => l.email === email && l.status === 'active') || null;
  }
  unlink(linkId) {
    if (!fs.existsSync(this.LINKS_FILE)) return { success: false, error: 'Link not found' };
    const links = JSON.parse(fs.readFileSync(this.LINKS_FILE, 'utf-8'));
    const idx = links.findIndex(l => l.id === linkId);
    if (idx === -1) return { success: false, error: 'Link not found' };
    links[idx].status = 'revoked';
    fs.writeFileSync(this.LINKS_FILE, JSON.stringify(links, null, 2));
    return { success: true, link: links[idx] };
  }
  listAll() { return fs.existsSync(this.LINKS_FILE) ? JSON.parse(fs.readFileSync(this.LINKS_FILE, 'utf-8')) : []; }
}
module.exports = FileIdentityLinkAdapter;