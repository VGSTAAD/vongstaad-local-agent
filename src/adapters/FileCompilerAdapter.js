const ICompiler = require('../ports/ICompiler');
const fs = require('fs');
const path = require('path');

class FileCompilerAdapter extends ICompiler {
  constructor() {
    super();
    this.rules = JSON.parse(fs.readFileSync(path.join(__dirname, '../../constitution.json'), 'utf-8'));
  }

  compile(config) {
    const violations = [];
    if (config.promptText) {
      for (const forbidden of this.rules.forbiddenActions || []) {
        if (config.promptText.toLowerCase().includes(forbidden.toLowerCase())) violations.push(`PROMPT_FORBIDDEN: "${forbidden}"`);
      }
      for (const lib of this.rules.forbiddenLibraries || []) {
        if (config.promptText.toLowerCase().includes(lib.toLowerCase())) violations.push(`LIBRARY_FORBIDDEN: "${lib}"`);
      }
    }
    if (config.constitutionVersion && config.constitutionVersion !== this.rules.version) violations.push(`VERSION_MISMATCH: ${config.constitutionVersion} vs ${this.rules.version}`);
    if (config.requestedAuthority && this.rules.seats?.[config.seatId]) {
      for (const auth of config.requestedAuthority) {
        if (!this.rules.seats[config.seatId].allowedActions?.includes(auth)) violations.push(`AUTHORITY_VIOLATION: ${auth}`);
      }
    }
    return { valid: violations.length === 0, violations };
  }
}
module.exports = FileCompilerAdapter;
