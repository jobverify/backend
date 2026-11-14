import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import User from '../src/models/User.js';
import Job from '../src/models/Job.js';
import Resume from '../src/models/Resume.js';
import ResumeUsage from '../src/models/ResumeUsage.js';
import TailoredResume from '../src/models/TailoredResume.js';
import RateLimitBucket from '../src/models/RateLimitBucket.js';
import BlacklistedToken from '../src/models/BlacklistedToken.js';
import { login, resetPassword } from '../src/controllers/authController.js';
import { requestResumePreparation, recoverResumePreparations, drainResumePreparations } from '../src/services/resumePreparationService.js';
import { requestTailoredResume, drainTailoredResumes } from '../src/services/resumeTailoringService.js';
import { createSeoToolsRouter } from '../src/seo/seoToolsRoutes.js';
import { passwordSafety } from '../src/services/passwordSafety.js';

const consent = { version: '2026-11-14', accepted: true };
const secret = 'security-followup-fixture-jwt-secret-only';
const response = () => ({ statusCode: 200, body: null, cookies: [],
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
  cookie(...args) { this.cookies.push(args); }, clearCookie() {},
});
const tokenFor = user => jwt.sign({ id: String(user._id), sessionVersion: user.sessionVersion ?? 0 }, secret,
  { algorithm: 'HS256', expiresIn: '1h' });
const requestFor = user => ({ headers: { authorization: `Bearer ${tokenFor(user)}` } });
const dailyKey = user => `user:${user._id}:base-resumes:${new Date().toISOString().slice(0, 10)}`;

async function ownerWithResume(email) {
  const user = await User.create({ email, isVerified: true, resumeFeaturesAllowed: true });
  const data = Buffer.from('\\documentclass{article}\\begin{document}Fixture CV\\end{document}');
  await Resume.create({ _id: user._id, user: user._id, filename: 'fixture.tex', extension: 'tex',
    mimeType: 'application/x-tex', data, size: data.length,
    sha256: createHash('sha256').update(data).digest('hex') });
  return user;
}

