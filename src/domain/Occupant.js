/**
 * Domain: Occupant
 * An Occupant temporarily exercises a Seat.
 */
class Occupant {
  constructor(id, name, seatId) {
    if (!id || !name || !seatId) throw new Error('Occupant requires id, name, seatId');
    this.id = id;
    this.name = name;
    this.seatId = seatId;
  }
}

module.exports = Occupant;
