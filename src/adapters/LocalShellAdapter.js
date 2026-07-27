const { execSync } = require('child_process');
const { ICommandExecutor } = require('../ports/ICommandExecutor');

class LocalShellAdapter extends ICommandExecutor {
  constructor(cwd = '/home/mhk/workspaces') {
    super();
    this.cwd = cwd;
  }

  async run(command) {
    try {
      return execSync(command, { encoding: 'utf-8', cwd: this.cwd, timeout: 30000 });
    } catch (err) {
      return err.stderr || err.message;
    }
  }
}

module.exports = { LocalShellAdapter };