async function serveSeo(env, run, handlers = {}) {
  const app = express();
  app.use('/api/seo', createSeoToolsRouter({ env, requestLimit: 2,
    audit: async () => ({ fixture: true }), findPages: async () => ({ results: [] }), ...handlers }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try { return await run(`http://127.0.0.1:${server.address().port}/api/seo`); }
  finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}

test('account verification and shared resource budgets', { timeout: 120000 }, async t => {
  // Password screening has separate policy tests; this suite tests mailbox proof.
  t.mock.method(passwordSafety, 'check', async () => {});
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = secret;
  process.env.MONGOMS_RUNTIME_DOWNLOAD = 'false';
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 },
    instanceOpts: [{ launchTimeout: 60000 }], binary: { version: '8.2.6',
      downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) } });
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  await mongoose.connect(mongo.getUri(), { dbName: 'security_followup_fixtures' });
  await Promise.all([User.init(), Resume.init(), ResumeUsage.init(), RateLimitBucket.init(), BlacklistedToken.init()]);
  const { protect, optionalProtect, protectLogout } = await import('../src/middleware/authMiddleware.js');

  await t.test('unverified password accounts cannot obtain a session', async () => {
    const user = await User.create({ email: 'legacy-login@example.test', isVerified: false,
      password: await bcrypt.hash('LegacyPassword123!', 4) });
    const res = response();
    await login({ body: { email: user.email, password: 'LegacyPassword123!' } }, res);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error, 'email_verification_required');
    assert.equal(res.cookies.length, 0);
    assert.equal((await User.findById(user._id)).lastLoginAt, undefined);
  });

  await t.test('unverified tokens cannot authorize protected or personalized requests', async () => {
    const user = await User.create({ email: 'legacy-session@example.test', isVerified: false });
    const res = response(); let proceeded = false;
    await protect(requestFor(user), res, () => { proceeded = true; });
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error, 'email_verification_required');
    assert.equal(proceeded, false);
    const optional = requestFor(user);
    await optionalProtect(optional, response(), () => {});
    assert.equal(optional.user, undefined);
  });

  await t.test('verified sessions still work and unverified sessions can still log out', async () => {
    const verified = await User.create({ email: 'verified-session@example.test', isVerified: true });
    let proceeded = false;
    await protect(requestFor(verified), response(), () => { proceeded = true; });
    assert.equal(proceeded, true);
    const legacy = await User.create({ email: 'legacy-logout@example.test', isVerified: false });
    proceeded = false;
    await protectLogout(requestFor(legacy), response(), () => { proceeded = true; });
    assert.equal(proceeded, true, 'revoking an existing token must remain available');
  });

  await t.test('a valid mailbox reset recovers an unverified legacy account', async () => {
    const token = 'fixture-mailbox-reset-proof';
    const user = await User.create({ email: 'legacy-recovery@example.test', isVerified: false,
      resetPasswordTokenHash: createHash('sha256').update(token).digest('hex'),
      resetPasswordExpiresAt: new Date(Date.now() + 60000) });
    const oldToken = tokenFor(user); const res = response();
    await resetPassword({ body: { token, password: 'RecoveredPassword123!' } }, res);
    assert.equal(res.statusCode, 200);
    const recovered = await User.findById(user._id);
    assert.equal(recovered.isVerified, true);
    assert.equal(recovered.sessionVersion, 1);
    const stale = response();
    await protect({ headers: { authorization: `Bearer ${oldToken}` } }, stale, () => assert.fail('old session accepted'));
    assert.equal(stale.statusCode, 401);
    const signedIn = response();
    await login({ body: { email: user.email, password: 'RecoveredPassword123!' } }, signedIn);
    assert.equal(signedIn.statusCode, 200);
    assert.equal(signedIn.cookies.length, 1);
  });

  for (const status of [429, 503, 409]) await t.test(`a pending base reservation rejected with ${status} preserves a real tailored worker`, async t => {
    const owner = await ownerWithResume(`base-worker-race-${status}@example.test`);
    const job = new mongoose.Types.ObjectId();
    owner.savedJobs = [job]; await owner.save();
    await Job.collection.insertOne({ _id: job, title: 'React Engineer', company: 'Example',
      location: 'Pune, India', isPublicIndia: true, jobType: 'Full-time Experienced',
      status: 'active', description: 'Build React applications.', fingerprint: `quota-race-${job}` });
    const latex = '\\documentclass{article}\n\\begin{document}Asha Rao, asha@example.test. React project, 2025. BSc 2026.\\end{document}';
    const data = Buffer.from(latex);
    await Resume.updateOne({ _id: owner._id }, { $set: { data, size: data.length,
      sha256: createHash('sha256').update(data).digest('hex') } });
    const output = { latex, pdf: Buffer.from('%PDF-1.7\ncompiled-test-document\n%%EOF'),
      pageCount: 1, facts: { name: 'Asha Rao' }, modelVersion: 'local-test', styleVersion: 'test' };
    const options = { processingConsent: consent, dispatch: async () => {} };
    await requestResumePreparation(owner, options);
    assert.deepEqual(await drainResumePreparations({ generate: async () => output }), { attempted: 1, completed: 1, failed: 0 });
    await requestTailoredResume(owner, String(job), options);
    if (status === 429) await ResumeUsage.updateOne({ key: dailyKey(owner) }, { $set: { used: 10 } });
    const findOneAndUpdate = ResumeUsage.findOneAndUpdate.bind(ResumeUsage);
    let worker;
    t.mock.method(ResumeUsage, 'findOneAndUpdate', async (filter, ...args) => {
      if (filter.key === dailyKey(owner)) {
        if (status === 409) {
          await Resume.updateOne({ _id: owner._id }, { $set: { 'preparation.requestedAt': new Date(Date.now() - 6 * 60000) } });
          await recoverResumePreparations({ dispatchPending: false });
        } else worker = await drainTailoredResumes({ generate: async () => output });
        if (status === 503) throw new Error('fixture quota outage');
      }
      return findOneAndUpdate(filter, ...args);
    });
    await assert.rejects(requestResumePreparation(owner, { ...options, regenerate: true }), error => error.statusCode === status);
    if (status === 409) worker = await drainTailoredResumes({ generate: async () => output });
    assert.deepEqual(worker, { attempted: 1, completed: 1, failed: 0 });
    assert.equal((await TailoredResume.findOne({ user: owner._id })).status, 'completed');
  });

  await t.test('an exhausted base allowance prevents dispatch without invalidating existing tailored work', async () => {
    const owner = await ownerWithResume('base-exhausted@example.test');
    await ResumeUsage.create({ key: dailyKey(owner), user: owner._id, used: 10,
      expiresAt: new Date(Date.now() + 86400000) });
    const job = new mongoose.Types.ObjectId();
    await TailoredResume.collection.insertOne({ _id: `${owner._id}:${job}`, user: owner._id, job,
      sourceResumeSha: (await Resume.findById(owner._id)).sha256, status: 'queued', ready: true });
    let dispatched = false;
    await assert.rejects(requestResumePreparation(owner, { processingConsent: consent,
      dispatch: async () => { dispatched = true; } }), error => error.statusCode === 429);
    assert.equal(dispatched, false);
    const row = await Resume.findById(owner._id);
    assert.equal(row.preparation.ready, false);
    assert.equal(row.preparation.status, 'failed');
    assert.equal((await TailoredResume.findOne({ user: owner._id })).status, 'queued');
    await recoverResumePreparations({ dispatch: async () => { dispatched = true; } });
    assert.equal(dispatched, false, 'recovery cannot bypass the rejected reservation');
  });

  await t.test('duplicate active base requests consume one allowance before dispatch', async () => {
    const owner = await ownerWithResume('base-duplicate@example.test');
    let calls = 0;
    const options = { processingConsent: consent, dispatch: async () => {
      calls++;
      assert.equal((await ResumeUsage.findOne({ key: dailyKey(owner) }))?.used, 1);
      assert.equal((await Resume.findById(owner._id)).preparation.ready, true);
    } };
    await Promise.all(Array.from({ length: 4 }, () => requestResumePreparation(owner, options)));
    assert.equal(calls, 1);
    assert.equal((await ResumeUsage.findOne({ key: dailyKey(owner) })).used, 1);
  });

  await t.test('base quota storage failures leave no runnable work', async t => {
    const owner = await ownerWithResume('base-store-error@example.test');
    t.mock.method(ResumeUsage, 'findOneAndUpdate', async () => { throw new Error('fixture database outage'); });
    let dispatched = false;
    await assert.rejects(requestResumePreparation(owner, { processingConsent: consent,
      dispatch: async () => { dispatched = true; } }), error => error.statusCode === 503);
    assert.equal(dispatched, false);
    assert.equal((await Resume.findById(owner._id)).preparation.ready, false);
  });

  await t.test('a previous UTC day does not exhaust the current base allowance', async () => {
    const owner = await ownerWithResume('base-new-day@example.test');
    await ResumeUsage.create({ key: `user:${owner._id}:base-resumes:2000-01-01`, user: owner._id,
      used: 10, expiresAt: new Date(Date.now() + 86400000) });
    const result = await requestResumePreparation(owner, { processingConsent: consent, dispatch: async () => {} });
    assert.equal(result.preparation.status, 'queued');
    assert.equal((await ResumeUsage.findOne({ key: dailyKey(owner) }))?.used, 1);
  });

  await t.test('recovery makes an abandoned quota reservation retryable without dispatch', async () => {
    const owner = await ownerWithResume('base-abandoned@example.test');
    const requestedAt = new Date(Date.now() - 6 * 60000);
    await Resume.updateOne({ _id: owner._id }, { $set: {
      'preparation.status': 'queued', 'preparation.ready': false,
      'preparation.requestedAt': requestedAt, 'preparation.revision': 1,
      'preparation.processingConsentVersion': consent.version,
      'preparation.processingConsentAcceptedAt': requestedAt,
    } });
    let dispatched = false;
    await recoverResumePreparations({ dispatch: async () => { dispatched = true; } });
    const row = await Resume.findById(owner._id);
    assert.equal(row.preparation.status, 'failed');
    assert.equal(row.preparation.ready, false);
    assert.equal(dispatched, false);
  });

  const seoEnv = { NODE_ENV: 'production', ENABLE_RATE_LIMITING: 'false',
    SEO_TOOLS_TOKEN: 'fixture-seo-scoped-credential-at-least-32-characters' };
  const post = (base, path) => fetch(base + path, { method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${seoEnv.SEO_TOOLS_TOKEN}` }, body: '{}' });

  await t.test('SEO budgets span independent API instances and survive router restart', async () => {
    await RateLimitBucket.deleteMany({}); let calls = 0;
    const handlers = { audit: async () => { calls++; return { fixture: true }; },
      findPages: async () => { calls++; return { results: [] }; } };
    await serveSeo(seoEnv, async first => {
      assert.equal((await post(first, '/audit')).status, 200);
      await serveSeo(seoEnv, async second => {
        assert.equal((await post(second, '/indexed-pages')).status, 200);
        const denied = await post(first, '/audit');
        assert.equal(denied.status, 429);
        assert.ok(Number(denied.headers.get('retry-after')) > 0);
      }, handlers);
    }, handlers);
    await serveSeo(seoEnv, async restarted => assert.equal((await post(restarted, '/audit')).status, 429), handlers);
    assert.equal(calls, 2);
  });

  await t.test('SEO storage failure denies work before provider calls', async t => {
    t.mock.method(RateLimitBucket, 'findOneAndUpdate', async () => { throw new Error('fixture quota outage'); });
    let called = false;
    await serveSeo(seoEnv, async base => {
      const denied = await post(base, '/audit');
      assert.equal(denied.status, 503);
      assert.doesNotMatch(await denied.text(), /fixture quota outage/);
    }, { audit: async () => { called = true; return {}; } });
    assert.equal(called, false);
  });
});
