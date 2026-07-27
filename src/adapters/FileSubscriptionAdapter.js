const ISubscription = require('../ports/ISubscription');
class FileSubscriptionAdapter extends ISubscription {
  constructor(identityLink, accounting) { super(); this.identityLink = identityLink; this.accounting = accounting; }
  getStatus(walletId) { const link = this.identityLink.getByWallet(walletId); if (!link) return { status: 'unknown', message: 'Wallet not linked' }; const payments = this.accounting.getPayments(walletId); const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0); return { walletId, email: link.email, status: totalPaid >= 29.99 ? 'active' : 'pending', totalPaid, currency: payments[0]?.currency || 'USD', payments: payments.length }; }
}
module.exports = FileSubscriptionAdapter;