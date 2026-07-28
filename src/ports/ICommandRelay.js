/**
 * Port: ICommandRelay
 * Version 1.0 – Technical port under CTO authority
 */
class ICommandRelay {
  /** @returns {object} { pending: boolean, taskId?: string, command?: object } */
  async fetchPendingCommand() { throw new Error('Not implemented'); }
  async markTaskComplete(taskId, result) { throw new Error('Not implemented'); }
  async healthCheck() { throw new Error('Not implemented'); }
}
module.exports = ICommandRelay;
