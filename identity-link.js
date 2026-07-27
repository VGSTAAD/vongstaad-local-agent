const fs = require('fs');
const path = require('path');

const LINKS_FILE = path.join(__dirname, 'identity-links.json');

function loadLinks() {
  if (!fs.existsSync(LINKS_FILE)) return [];
  return JSON.parse(fs.readFileSync(LINKS_FILE, 'utf-8'));
}

function saveLinks(links) {
  fs.writeFileSync(LINKS_FILE, JSON.stringify(links, null, 2));
}

function linkWalletToEmail(walletId, email, metadata = {}) {
  const links = loadLinks();
  
  // Check if wallet already linked
  const existingWallet = links.find(l => l.walletId === walletId);
  if (existingWallet) {
    return { success: false, error: 'Wallet already linked to an email', existing: existingWallet };
  }
  
  // Check if email already linked
  const existingEmail = links.find(l => l.email === email);
  if (existingEmail) {
    return { success: false, error: 'Email already linked to a wallet', existing: existingEmail };
  }

  const link = {
    id: `LINK-${Date.now()}`,
    walletId,
    email,
    metadata,
    createdAt: new Date().toISOString(),
    status: 'active'
  };
  
  links.push(link);
  saveLinks(links);
  return { success: true, link };
}

function getByWallet(walletId) {
  const links = loadLinks();
  return links.find(l => l.walletId === walletId && l.status === 'active') || null;
}

function getByEmail(email) {
  const links = loadLinks();
  return links.find(l => l.email === email && l.status === 'active') || null;
}

function unlink(linkId) {
  const links = loadLinks();
  const idx = links.findIndex(l => l.id === linkId);
  if (idx === -1) return { success: false, error: 'Link not found' };
  links[idx].status = 'revoked';
  links[idx].revokedAt = new Date().toISOString();
  saveLinks(links);
  return { success: true, link: links[idx] };
}

function listAll() {
  return loadLinks();
}

module.exports = { linkWalletToEmail, getByWallet, getByEmail, unlink, listAll };
