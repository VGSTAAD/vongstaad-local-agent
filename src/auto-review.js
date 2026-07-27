const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const STATE_FILE = path.join(__dirname, 'auto-review-state.json');

function loadState() {
  if (!fs.existsSync(STATE_FILE)) return {};
  return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function reviewAllRepos(registry, compiler, ledger, agentService) {
  const state = loadState();
  const repos = [
    'vongstaad-auth-worker',
    'vongstaad-desk-worker',
    'vongstaad-auth-ui',
    'vongstaad-admin-ui'
  ];
  const results = [];

  for (const repo of repos) {
    const repoPath = path.join(__dirname, repo);
    if (!fs.existsSync(repoPath)) continue;

    // Get the latest commit hash
    let hash;
    try {
      hash = execSync(`cd ${repoPath} && git rev-parse HEAD`, { encoding: 'utf-8' }).trim();
    } catch { continue; }

    if (!hash || hash === state[repo]) continue;

    // Get the diff for the latest commit (works even with shallow clones)
    let diff;
    try {
      diff = execSync(`cd ${repoPath} && git log -p -1`, { encoding: 'utf-8', maxBuffer: 512 * 1024 }).slice(0, 5000);
    } catch { diff = '(could not generate diff)'; }

    const commitMsg = execSync(`cd ${repoPath} && git log -1 --format=%s`, { encoding: 'utf-8' }).trim();

    // 1. Compile
    const compileResult = compiler.compile({
      seatId: 'SEAT-001',
      constitutionVersion: '1.0',
      promptText: `Review this diff: ${diff}`,
      requestedAuthority: ['review', 'comment']
    });
    if (!compileResult.valid) {
      ledger.append({
        type: 'COMPILATION_FAILED',
        seatId: 'SEAT-001',
        repo,
        commit: hash,
        violations: compileResult.violations
      });
      results.push({ repo, hash, status: 'blocked', violations: compileResult.violations });
      state[repo] = hash;
      saveState(state);
      continue;
    }

    // 2. Review via Gemini
    const messages = [
      {
        role: 'system',
        text: 'You are a Code Reviewer occupying seat SEAT-001. Review this git diff. Return JSON with fields: recommendation (approve/reject/review), violations (array), summary (string).'
      },
      {
        role: 'user',
        text: `Commit: ${commitMsg}\n\nDiff:\n${diff}`
      }
    ];
    const reply = await agentService.llm.complete('CodeReviewer', messages);
    let output;
    try { output = JSON.parse(reply); } catch {
      output = { recommendation: 'review', violations: [], summary: reply };
    }

    // 3. Ledger
    const dcpId = `DCP-${Date.now()}`;
    ledger.append({
      type: 'CODE_REVIEW',
      seatId: 'SEAT-001',
      repo,
      commit: hash,
      recommendation: output.recommendation,
      dcpId
    });
    results.push({
      repo,
      hash,
      status: 'reviewed',
      recommendation: output.recommendation,
      summary: output.summary
    });
    state[repo] = hash;
    saveState(state);
  }
  return results;
}

module.exports = { reviewAllRepos };
