const geminiTracker = require('./gemini-tracker');

class ResourceGovernor {
  getAction() {
    const report = geminiTracker.getUsageReport();
    const prediction = geminiTracker.predictExhaustion();

    // HIGH risk: throttle everything non‑essential
    if (report.risk === 'HIGH' || (prediction.willExhaust && prediction.hoursRemaining < 6)) {
      return {
        action: 'THROTTLE',
        message: 'Gemini quota critical — suspending all non‑essential operations.',
        affectedOperations: ['academy_evaluation', 'council_summaries', 'auto_review'],
        resumeAfter: 'Next UTC day or manual override',
        prediction
      };
    }

    // MEDIUM risk: reduce non‑essential
    if (report.risk === 'MEDIUM' || (prediction.willExhaust && prediction.hoursRemaining < 12)) {
      return {
        action: 'REDUCE',
        message: 'Gemini quota elevated — reducing non‑essential operations.',
        affectedOperations: ['academy_evaluation'],
        newFrequency: 'every 6 hours',
        prediction
      };
    }

    // Normal
    return {
      action: 'NORMAL',
      message: 'Gemini quota within normal range.',
      prediction
    };
  }

  shouldThrottle() {
    return this.getAction().action === 'THROTTLE';
  }

  shouldReduce() {
    const action = this.getAction().action;
    return action === 'THROTTLE' || action === 'REDUCE';
  }
}

module.exports = new ResourceGovernor();
