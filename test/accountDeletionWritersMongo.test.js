import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import User from '../src/models/User.js';
import Job from '../src/models/Job.js';
import Click from '../src/models/Click.js';
import UserSuggestion from '../src/models/UserSuggestion.js';
import TelegramLinkToken from '../src/models/TelegramLinkToken.js';
import { trackJobClick } from '../src/controllers/jobController.js';
import { createUserSuggestion, UserSuggestionDailyLimitError } from '../src/services/userSuggestionService.js';
import { createTelegramLinkToken } from '../src/services/telegramLinkService.js';
import { removeUserAccount } from '../src/services/userAccountDeletion.js';

const response = () => ({
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

test('private writes cannot recreate records after account deletion starts', { timeout: 120_000 }, async t => {
  const mongo = new MongoMemoryReplSet({ instanceOpts: [{ launchTimeout: 30_000 }],
    replSet: { count: 1, spawn: { signal: t.signal } }, binary: { version: '8.2.6',
    downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) } });
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  await mongo.start();
  await mongoose.connect(mongo.getUri());
  await Promise.all([User, Job, Click, UserSuggestion, TelegramLinkToken].map(Model => Model.init()));
  const job = await Job.create({ title: 'Engineer', company: 'Example', city: 'Pune', location: 'Pune, India',
    jobType: 'Full-time Fresher', status: 'active', isPublicIndia: true, fingerprint: 'account-write-race',
    sourceUrl: 'https://example.test/careers/123', description: 'Build applications with a team of engineers.' });
  let sequence = 0;
  const owner = () => User.create({ email: `deletion-writer-${++sequence}@example.test` });
  const click = async user => {
    const res = response();
    await trackJobClick({ params: { id: String(job._id) }, user, headers: { 'user-agent': 'fixture-agent' }, ip: '127.0.0.1' }, res);
    return res;
  };

  for (const state of ['deleting', 'deleted']) {
    await t.test(`feedback rejects an owner whose account is ${state}`, async () => {
      const user = await owner();
      if (state === 'deleted') await removeUserAccount(user);
      else await User.updateOne({ _id: user._id }, { $set: { accountDeletingAt: new Date() } });
      await assert.rejects(createUserSuggestion({ userId: user._id, message: 'Please add more roles.' }),
        error => error.code === 'ACCOUNT_INACTIVE');
      assert.equal(await UserSuggestion.countDocuments({ user: user._id }), 0);
    });

    await t.test(`Telegram tokens reject an owner whose account is ${state}`, async () => {
      const user = await owner();
      if (state === 'deleted') await removeUserAccount(user);
      else await User.updateOne({ _id: user._id }, { $set: { accountDeletingAt: new Date() } });
      await assert.rejects(createTelegramLinkToken(user._id), error => error.code === 'ACCOUNT_INACTIVE');
      assert.equal(await TelegramLinkToken.countDocuments({ user: user._id }), 0);
    });

    await t.test(`authenticated clicks cannot retain data for an owner whose account is ${state}`, async () => {
      const user = await owner();
      if (state === 'deleted') await removeUserAccount(user);
      else await User.updateOne({ _id: user._id }, { $set: { accountDeletingAt: new Date() } });
      const res = await click({ _id: user._id });
      assert.deepEqual({ status: res.statusCode, records: await Click.countDocuments({ user: user._id }) },
        { status: 404, records: 0 });
    });
  }

  await t.test('a click paused after authorization cannot recreate a swept account record', async t => {
    const user = await owner();
    let entered;
    let release;
    const reached = new Promise(resolve => { entered = resolve; });
    const gate = new Promise(resolve => { release = resolve; });
    const update = Job.findOneAndUpdate.bind(Job);
    t.mock.method(Job, 'findOneAndUpdate', async (...args) => {
      const row = await update(...args);
      entered();
      await gate;
      return row;
    });
    const pending = click({ _id: user._id });
    try {
      await reached;
      await removeUserAccount(user);
    } finally { release(); }
    const res = await pending;
    assert.deepEqual({ status: res.statusCode, records: await Click.countDocuments({ user: user._id }) },
      { status: 404, records: 0 });
  });

  await t.test('active owners retain feedback, Telegram linking and click history', async () => {
    const user = await owner();
    const suggestion = await createUserSuggestion({ userId: user._id, message: '  Add more roles.  ' });
    assert.equal(suggestion.suggestion.message, 'Add more roles.');
    assert.equal(suggestion.remainingToday, 4);
    const link = await createTelegramLinkToken(user._id);
    assert.ok(link.rawToken);
    assert.equal(await TelegramLinkToken.countDocuments({ user: user._id }), 1);
    const res = await click({ _id: user._id });
    assert.equal(res.statusCode, 200);
    assert.equal(await Click.countDocuments({ user: user._id }), 1);
    assert.ok(res.body.data.application);
  });

  await t.test('owner fencing preserves the five-suggestion quota under concurrent writes', async () => {
    const user = await owner();
    const results = await Promise.allSettled(Array.from({ length: 6 }, (_, i) =>
      createUserSuggestion({ userId: user._id, message: `Suggestion ${i + 1}` })));
    assert.equal(results.filter(item => item.status === 'fulfilled').length, 5);
    const failures = results.filter(item => item.status === 'rejected');
    assert.equal(failures.length, 1);
    assert.ok(failures[0].reason instanceof UserSuggestionDailyLimitError);
    assert.equal(await UserSuggestion.countDocuments({ user: user._id }), 5);
    await removeUserAccount(user);
    assert.equal(await UserSuggestion.countDocuments({ user: user._id }), 0);
  });

  await t.test('anonymous clicks remain available without an account transaction', async () => {
    const res = await click(undefined);
    assert.equal(res.statusCode, 200);
    assert.equal(await Click.countDocuments({ user: null, job: job._id }), 1);
  });
});
