/**
 * Port: AI Language Model Provider
 * Any adapter that can complete a conversation turn must implement this interface.
 */
class ILLMProvider {
  /**
   * @param {string} agentName - The name of the agent speaking
   * @param {Array<{role: string, text: string}>} history - The full conversation history
   * @returns {Promise<string>} The agent's reply
   */
  async complete(agentName, history) {
    throw new Error('ILLMProvider.complete() not implemented');
  }
}

module.exports = { ILLMProvider };
