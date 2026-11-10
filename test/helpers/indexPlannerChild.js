import assert from 'node:assert/strict';
import mongoose from 'mongoose';

const commands = [];
const originalConnect = mongoose.connect;
mongoose.connect = async function (uri, options) {
  const opening = originalConnect.call(this, uri, { ...options, monitorCommands: true });
  mongoose.connection.getClient().on('commandStarted', event => commands.push(event.commandName));
  return opening;
};
const { runIndexManagement } = await import('../../scripts/indexes.js');
const result = await runIndexManagement({ mode: process.argv[2], dryRun: true,
  log() {}, errorLog() { throw new Error('Index planner failed'); }, shouldDisconnect: false });
// Also let initialization scheduled at connection time finish.
await Promise.all(Object.values(mongoose.models).map(model => model.init()));
assert.deepEqual(commands.filter(name => /^(create|createIndexes|drop|dropIndexes|collMod)$/.test(name)), []);
assert.ok(result.results.length >= 34, 'every model must be in the plan');
assert.deepEqual(await mongoose.connection.db.listCollections().toArray(), []);
await mongoose.disconnect();
