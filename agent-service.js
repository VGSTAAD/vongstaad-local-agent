const fs = require('fs');
const geminiTracker = require('./gemini-tracker');
const path = require('path');

class ILLMProvider {
  async complete(agentName, history) {
    throw new Error('Not implemented');
  }
}

class GeminiAdapter extends ILLMProvider {
  constructor(apiKeys, model = 'gemini-3-flash-preview') {
    super();
    this.apiKeys = apiKeys;
    this.model = model;
    this.currentKeyIndex = 0;
  }

  async complete(agentName, history) {
    const contents = history.map(m => ({
      role: 'user',
      parts: [{ text: `[${m.role}]: ${m.text}` }]
    }));

    const toolSystemPrompt = {
      role: 'user',
      parts: [{
        text: `[SYSTEM INSTRUCTION]
You have access to the following tools:

1. Code Execution - to run a shell command on the local machine, output exactly:
   [RUN: <command>]

2. Web Search - to search the internet for real-time information, output exactly:
   [SEARCH: <query>]

When the user asks for something that requires external data or code execution, you MUST use the appropriate tool. Do not pretend to have web access if you do not. Simply output the tool trigger and nothing else. After the tool result is provided, you can continue the conversation.

Now, respond to the following conversation.`
      }]
    };
    contents.unshift(toolSystemPrompt);

    for (let attempt = 0; attempt < this.apiKeys.length; attempt++) {
      const key = this.apiKeys[this.currentKeyIndex];
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${key}`;
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents }),
        });
        const data = await response.json();
        if (!data.error) {
          geminiTracker.recordUsage(this.currentKeyIndex);
          return data.candidates[0].content.parts[0].text;
        }
        if (data.error.message && (data.error.message.includes('quota') || data.error.message.includes('429') || data.error.message.includes('rate'))) {
          console.warn(`Gemini key ${this.currentKeyIndex + 1} quota exhausted, waiting 5s...'); await new Promise(r => setTimeout(r, 5000));`);
          this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
          continue;
        }
        return `[${agentName}] Error: ${data.error.message}`;
      } catch (err) {
        console.error(`Gemini key ${this.currentKeyIndex + 1} network error:`, err.message);
        this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
      }
    }
    return `[${agentName}] Error: All Gemini keys exhausted (quota or network error).`;
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
    if (data.ok) {
      return data.stdout || '';
    } else {
      return `Error: ${data.stderr || 'Unknown error'}`;
    }
  }
}

class SearchAdapter {
  async search(query) {
    try {
      const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`);
      const data = await response.json();
      if (data.Abstract) {
        return data.Abstract;
      }
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
    if (room.messages.length === 0) {
      room.messages.push({ role: 'system', text: task });
    }

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
      const command = runMatch[1].trim();
      const output = await this.tools.devServer.run(command);
      return `[Tool: Code Execution]\nCommand: ${command}\nOutput:\n${output}`;
    }

    const searchMatch = text.match(/\[SEARCH:\s*(.*?)\]/);
    if (searchMatch && this.tools.search) {
      const query = searchMatch[1].trim();
      const results = await this.tools.search.search(query);
      return `[Tool: Web Search]\nQuery: ${query}\nResults:\n${results}`;
    }

    return null;
  }
}

const GEMINI_API_KEYS = process.env.GEMINI_KEYS ? process.env.GEMINI_KEYS.split(',') : ['YOUR_GEMINI_KEY_HERE']; // Replace with real keys via environment variable
// Old keys removed for security; set GEMINI_KEYS env var or hardcode below
const _OLD_KEYS = [
];
const llmProvider = new GeminiAdapter(GEMINI_API_KEYS, 'gemini-3-flash-preview');
const roomRepo = new FileRoomRepository(path.join(__dirname, 'agent-rooms'));

const DEV_SERVER_URL = 'http://localhost:3000';
const DEV_SERVER_API_KEY = 'vongstaad-dev-2026';

const devServer = new DevServerAdapter(DEV_SERVER_URL, DEV_SERVER_API_KEY);
const search = new SearchAdapter();

const agentService = new AgentLoopService(llmProvider, roomRepo, { devServer, search });

module.exports = { agentService };
