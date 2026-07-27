const { ILLMProvider } = require('../ports/ILLMProvider');
const { IRoomRepository } = require('../ports/IRoomRepository');

class AgentLoopService {
  /**
   * @param {ILLMProvider} llmProvider
   * @param {IRoomRepository} roomRepo
   * @param {{ devServer?: {run: function}, search?: {search: function} }} tools
   */
  constructor(llmProvider, roomRepo, tools = {}) {
    this.llm = llmProvider;
    this.rooms = roomRepo;
    this.tools = tools;
  }

  async runLoop(roomId, task, agents, maxTurns = 5) {
    const room = await this.rooms.getRoom(roomId);
    if (room.messages.length === 0) {
      room.messages.push({ role: 'system', text: task });
    }
    const startTurn = room.turn;
    for (let i = 0; i < maxTurns; i++) {
      const agent = agents[(startTurn + i) % agents.length];
      const reply = await this.llm.complete(agent.name, room.messages);
      room.messages.push({ role: agent.name, text: reply });
      room.turn = startTurn + i + 1;
      await this.rooms.saveRoom(roomId, room);

      const toolResult = await this._executeTools(reply);
      if (toolResult) {
        room.messages.push({ role: 'system', text: toolResult });
        await this.rooms.saveRoom(roomId, room);
      }
    }
    return room.messages;
  }

  async _executeTools(text) {
    const runMatch = text.match(/\[RUN:\s*(.*?)\]/);
    if (runMatch && this.tools.devServer) {
      const output = await this.tools.devServer.run(runMatch[1].trim());
      return `[Tool: Code Execution]\nCommand: ${runMatch[1].trim()}\nOutput:\n${output}`;
    }
    const searchMatch = text.match(/\[SEARCH:\s*(.*?)\]/);
    if (searchMatch && this.tools.search) {
      const results = await this.tools.search.search(searchMatch[1].trim());
      return `[Tool: Web Search]\nQuery: ${searchMatch[1].trim()}\nResults:\n${results}`;
    }
    return null;
  }
}

module.exports = { AgentLoopService };
