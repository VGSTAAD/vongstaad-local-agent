/**
 * Port: IAuthority
 * Version 1.0 – Frozen
 */
class IAuthority {
  /** @returns {Office|null} */
  async getOffice(id) { throw new Error('Not implemented'); }
  /** @returns {Seat|null} */
  async getSeat(id) { throw new Error('Not implemented'); }
  /** @returns {Occupant|null} */
  async getOccupant(id) { throw new Error('Not implemented'); }
  /** @returns {boolean} */
  async canExecute(seatId, action) { throw new Error('Not implemented'); }
  /** @returns {string} current constitution version */
  async getConstitutionVersion() { throw new Error('Not implemented'); }
}
module.exports = IAuthority;
