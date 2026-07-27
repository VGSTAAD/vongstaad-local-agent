const fs = require('fs');
const path = require('path');

class ConstitutionalCompiler {
  constructor(constitutionPath) {
    this.rules = JSON.parse(fs.readFileSync(constitutionPath, 'utf-8'));
  }

  /**
   * Validates an Occupant Configuration against the Constitution.
   * @param {object} config
   * @param {string} config.seatId
   * @param {string} config.promptVersion
   * @param {string[]} config.knowledgePackIds
   * @param {string} config.occupantId
   * @returns {{ valid: boolean, violations: string[] }}
   */
  compile(config) {
    const violations = [];

    // Check for forbidden actions in prompt
    if (config.promptText) {
      for (const forbidden of this.rules.forbiddenActions || []) {
        if (config.promptText.toLowerCase().includes(forbidden.toLowerCase())) {
          violations.push(`PROMPT_FORBIDDEN: Prompt contains forbidden action "${forbidden}"`);
        }
      }
    }

    // Check for forbidden libraries
    if (config.promptText) {
      for (const lib of this.rules.forbiddenLibraries || []) {
        if (config.promptText.toLowerCase().includes(lib.toLowerCase())) {
          violations.push(`LIBRARY_FORBIDDEN: Prompt references forbidden library "${lib}"`);
        }
      }
    }

    // Check for version mismatches
    if (config.constitutionVersion && config.constitutionVersion !== this.rules.version) {
      violations.push(`VERSION_MISMATCH: Occupant uses Constitution ${config.constitutionVersion}, but current is ${this.rules.version}`);
    }

    // Check for unauthorized seat authority
    if (config.requestedAuthority) {
      const seatRules = this.rules.seats?.[config.seatId];
      if (seatRules) {
        for (const auth of config.requestedAuthority) {
          if (!seatRules.allowedActions?.includes(auth)) {
            violations.push(`AUTHORITY_VIOLATION: Seat ${config.seatId} cannot perform "${auth}"`);
          }
        }
      }
    }

    return {
      valid: violations.length === 0,
      violations
    };
  }
}

module.exports = ConstitutionalCompiler;
