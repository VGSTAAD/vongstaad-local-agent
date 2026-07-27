const crypto = require('crypto');

class DecisionContextPackage {
  /**
   * Generates a DCP for a given seat, occupant, and decision.
   * @param {object} params
   * @param {string} params.seatId       - e.g., "SEAT-001"
   * @param {string} params.seatVersion  - e.g., "1.0"
   * @param {string} params.occupantId   - e.g., "GPT-5" or "Claude"
   * @param {string} params.promptVersion - e.g., "SP-008"
   * @param {string[]} params.knowledgePackIds - e.g., ["KP-001", "KP-002"]
   * @param {string} params.constitutionVersion - e.g., "1.0"
   * @param {object} params.input       - the input evidence (e.g., git diff)
   * @param {object} params.output      - the decision output
   */
  static generate({ seatId, seatVersion, occupantId, promptVersion, knowledgePackIds, constitutionVersion, input, output }) {
    const dcp = {
      id: `DCP-${Date.now()}`,
      timestamp: new Date().toISOString(),
      seat: { id: seatId, version: seatVersion },
      occupant: { id: occupantId },
      prompt: { version: promptVersion },
      knowledgePacks: knowledgePackIds || [],
      constitution: { version: constitutionVersion },
      input,
      output,
      hash: null
    };
    dcp.hash = crypto.createHash('sha256').update(JSON.stringify(dcp)).digest('hex');
    return dcp;
  }
}

module.exports = DecisionContextPackage;
