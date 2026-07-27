const fs = require('fs');
const path = require('path');

const HISTORY_FILE = path.join(__dirname, 'academy-history.json');

class AgentAcademyUniversity {
  constructor(registry, academy, ledger) {
    this.registry = registry;
    this.academy = academy;
    this.ledger = ledger;
    if (!fs.existsSync(HISTORY_FILE)) fs.writeFileSync(HISTORY_FILE, JSON.stringify([], null, 2));
  }

  async evaluateModel(seatId, occupantId, promptVersion, knowledgePackIds, adapter) {
    const result = await this.academy.evaluate({
      seatId,
      occupantId,
      promptVersion,
      knowledgePackIds,
      adapter
    });

    // Store in history
    const history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
    history.push({
      seatId,
      occupantId,
      promptVersion,
      score: result.score,
      passed: result.passed,
      timestamp: new Date().toISOString()
    });
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));

    this.ledger.append({
      type: 'UNIVERSITY_EVALUATION',
      seatId,
      occupantId,
      score: result.score,
      passed: result.passed
    });

    return result;
  }

  compareModels(seatId, models) {
    const history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
    const filtered = history.filter(h => h.seatId === seatId);
    const rankings = {};

    for (const entry of filtered) {
      if (!rankings[entry.occupantId]) {
        rankings[entry.occupantId] = { evaluations: 0, totalScore: 0, bestScore: 0, worstScore: 1 };
      }
      rankings[entry.occupantId].evaluations++;
      rankings[entry.occupantId].totalScore += entry.score;
      rankings[entry.occupantId].bestScore = Math.max(rankings[entry.occupantId].bestScore, entry.score);
      rankings[entry.occupantId].worstScore = Math.min(rankings[entry.occupantId].worstScore, entry.score);
    }

    const result = Object.entries(rankings).map(([model, stats]) => ({
      model,
      averageScore: (stats.totalScore / stats.evaluations).toFixed(2),
      evaluations: stats.evaluations,
      bestScore: stats.bestScore.toFixed(2),
      worstScore: stats.worstScore.toFixed(2)
    })).sort((a, b) => b.averageScore - a.averageScore);

    return result;
  }

  detectRegression(seatId, occupantId) {
    const history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
    const entries = history
      .filter(h => h.seatId === seatId && h.occupantId === occupantId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (entries.length < 2) return { regressed: false, message: 'Not enough data for regression detection' };

    const latest = entries[0];
    const previous = entries[1];

    const regressed = latest.score < previous.score;
    const delta = (latest.score - previous.score) * 100;

    return {
      regressed,
      latestScore: latest.score,
      previousScore: previous.score,
      delta: `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`,
      latestTimestamp: latest.timestamp,
      previousTimestamp: previous.timestamp
    };
  }

  getHistory(seatId = null) {
    const history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
    if (seatId) return history.filter(h => h.seatId === seatId);
    return history;
  }
}

module.exports = AgentAcademyUniversity;
