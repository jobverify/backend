import assert from 'node:assert/strict';
import test from 'node:test';
import { removeRetiredAccountData } from '../src/services/retiredAccountData.js';
import ResumeUsage from '../src/models/ResumeUsage.js';

test('existing resume allowance counters retain their storage through the model rename', () => {
  assert.equal(ResumeUsage.collection.name, 'outreachusages');
});

test('retired message records and send credentials are deleted only for the account owner', async () => {
  const id = '507f1f77bcf86cd799439011';
  const deleted = [];
  await removeRetiredAccountData(id, name => ({ deleteMany: async filter => { deleted.push(name); assert.equal(String(filter.user), id); } }));
  assert.deepEqual(deleted, ['campaigns', 'outreachtasks', 'outreachthreads', 'gmailconnections', 'gmailoauthstates', 'applicationmailboxes', 'applicationmailboxauths', 'applicationmails']);
  await assert.rejects(removeRetiredAccountData(undefined), /valid user ID/);
  await assert.rejects(removeRetiredAccountData(id, () => ({ deleteMany: async () => { throw new Error('Database unavailable'); } })), /Database unavailable/);
});
