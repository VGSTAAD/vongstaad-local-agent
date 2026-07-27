// Links wallet addresses to email identities
class IIdentityLink {
  link() { throw new Error("Not implemented"); }
  getByWallet() { throw new Error("Not implemented"); }
  getByEmail() { throw new Error("Not implemented"); }
  unlink() { throw new Error("Not implemented"); }
  listAll() { throw new Error("Not implemented"); }
}
module.exports = IIdentityLink;
