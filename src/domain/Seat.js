/**
 * Domain: Seat
 * A Seat is a bounded delegation of Authority from an Office.
 */
class Seat {
  constructor(id, officeId, authorities = []) {
    if (!id || !officeId) throw new Error('Seat requires id and officeId');
    this.id = id;
    this.officeId = officeId;
    this.authorities = authorities;  // e.g. ['technology','deployment']
  }

  canExecute(action) {
    return this.authorities.includes(action);
  }
}

module.exports = Seat;
