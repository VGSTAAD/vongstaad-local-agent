const fs = require('fs');
const geminiTracker = require('./gemini-tracker');
const path = require('path');

class ILLMProvider {
  async complete(agentName, history) {
    throw new Error('Not implemented');
  }
}

// Worker‑relay adapter – no local keys needed
class GeminiAdapter extends ILLMProvider {
  constructor(workerUrl, apiKey, model = 'gemini-3-flash-preview') {
    super();
    this.workerUrl = workerUrl;
    this.apiKey = apiKey;
    this.model = model;
  }

  async complete(agentName, history) {
    const prompt = history.map(m => `[${m.role}]: ${m.text}`).join('\n');
    try {
      const resp = await fetch(`${this.workerUrl}/gemini/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, model: this.model })
      });
      const data = await resp.json();
      return data.text || `[${agentName}] Error: ${data.error}`;
    } catch (err) {
      return `[${agentName}] Error: ${err.message}`;
    }
  }
}

class DevServerAdapter {
  constructor(baseUrl, apiKey) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }
  async run(command) {
    const response = await fetch(`${this.baseUrl}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: this.apiKey, cwd: '/home/mhk/workspaces', command }),
    });
    const data = await response.json();
    return data.ok ? (data.stdout || '') : `Error: ${data.stderr || 'Unknown error'}`;
  }
}

class SearchAdapter {
  async search(query) {
    try {
      const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`);
      const data = await response.json();
      if (data.Abstract) return data.Abstract;
      const heading = data.Heading || '';
      const related = (data.RelatedTopics || []).slice(0, 3).map(t => t.Text).join(' | ');
      return heading + ' ' + related || 'No results found.';
    } catch (err) {
      return `Search error: ${err.message}`;
    }
  }
}

class FileRoomRepository {
  constructor(baseDir) {
    this.baseDir = baseDir;
    if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true });
  }
  getRoom(roomId) {
    const file = path.join(this.baseDir, `${roomId}.json`);
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf-8'));
    return { messages: [], turn: 0 };
  }
  saveRoom(roomId, room) {
    const file = path.join(this.baseDir, `${roomId}.json`);
    fs.writeFileSync(file, JSON.stringify(room, null, 2), 'utf-8');
  }
}

class AgentLoopService {
  constructor(llmProvider, roomRepo, tools = {}) {
    this.llm = llmProvider;
    this.rooms = roomRepo;
    this.tools = tools;
  }
  async runLoop(roomId, task, agents, maxTurns = 5) {
    const room = this.rooms.getRoom(roomId);
    if (room.messages.length === 0) room.messages.push({ role: 'system', text: task });
    const startTurn = room.turn;
    for (let i = 0; i < maxTurns; i++) {
      const agent = agents[(startTurn + i) % agents.length];
      const reply = await this.llm.complete(agent.name, room.messages);
      room.messages.push({ role: agent.name, text: reply });
      room.turn = startTurn + i + 1;
      this.rooms.saveRoom(roomId, room);
      const toolResult = await this._executeTools(reply);
      if (toolResult) {
        room.messages.push({ role: 'system', text: toolResult });
        this.rooms.saveRoom(roomId, room);
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

const llmProvider = new GeminiAdapter(
  'https://vongstaad-agent-worker.restless-pond-8b7b.workers.dev',
  'vongstaad-dev-2026',
  'gemini-3-flash-preview'
);
const roomRepo = new FileRoomRepository(path.join(__dirname, 'agent-rooms'));
const devServer = new DevServerAdapter('http://localhost:3000', 'vongstaad-dev-2026');
const search = new SearchAdapter();
const agentService = new AgentLoopService(llmProvider, roomRepo, { devServer, search });

module.exports = { agentService };
