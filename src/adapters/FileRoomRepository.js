const fs = require('fs');
const path = require('path');
const { IRoomRepository } = require('../ports/IRoomRepository');

class FileRoomRepository extends IRoomRepository {
  constructor(baseDir) {
    super();
    this.baseDir = baseDir;
    if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true });
  }

  async getRoom(roomId) {
    const file = path.join(this.baseDir, `${roomId}.json`);
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf-8'));
    }
    return { messages: [], turn: 0 };
  }

  async saveRoom(roomId, room) {
    const file = path.join(this.baseDir, `${roomId}.json`);
    fs.writeFileSync(file, JSON.stringify(room, null, 2), 'utf-8');
  }
}

module.exports = { FileRoomRepository };
