const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SANDBOX_DIR = path.join(__dirname, 'agent-sandboxes');

class SandboxManager {
  constructor(githubToken) {
    this.githubToken = githubToken;
    if (!fs.existsSync(SANDBOX_DIR)) fs.mkdirSync(SANDBOX_DIR, { recursive: true });
  }

  create(repoName) {
    const id = `SBOX-${Date.now()}`;
    const sandboxPath = path.join(SANDBOX_DIR, id);
    const cloneUrl = `https://x-access-token:${this.githubToken}@github.com/VGSTAAD/${repoName}.git`;

    execSync(`git clone ${cloneUrl} ${sandboxPath}`, { encoding: 'utf-8', stdio: 'pipe' });
    const branchName = `sandbox/${id}`;
    execSync(`cd ${sandboxPath} && git checkout -b ${branchName}`, { encoding: 'utf-8' });

    return { id, path: sandboxPath, repoName, branchName, createdAt: new Date().toISOString(), status: 'active' };
  }

  commitAndPush(sandboxId, message) {
    const sandboxPath = path.join(SANDBOX_DIR, sandboxId);
    if (!fs.existsSync(sandboxPath)) return { error: 'Sandbox not found' };

    execSync(`cd ${sandboxPath} && git add -A && git commit -m "${message}"`, { encoding: 'utf-8', stdio: 'pipe' });
    execSync(`cd ${sandboxPath} && git push origin HEAD`, { encoding: 'utf-8', stdio: 'pipe' });

    return { success: true, message: 'Changes committed and pushed to sandbox branch' };
  }

  createPR(sandboxId, title, description) {
    const sandboxPath = path.join(SANDBOX_DIR, sandboxId);
    if (!fs.existsSync(sandboxPath)) return { error: 'Sandbox not found' };

    const repoName = path.basename(sandboxPath);
    const branchName = execSync(`cd ${sandboxPath} && git rev-parse --abbrev-ref HEAD`, { encoding: 'utf-8' }).trim();

    // Use GitHub API to create PR
    const payload = JSON.stringify({
      title: title || 'Automated PR from sandbox',
      head: branchName,
      base: 'main',
      body: description || 'This PR was automatically generated from a sandbox environment.'
    });

    try {
      const result = execSync(
        `curl -s -X POST https://api.github.com/repos/VGSTAAD/${repoName}/pulls -H "Authorization: token ${this.githubToken}" -H "Content-Type: application/json" -d '${payload}'`,
        { encoding: 'utf-8', stdio: 'pipe' }
      );
      const data = JSON.parse(result);
      if (data.html_url) {
        return { success: true, prUrl: data.html_url, prNumber: data.number };
      }
      return { error: data.message || 'Failed to create PR' };
    } catch (err) {
      return { error: err.message };
    }
  }

  list() {
    if (!fs.existsSync(SANDBOX_DIR)) return [];
    return fs.readdirSync(SANDBOX_DIR).map(f => {
      const p = path.join(SANDBOX_DIR, f);
      return { id: f, exists: fs.existsSync(p) };
    });
  }
}

module.exports = SandboxManager;
