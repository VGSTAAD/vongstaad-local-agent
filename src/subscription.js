const identityLink = require('./identity-link');
const accounting = require('./accounting');

function getSubscriptionStatus(walletId) {
  const link = identityLink.getByWallet(walletId);
  if (!link) return { status: 'unknown', message: 'Wallet not linked to any email' };

  const payments = accounting.getPayments(walletId);
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const active = totalPaid >= 29.99; // simplified: any total >= 29.99 = active

  return {
    walletId,
    email: link.email,
    status: active ? 'active' : 'pending',
    totalPaid,
    currency: payments[0]?.currency || 'USD',
    payments: payments.length
  };
}

module.exports = { getSubscriptionStatus };
