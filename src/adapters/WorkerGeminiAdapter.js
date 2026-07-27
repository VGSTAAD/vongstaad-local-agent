const { ILLMProvider } = require('../ports/ILLMProvider');

class WorkerGeminiAdapter extends ILLMProvider {
  /**
   * @param {string} workerUrl - The Cloudflare Worker URL
   * @param {string} model - Gemini model name (passed to the Worker)
   */
  constructor(workerUrl, model = 'gemini-3-flash-preview') {
    super();
    this.workerUrl = workerUrl;
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
      if (data.text) return data.text;
      return `[${agentName}] Error: ${data.error || 'Unknown error'}`;
    } catch (err) {
      return `[${agentName}] Network error: ${err.message}`;
    }
  }
}

module.exports = { WorkerGeminiAdapter };
