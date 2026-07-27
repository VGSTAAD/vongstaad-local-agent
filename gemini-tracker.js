const fs = require('fs');
const path = require('path');

const TRACKER_FILE = path.join(__dirname, 'gemini-usage.json');

class GeminiTracker {
  constructor() {
    if (!fs.existsSync(TRACKER_FILE)) {
      fs.writeFileSync(TRACKER_FILE, JSON.stringify({ daily: {}, total: 0 }, null, 2));
    }
  }

  recordUsage(keyIndex) {
    const data = JSON.parse(fs.readFileSync(TRACKER_FILE, 'utf-8'));
    const today = new Date().toISOString().slice(0, 10);
    if (!data.daily[today]) data.daily[today] = {};
    if (!data.daily[today][keyIndex]) data.daily[today][keyIndex] = 0;
    data.daily[today][keyIndex]++;
    data.total++;
    fs.writeFileSync(TRACKER_FILE, JSON.stringify(data, null, 2));
  }

  getTodayUsage() {
    const data = JSON.parse(fs.readFileSync(TRACKER_FILE, 'utf-8'));
    const today = new Date().toISOString().slice(0, 10);
    return data.daily[today] || {};
  }

  getTotalUsage() {
    const data = JSON.parse(fs.readFileSync(TRACKER_FILE, 'utf-8'));
    return data.total;
  }

  getUsageReport() {
    const todayUsage = this.getTodayUsage();
    const perKey = {};
    let totalToday = 0;
    for (const [keyIndex, count] of Object.entries(todayUsage)) {
      perKey[`Key ${parseInt(keyIndex) + 1}`] = {
        calls: count,
        remaining: 1500 - count,
        utilization: ((count / 1500) * 100).toFixed(1) + '%'
      };
      totalToday += count;
    }
    return {
      date: new Date().toISOString().slice(0, 10),
      totalCallsToday: totalToday,
      overallLimit: 1500 * 11,
      overallUtilization: ((totalToday / (1500 * 11)) * 100).toFixed(1) + '%',
      perKey,
      risk: totalToday > (1500 * 11 * 0.8) ? 'HIGH' : totalToday > (1500 * 11 * 0.5) ? 'MEDIUM' : 'LOW'
    };
  }

  predictExhaustion() {
    const report = this.getUsageReport();
    const now = new Date();
    const hoursRemaining = 24 - now.getHours();
    if (hoursRemaining <= 0) return { willExhaust: false, hoursRemaining: 0 };

    const callsPerHour = report.totalCallsToday / Math.max(now.getHours(), 1);
    const predictedTotal = callsPerHour * 24;
    const limit = 1500 * 11;

    return {
      willExhaust: predictedTotal > limit,
      predictedTotal: Math.round(predictedTotal),
      limit,
      hoursRemaining,
      callsPerHour: Math.round(callsPerHour),
      utilizationAtMidnight: ((predictedTotal / limit) * 100).toFixed(1) + '%'
    };
  }
}

module.exports = new GeminiTracker();
