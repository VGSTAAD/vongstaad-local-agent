/**
 * Port: Command Executor
 * Executes shell commands and returns the result.
 */
class ICommandExecutor {
  /**
   * @param {string} command - The shell command to run
   * @returns {Promise<string>} stdout of the command
   */
  async run(command) {
    throw new Error('ICommandExecutor.run() not implemented');
  }
}

module.exports = { ICommandExecutor };
