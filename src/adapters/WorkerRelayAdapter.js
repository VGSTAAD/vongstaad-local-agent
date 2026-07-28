const https = require('https');
const ICommandRelay = require('../ports/ICommandRelay');

class WorkerRelayAdapter extends ICommandRelay {
  constructor(workerUrl) {
    super();
    this.workerUrl = workerUrl;
    this.hostname = new URL(workerUrl).hostname;
  }

  async _request(path, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.hostname,
        path,
        method,
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      };
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode > 299) {
            return reject(new Error(`Worker HTTP ${res.statusCode}`));
          }
          const ct = res.headers['content-type'] || '';
          if (!ct.includes('application/json')) {
            return reject(new Error('Non-JSON response'));
          }
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error('JSON parse error'));
          }
        });
      });
      req.on('error', (err) => reject(err));
      req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  async healthCheck() {
    try {
      const resp = await this._request('/health');
      return resp && resp.status === 'ok';
    } catch {
      return false;
    }
  }

  async fetchPendingCommand() {
    const data = await this._request('/command/pending');
    if (data && data.pending) {
      // Expire commands older than 5 minutes
      const created = data.created_at; // Worker returns created_at in milliseconds
      if (created && (Date.now() - created) > 5 * 60 * 1000) {
        await this.markTaskComplete(data.taskId, 'expired');
        return { pending: false };
      }
      return { pending: true, taskId: data.taskId, command: data.command };
    }
    return { pending: false };
  }

  async markTaskComplete(taskId, result) {
    await this._request(`/command/${taskId}`, 'PATCH', { status: 'completed', result });
  }
}
module.exports = WorkerRelayAdapter;
