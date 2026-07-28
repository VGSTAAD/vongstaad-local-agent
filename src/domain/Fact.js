/**
 * Domain: Fact
 * Represents an institutional fact as a pure domain object (not storage).
 */
class Fact {
  constructor({ id, sequence, timestamp, type, data, authority, constitutionVersion, parentFactId }) {
    this.id = id;
    this.sequence = sequence;
    this.timestamp = timestamp;
    this.type = type;
    this.data = data;
    this.authority = authority;
    this.constitutionVersion = constitutionVersion;
    this.parentFactId = parentFactId || null;
  }
}

module.exports = Fact;
