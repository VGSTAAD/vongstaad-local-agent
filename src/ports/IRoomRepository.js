/**
 * Port: Room Repository
 * Stores and retrieves conversation histories.
 */
class IRoomRepository {
  /**
   * @param {string} roomId
   * @returns {Promise<{messages: Array, turn: number}>}
   */
  async getRoom(roomId) {
    throw new Error('IRoomRepository.getRoom() not implemented');
  }

  /**
   * @param {string} roomId
   * @param {{messages: Array, turn: number}} room
   * @returns {Promise<void>}
   */
  async saveRoom(roomId, room) {
    throw new Error('IRoomRepository.saveRoom() not implemented');
  }
}

module.exports = { IRoomRepository };
