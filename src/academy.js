const fs = require('fs');
const path = require('path');

const CASES_DIR = path.join(__dirname, 'academy-cases');

class Academy {
  constructor(registry, ledger) {
    this.registry = registry;
    this.ledger = ledger;
    if (!fs.existsSync(CASES_DIR)) fs.mkdirSync(CASES_DIR, { recursive: true });
  }

  /**
   * Evaluates an occupant configuration against a curriculum.
   * @param {object} config
   * @param {string} config.seatId
   * @param {string} config.occupantId
   * @param {string} config.promptVersion
   * @param {string[]} config.knowledgePackIds
   * @param {Function} config.adapter - async function that takes (input) and returns output
   */
  async evaluate(config) {
    const { seatId, occupantId, promptVersion, knowledgePackIds, adapter } = config;
    
    // Load the seat specification from Registry
    const seat = this.registry.get('seat', seatId);
    if (!seat) throw new Error(`Seat ${seatId} not found`);

    // Load test cases for this seat
    const caseDir = path.join(CASES_DIR, seatId);
    if (!fs.existsSync(caseDir)) {
      return { passed: true, score: 1.0, message: 'No test cases defined yet' };
    }

    const cases = fs.readdirSync(caseDir)
      .filter(f => f.endsWith('.json'))
      .map(f => JSON.parse(fs.readFileSync(path.join(caseDir, f), 'utf-8')));

    let passed = 0;
    const results = [];

    for (const testCase of cases) {
      try {
        const output = await adapter(testCase.input);
        const isCorrect = this._validate(testCase.expected, output);
        results.push({
          caseId: testCase.id,
          description: testCase.description,
          passed: isCorrect,
          expected: testCase.expected,
          actual: output
        });
        if (isCorrect) passed++;
      } catch (err) {
        results.push({
          caseId: testCase.id,
          description: testCase.description,
          passed: false,
          error: err.message
        });
      }
    }

    const score = cases.length > 0 ? passed / cases.length : 1.0;

    // Log evaluation to Event Ledger
    this.ledger.append({
      type: 'ACADEMY_EVALUATION',
      seatId,
      occupantId,
      score,
      passed: score >= 0.9,
      totalCases: cases.length,
      passedCases: passed,
      timestamp: new Date().toISOString()
    });

    // If passed, create a certification in Registry
    if (score >= 0.9) {
      const certId = `CERT-${Date.now()}`;
      this.registry.create('certification', certId, {
        seatId,
        occupantId,
        promptVersion,
        knowledgePackIds,
        score,
        status: 'active',
        issuedAt: new Date().toISOString()
      });

      // Update seat status
      if (seat.status !== 'active') {
        this.registry.update('seat', seatId, { status: 'active' });
      }
    }

    return {
      passed: score >= 0.9,
      score,
      totalCases: cases.length,
      passedCases: passed,
      results
    };
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

  /**
   * Adds a new test case to the curriculum.
   */
  addCase(seatId, caseData) {
    const caseDir = path.join(CASES_DIR, seatId);
    if (!fs.existsSync(caseDir)) fs.mkdirSync(caseDir, { recursive: true });
    const caseId = `CASE-${Date.now()}`;
    const file = path.join(caseDir, `${caseId}.json`);
    const record = { id: caseId, ...caseData, createdAt: new Date().toISOString() };
    fs.writeFileSync(file, JSON.stringify(record, null, 2));
    return record;
  }

  /**
   * Generates a new test case from a failure.
   */
  learnFromFailure(seatId, input, expectedOutput) {
    return this.addCase(seatId, {
      description: `Auto-generated from failure on ${new Date().toISOString()}`,
      input,
      expected: expectedOutput,
      source: 'failure-auto'
    });
  }
}

module.exports = Academy;
