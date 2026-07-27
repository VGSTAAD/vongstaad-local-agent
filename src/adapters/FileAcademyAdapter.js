const IAcademy = require('../ports/IAcademy');
const fs = require('fs');
const path = require('path');

class FileAcademyAdapter extends IAcademy {
  constructor(registry, ledger) {
    super();
    this.registry = registry;
    this.ledger = ledger;
    this.CASES_DIR = path.join(__dirname, '../../academy-cases');
    if (!fs.existsSync(this.CASES_DIR)) fs.mkdirSync(this.CASES_DIR, { recursive: true });
  }

  async evaluate(config) {
    const { seatId, occupantId, promptVersion, knowledgePackIds, adapter } = config;
    const caseDir = path.join(this.CASES_DIR, seatId);
    if (!fs.existsSync(caseDir)) return { passed: true, score: 1.0, message: 'No test cases defined yet' };
    const cases = fs.readdirSync(caseDir).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(path.join(caseDir, f), 'utf-8')));
    let passed = 0;
    const results = [];
    for (const testCase of cases) {
      try {
        const output = await adapter(testCase.input);
        const isCorrect = this._validate(testCase.expected, output);
        results.push({ caseId: testCase.id, description: testCase.description, passed: isCorrect, expected: testCase.expected, actual: output });
        if (isCorrect) passed++;
      } catch (err) {
        results.push({ caseId: testCase.id, description: testCase.description, passed: false, error: err.message });
      }
    }
    const score = cases.length > 0 ? passed / cases.length : 1.0;
    this.ledger.append({ type: 'ACADEMY_EVALUATION', seatId, occupantId, score, passed: score >= 0.9, totalCases: cases.length, passedCases: passed, timestamp: new Date().toISOString() });
    if (score >= 0.9) {
      this.registry.create('certification', `CERT-${Date.now()}`, { seatId, occupantId, promptVersion, knowledgePackIds, score, status: 'active', issuedAt: new Date().toISOString() });
    }
    return { passed: score >= 0.9, score, totalCases: cases.length, passedCases: passed, results };
  }

  addCase(seatId, caseData) {
    const caseDir = path.join(this.CASES_DIR, seatId);
    if (!fs.existsSync(caseDir)) fs.mkdirSync(caseDir, { recursive: true });
    const caseId = `CASE-${Date.now()}`;
    const file = path.join(caseDir, `${caseId}.json`);
    const record = { id: caseId, ...caseData, createdAt: new Date().toISOString() };
    fs.writeFileSync(file, JSON.stringify(record, null, 2));
    return record;
  }

  _validate(expected, actual) {
    if (expected.recommendation && actual.recommendation !== expected.recommendation) return false;
    if (expected.violations) {
      for (const v of expected.violations) {
        if (!actual.violations || !actual.violations.includes(v)) return false;
      }
    }
    return true;
  }
}
module.exports = FileAcademyAdapter;
