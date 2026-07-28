/**
 * Domain: Office
 * An Office is a permanent constitutional authority.
 */
class Office {
  constructor(id, name) {
    if (!id || !name) throw new Error('Office requires id and name');
    this.id = id;
    this.name = name;
  }
}

module.exports = Office;
