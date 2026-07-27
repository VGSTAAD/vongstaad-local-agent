const { ILLMProvider } = require('../ports/ILLMProvider');

class GeminiAdapter extends ILLMProvider {
  constructor(apiKeys, model = 'gemini-3-flash-preview') {
    super();
    this.apiKeys = Array.isArray(apiKeys) ? apiKeys : [apiKeys];
    this.model = model;
    this.currentKeyIndex = 0;
  }

  async complete(agentName, history) {
    const contents = history.map(m => ({
      role: m.role === 'system' ? 'user' : 'user',
      parts: [{ text: `[${m.role}]: ${m.text}` }]
    }));

    let lastError = null;
    for (let attempt = 0; attempt < this.apiKeys.length; attempt++) {
      const key = this.apiKeys[this.currentKeyIndex];
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${key}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents })
          }
        );
        const data = await response.json();
        if (data.error) {
          lastError = data.error;
          this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
          continue;
        }
        return data.candidates[0].content.parts[0].text;
      } catch (err) {
        lastError = err;
        this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
      }
    }
    return `[${agentName}] Error: ${lastError?.message || 'All keys exhausted'}`;
  }
}
module.exports = GeminiAdapter;