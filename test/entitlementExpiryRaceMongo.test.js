import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import jwt from 'jsonwebtoken';
import User from '../src/models/User.js';
import Subscription from '../src/models/Subscription.js';
import BlacklistedToken from '../src/models/BlacklistedToken.js';
import { ACCESS_ROLES, PLAN_IDS } from '../src/constants/accessPlans.js';
import { getUserProfile, updateUserProfile, getTelegramAlertSettings } from '../src/controllers/userController.js';
import { activatePlanForUser, downgradeExpiredPlans } from '../src/services/planService.js';
import { expireEntitlement } from '../src/services/entitlementExpiryService.js';

const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; } });

test('expiry cannot overwrite a renewal committed after an older account read', { timeout: 90000 }, async t => {
  process.env.JWT_SECRET = 'local-expiry-race-test-secret';
  const { protect, optionalProtect } = await import('../src/middleware/authMiddleware.js');
  const mongo = await MongoMemoryReplSet.create({
    binary: { version: '8.2.6', downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) },
    instanceOpts: [{ launchTimeout: 30000 }], replSet: { count: 1 },
  });
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  await mongoose.connect(mongo.getUri());
  await Promise.all([User.init(), Subscription.init(), BlacklistedToken.init()]);
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('No external calls in expiry tests'); });
  const future = new Date(Date.now() + 86400000);
  const purchase = new mongoose.Types.ObjectId();
  for (const [name, handler] of [
    ['profile read', getUserProfile], ['profile update', updateUserProfile],
    ['alert settings read', getTelegramAlertSettings],
    ['required authentication', protect], ['optional authentication', optionalProtect],
  ]) await t.test(name, async child => {
    const user = await User.create({ email: `${name.replaceAll(' ', '-')}@example.test`,
      accessRole: ACCESS_ROLES.SEMESTER, premium: { planId: PLAN_IDS.SEMESTER, status: 'active',
        expiresAt: new Date(Date.now() - 1000), telegramAlertsEnabled: true } });
    await Subscription.create({ user: user._id, telegramSchedule: { isActive: false, deliveryTime: '18:20' } });
    const original = User.findById;
    let renewed = false;
    child.mock.method(User, 'findById', function (...args) {
      const query = original.apply(this, args);
      const exec = query.exec;
      query.exec = async function (...execArgs) {
        const stale = await exec.apply(this, execArgs);
        if (!renewed) {
          renewed = true;
          await User.updateOne({ _id: user._id }, { $set: {
            accessRole: ACCESS_ROLES.YEARLY, 'premium.planId': PLAN_IDS.YEARLY,
            'premium.status': 'active', 'premium.expiresAt': future, 'premium.lastPurchase': purchase,
          } });
        }
        return stale;
      };
      return query;
    });
    const token = jwt.sign({ id: String(user._id), sessionVersion: 0 }, process.env.JWT_SECRET);
    const req = { user, headers: { authorization: `Bearer ${token}` }, body: { name: 'Updated Name' } };
    const res = response();
    let continued = false;
    await handler(req, res, () => { continued = true; });
    assert.ok(renewed, 'renewal must occur after the stale read');
    assert.ok(continued || res.statusCode === 200);
    const current = await original.call(User, user._id).lean();
    assert.equal(current.accessRole, ACCESS_ROLES.YEARLY);
    assert.equal(current.premium.planId, PLAN_IDS.YEARLY);
    assert.equal(current.premium.expiresAt.getTime(), future.getTime());
    assert.equal(String(current.premium.lastPurchase), String(purchase));
    const subscription = await Subscription.findOne({ user: user._id }).lean();
    assert.equal(subscription.telegramSchedule.isActive, false, 'expiry does not overwrite delivery preferences');
    assert.equal(subscription.telegramSchedule.deliveryTime, '18:20');
  });
  await t.test('sweep updates current expired entitlements only and retains purchase metadata', async () => {
    const expired = await User.create({ email: 'sweep@example.test', accessRole: ACCESS_ROLES.MONTHLY,
      premium: { planId: PLAN_IDS.MONTHLY, status: 'active', expiresAt: new Date(Date.now() - 1000), lastPurchase: purchase } });
    assert.equal(await downgradeExpiredPlans(), 1);
    const current = await User.findById(expired._id).lean();
    assert.equal(current.accessRole, ACCESS_ROLES.FREE);
    assert.equal(current.premium.status, 'expired');
    assert.equal(String(current.premium.lastPurchase), String(purchase));
    assert.equal(await downgradeExpiredPlans(), 0);
  });
  await t.test('expiry write rechecks the database after a renewal', async child => {
    const user = await User.create({ email: 'conditional-expiry@example.test', accessRole: ACCESS_ROLES.MONTHLY,
      premium: { planId: PLAN_IDS.MONTHLY, status: 'active', expiresAt: new Date(Date.now() - 1000) } });
    const original = User.findOneAndUpdate;
    let renewed = false;
    child.mock.method(User, 'findOneAndUpdate', function (...args) {
      const query = original.apply(this, args);
      const exec = query.exec;
      query.exec = async function (...execArgs) {
        if (!renewed) {
          renewed = true;
          await User.updateOne({ _id: user._id }, { $set: { 'premium.expiresAt': future, 'premium.lastPurchase': purchase } });
        }
        return exec.apply(this, execArgs);
      };
      return query;
    });
    assert.equal(await expireEntitlement(user._id), false);
    assert.equal((await User.findById(user._id)).premium.expiresAt.getTime(), future.getTime());
  });
  await t.test('a profile save cannot persist legacy entitlement defaults over a renewal', async child => {
    const id = new mongoose.Types.ObjectId();
    await User.collection.insertOne({ _id: id, email: 'legacy-renewal@example.test', role: 'user', profile: { name: 'Old' } });
    const original = User.findById;
    let renewed = false;
    child.mock.method(User, 'findById', function (...args) {
      const query = original.apply(this, args);
      const exec = query.exec;
      query.exec = async function (...execArgs) {
        const stale = await exec.apply(this, execArgs);
        if (!renewed) {
          renewed = true;
          await User.updateOne({ _id: id }, { $set: { accessRole: ACCESS_ROLES.YEARLY,
            'premium.planId': PLAN_IDS.YEARLY, 'premium.status': 'active',
            'premium.expiresAt': future, 'premium.lastPurchase': purchase } });
        }
        return stale;
      };
      return query;
    });
    const res = response();
    await updateUserProfile({ user: { _id: id }, body: { name: 'New' } }, res);
    assert.equal(res.statusCode, 200);
    const current = await original.call(User, id);
    assert.equal(current.accessRole, ACCESS_ROLES.YEARLY);
    assert.equal(current.premium.planId, PLAN_IDS.YEARLY);
    assert.equal(String(current.premium.lastPurchase), String(purchase));
    assert.equal(current.profile.name, 'New');
  });
  await t.test('expiry and dispatch invalidation roll back together on failure', async child => {
    const user = await User.create({ email: 'expiry-rollback@example.test', accessRole: ACCESS_ROLES.MONTHLY,
      premium: { planId: PLAN_IDS.MONTHLY, status: 'active', expiresAt: new Date(Date.now() - 1000) } });
    child.mock.method(Subscription, 'updateOne', async () => { throw new Error('local dispatch fence failure'); });
    await assert.rejects(expireEntitlement(user._id), /dispatch fence failure/);
    assert.equal((await User.findById(user._id)).premium.status, 'active');
  });
  await t.test('legacy preference changes persist without replacing a concurrently renewed premium object', async () => {
    const id = new mongoose.Types.ObjectId();
    await User.collection.insertOne({ _id: id, email: 'legacy-preference@example.test' });
    const stale = await User.findById(id);
    await User.updateOne({ _id: id }, { $set: { accessRole: ACCESS_ROLES.YEARLY,
      'premium.planId': PLAN_IDS.YEARLY, 'premium.status': 'active',
      'premium.expiresAt': future, 'premium.lastPurchase': purchase } });
    stale.premium.telegramAlertsEnabled = true;
    await stale.save();
    const current = await User.findById(id);
    assert.equal(current.accessRole, ACCESS_ROLES.YEARLY);
    assert.equal(current.premium.planId, PLAN_IDS.YEARLY);
    assert.equal(current.premium.telegramAlertsEnabled, true);
    assert.equal(current.premium.expiresAt.getTime(), future.getTime());
    assert.equal(String(current.premium.lastPurchase), String(purchase));
  });
  await t.test('legacy profile saves cannot undo a current account pause or administrative role', async () => {
    const id = new mongoose.Types.ObjectId();
    await User.collection.insertOne({ _id: id, email: 'legacy-account-state@example.test' });
    const stale = await User.findById(id);
    await User.updateOne({ _id: id }, { $set: { role: 'admin', deactivated: true } });
    stale.profile.name = 'Profile edit already in flight';
    await stale.save();
    const current = await User.findById(id);
    assert.equal(current.deactivated, true);
    assert.equal(current.role, 'admin');
  });
  await t.test('explicit legacy account state changes still persist', async () => {
    const id = new mongoose.Types.ObjectId();
    await User.collection.insertOne({ _id: id, email: 'legacy-explicit-state@example.test' });
    const user = await User.findById(id);
    user.role = 'admin'; user.deactivated = true;
    await user.save();
    const current = await User.findById(id);
    assert.equal(current.role, 'admin'); assert.equal(current.deactivated, true);
  });
  await t.test('partial legacy premium documents cannot persist default plan fields over a renewal', async () => {
    const id = new mongoose.Types.ObjectId();
    await User.collection.insertOne({ _id: id, email: 'partial-premium@example.test',
      accessRole: ACCESS_ROLES.MONTHLY, premium: { status: 'expired', expiresAt: new Date(Date.now() - 1000) } });
    const stale = await User.findById(id);
    await User.updateOne({ _id: id }, { $set: { accessRole: ACCESS_ROLES.YEARLY,
      'premium.planId': PLAN_IDS.YEARLY, 'premium.status': 'active', 'premium.expiresAt': future, 'premium.lastPurchase': purchase } });
    stale.profile.name = 'Unrelated profile edit';
    await stale.save();
    const current = await User.findById(id);
    assert.equal(current.premium.planId, PLAN_IDS.YEARLY);
    assert.equal(current.premium.status, 'active');
    assert.equal(current.premium.expiresAt.getTime(), future.getTime());
    assert.equal(String(current.premium.lastPurchase), String(purchase));
  });
  await t.test('a paid activation still writes explicit entitlement fields on a partial legacy account', async () => {
    const id = new mongoose.Types.ObjectId();
    await User.collection.insertOne({ _id: id, email: 'legacy-activation@example.test',
      accessRole: ACCESS_ROLES.FREE, premium: { status: 'inactive' } });
    await User.db.transaction(session => activatePlanForUser({ userId: id, planId: PLAN_IDS.YEARLY,
      purchaseId: purchase, session }));
    const current = await User.findById(id);
    assert.equal(current.accessRole, ACCESS_ROLES.YEARLY);
    assert.equal(current.premium.planId, PLAN_IDS.YEARLY);
    assert.equal(current.premium.status, 'active');
    assert.ok(current.premium.expiresAt > new Date());
    assert.equal(String(current.premium.lastPurchase), String(purchase));
  });
  await t.test('implicit Telegram defaults cannot erase a concurrent opt-out', async () => {
    const id = new mongoose.Types.ObjectId();
    await User.collection.insertOne({ _id: id, email: 'legacy-opt-out@example.test',
      telegram: { chatId: 'legacy-opt-out', linkedAt: new Date(Date.now() - 10000) } });
    const stale = await User.findById(id);
    const optedOutAt = new Date();
    await User.updateOne({ _id: id }, { $set: { 'telegram.optedOutAt': optedOutAt } });
    stale.profile.name = 'Unrelated profile edit'; await stale.save();
    assert.equal((await User.findById(id)).telegram.optedOutAt?.getTime(), optedOutAt.getTime());
  });
  await t.test('a legacy profile edit preserves concurrently stored verification and nested preferences', async () => {
    const id = new mongoose.Types.ObjectId();
    await User.collection.insertOne({ _id: id, email: 'legacy-profile-defaults@example.test' });
    const stale = await User.findById(id);
    await User.updateOne({ _id: id }, { $set: { isVerified: true,
      'profile.telegramAlertFilters.company': ['Example'] } });
    stale.profile.name = 'Explicit legacy profile edit';
    await stale.save();
    const current = await User.findById(id);
    assert.equal(current.isVerified, true);
    assert.equal(current.profile.name, 'Explicit legacy profile edit');
    assert.deepEqual([...current.profile.telegramAlertFilters.company], ['Example']);
  });
  await t.test('explicit mutations to a legacy default array still persist', async () => {
    const id = new mongoose.Types.ObjectId();
    const jobId = new mongoose.Types.ObjectId();
    await User.collection.insertOne({ _id: id, email: 'legacy-explicit-array@example.test' });
    const user = await User.findById(id);
    user.savedJobs.push(jobId);
    await user.save();
    assert.deepEqual((await User.findById(id)).savedJobs.map(String), [String(jobId)]);
  });
});
