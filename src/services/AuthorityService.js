const Office = require('../domain/Office');
const Seat = require('../domain/Seat');
const Occupant = require('../domain/Occupant');

/**
 * AuthorityService – builds projection from FactStore and serves authority queries.
 */
class AuthorityService {
  constructor(factStore) {
    this.factStore = factStore;
    this.ready = false;
    this.offices = new Map();    // id -> Office
    this.seats = new Map();      // id -> Seat
    this.occupants = new Map();  // id -> Occupant
    this.constitutionVersion = '1.0';
  }

  async init() {
    const facts = await this.factStore.replay();
    for (const fact of facts) {
      switch (fact.type) {
        case 'OFFICES_CREATED':
          if (fact.data.offices) {
            fact.data.offices.forEach(o => this.offices.set(o.id, new Office(o.id, o.name)));
          }
          break;
  case 'SEATS_CREATED':
  if (fact.data.seats) {
    fact.data.seats.forEach(s => {
      // Derive office from seat ID (e.g., FOUNDER_SEAT -> FOUNDER)
      const officeId = s.id.split('_')[0];
      this.seats.set(s.id, new Seat(s.id, officeId, s.authority));
    });
  }
  break;

        case 'OCCUPANTS_APPOINTED':
          if (fact.data.appointments) {
            fact.data.appointments.forEach(a => {
              const occ = new Occupant(a.occupant, a.occupant, a.seat);
              this.occupants.set(a.occupant, occ);
            });
          }
          break;
        case 'VERSION_1_DECLARED':
          this.constitutionVersion = fact.data.version;
          break;
      }
    }
    this.ready = true;
  }

  async getOffice(id) {
    if (!this.ready) throw new Error('AuthorityService not initialized');
    return this.offices.get(id) || null;
  }

  async getSeat(id) {
    if (!this.ready) throw new Error('AuthorityService not initialized');
    return this.seats.get(id) || null;
  }

  async getOccupant(id) {
    if (!this.ready) throw new Error('AuthorityService not initialized');
    return this.occupants.get(id) || null;
  }

  async canExecute(seatId, action) {
    if (!this.ready) throw new Error('AuthorityService not initialized');
    const seat = this.seats.get(seatId);
    if (!seat) return false;
    return seat.canExecute(action);
  }

  async getConstitutionVersion() {
    return this.constitutionVersion;
  }
}

module.exports = AuthorityService;
