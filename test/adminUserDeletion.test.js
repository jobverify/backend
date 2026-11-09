import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import express from "express";
import jwt from "jsonwebtoken";
import * as adminController from "../src/controllers/adminController.js";
import User from "../src/models/User.js";
import PendingUser from "../src/models/PendingUser.js";
import Subscription from "../src/models/Subscription.js";
import Click from "../src/models/Click.js";
import JobAlertDelivery from "../src/models/JobAlertDelivery.js";
import PlanPurchase from "../src/models/PlanPurchase.js";
import AccessEvent from "../src/models/AccessEvent.js";
import TelegramLinkToken from "../src/models/TelegramLinkToken.js";
import UserSuggestion from "../src/models/UserSuggestion.js";
import Application from '../src/models/Application.js';
import Resume from '../src/models/Resume.js';
import { mockAccountDeletion } from './helpers/accountDeletionDoubles.js';
import AdminAudit from "../src/models/AdminAudit.js";
import SiteSettings from "../src/models/SiteSettings.js";
import BlacklistedToken from "../src/models/BlacklistedToken.js";
import { googleIdentity } from "../src/utils/googleAuth.js";

process.env.JWT_SECRET = "admin-deletion-tests-secret-at-least-32-characters";
process.env.NODE_ENV = "test";
const { default: adminRoutes } = await import("../src/routes/adminRoutes.js");
const { protect } = await import("../src/middleware/authMiddleware.js");
const { authenticateWithGoogle } = await import("../src/controllers/authController.js");
const adminId = "507f1f77bcf86cd799439011";
const memberId = "507f1f77bcf86cd799439012";
const otherId = "507f1f77bcf86cd799439013";
const email = "fresh.account@gmail.com";
const responseDouble = () => ({
  statusCode: 200, body: null, cookies: [],
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
  cookie(name, value) { this.cookies.push([name, value]); },
  clearCookie() { throw new Error("Admin deletion must preserve the admin session"); },
});

const setupCleanup = (t) => {
  mockAccountDeletion(t);
  const removals = [];
  for (const Model of [Subscription, Click, JobAlertDelivery, PlanPurchase, AccessEvent, TelegramLinkToken, UserSuggestion, Application, Resume, PendingUser, AdminAudit]) {
    t.mock.method(Model, "deleteMany", async (filter) => {
      removals.push([Model.modelName, filter]);
      return { deletedCount: 1 };
    });
  }
  t.mock.method(SiteSettings, "updateMany", async (filter, update) => {
    removals.push(["SiteSettings", filter, update]);
  });
  t.mock.method(User, "deleteOne", async (filter) => {
    removals.push(["User", filter]);
    return { deletedCount: 1 };
  });
  t.mock.method(User, "updateOne", async (filter, update) => {
    if (update.$set?.accountDeletingAt) return { matchedCount: 1 };
    removals.push(["UserAccess", filter, update]);
    return { matchedCount: 1 };
  });
  t.mock.method(AdminAudit, "create", async () => ({}));
  return removals;
};

test("admin deletion removes every account-linked collection without clearing the admin session", async (t) => {
  assert.equal(typeof adminController.deleteUser, "function", "Admin account deletion is available");
  const removals = setupCleanup(t);
  t.mock.method(User, "findById", async () => ({ _id: memberId, email, role: "user", deactivated: true }));
  const res = responseDouble();
  await adminController.deleteUser({ params: { id: memberId }, user: { _id: adminId } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.deepEqual(res.body.data, { id: memberId });
  assert.deepEqual(removals, [
    ["UserAccess", { _id: memberId, role: "user" }, { $set: { deactivated: true }, $inc: { sessionVersion: 1 } }],
    ["Subscription", { user: memberId }],
    ["Click", { user: memberId }],
    ["JobAlertDelivery", { user: memberId }],
    ["PlanPurchase", { user: memberId }],
    ["AccessEvent", { user: memberId }],
    ["TelegramLinkToken", { user: memberId }],
    ["UserSuggestion", { user: memberId }],
    ['Application', { user: memberId }],
    ['Resume', { user: memberId }],
    ["PendingUser", { email }],
    ["AdminAudit", { $or: [{ admin: memberId }, { targetType: "User", targetId: memberId }] }],
    ["SiteSettings", { updatedBy: memberId }, { $unset: { updatedBy: "" } }],
    ["User", { _id: memberId }],
  ]);
});

test("admin deletion rejects self-deletion, other admins, missing users, and invalid IDs before cleanup", async (t) => {
  assert.equal(typeof adminController.deleteUser, "function");
  const removals = setupCleanup(t);
  for (const [id, user, status] of [
    [adminId, { _id: adminId, role: "admin" }, 400],
    [otherId, { _id: otherId, role: "admin" }, 403],
    [memberId, null, 404],
    ["invalid-id", null, 400],
  ]) {
    t.mock.method(User, "findById", async () => user);
    const res = responseDouble();
    await adminController.deleteUser({ params: { id }, user: { _id: adminId } }, res);
    assert.equal(res.statusCode, status);
    assert.equal(res.body.success, false);
  }
  assert.deepEqual(removals, []);
});

test("failed linked-data cleanup keeps the user record available for retry", async (t) => {
  assert.equal(typeof adminController.deleteUser, "function");
  const removals = setupCleanup(t);
  t.mock.method(User, "findById", async () => ({ _id: memberId, email, role: "user" }));
  t.mock.method(PlanPurchase, "deleteMany", async () => { throw new Error("Database unavailable"); });
  t.mock.method(console, "error", () => {});
  const res = responseDouble();
  await adminController.deleteUser({ params: { id: memberId }, user: { _id: adminId } }, res);
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /account is deactivated/i);
  assert.equal(removals.some(([model]) => model === "User"), false);
});

test("an incomplete user identity cannot produce an unscoped pending-registration deletion", async (t) => {
  const removals = setupCleanup(t);
  t.mock.method(User, "findById", async () => ({ _id: memberId, role: "user" }));
  t.mock.method(console, "error", () => {});
  const res = responseDouble();
  await adminController.deleteUser({ params: { id: memberId }, user: { _id: adminId } }, res);
  assert.equal(res.statusCode, 500);
  assert.deepEqual(removals, []);
});

test("fresh protected requests are rejected while admin account cleanup is in progress", async (t) => {
  setupCleanup(t);
  const member = new User({ _id: memberId, email });
  t.mock.method(User, "findById", () => {
    const query = Promise.resolve(member);
    query.select = () => query;
    return query;
  });
  t.mock.method(User, "updateOne", async () => {
    member.deactivated = true;
    member.sessionVersion += 1;
    return { matchedCount: 1 };
  });
  t.mock.method(BlacklistedToken, "findOne", async () => null);
  const started = Promise.withResolvers();
  const resume = Promise.withResolvers();
  t.mock.method(Subscription, "deleteMany", async () => {
    started.resolve();
    await resume.promise;
  });
  const deleting = adminController.deleteUser({ params: { id: memberId }, user: { _id: adminId } }, responseDouble());
  await started.promise;
  try {
    const res = responseDouble();
    const token = jwt.sign({ id: memberId, sessionVersion: 0 }, process.env.JWT_SECRET);
    let allowed = false;
    await protect({ headers: { authorization: `Bearer ${token}` } }, res, () => { allowed = true; });
    assert.equal(allowed, false, "New requests must not write data during deletion");
    assert.equal(res.statusCode, 401);
  } finally {
    resume.resolve();
    await deleting;
  }
});

test("DELETE user endpoint enforces authentication, admin access, and ID validation", async (t) => {
  const removals = setupCleanup(t);
  t.mock.method(BlacklistedToken, "findOne", async () => null);
  t.mock.method(User, "findById", (id) => {
    const query = Promise.resolve(new User({ _id: id, email, role: id === adminId ? "admin" : "user" }));
    query.select = () => query;
    return query;
  });
  const app = express();
  app.use("/api/admin", adminRoutes);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const base = `http://127.0.0.1:${server.address().port}/api/admin/users`;
    for (const [id, actor, status] of [[memberId, null, 401], [memberId, memberId, 403], ["bad-id", adminId, 400]]) {
      const res = await fetch(`${base}/${id}`, {
        method: "DELETE",
        headers: actor ? { authorization: `Bearer ${jwt.sign({ id: actor }, process.env.JWT_SECRET)}` } : {},
      });
      assert.equal(res.status, status);
    }
    assert.deepEqual(removals, []);
    const deleted = await fetch(`${base}/${memberId}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${jwt.sign({ id: adminId }, process.env.JWT_SECRET)}` },
    });
    assert.equal(deleted.status, 200);
    assert.deepEqual((await deleted.json()).data, { id: memberId });
    assert.deepEqual(removals.at(-1).map((value) => typeof value === "object" ? String(value._id) : value), ["User", memberId]);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("a deleted account rejects its old session and Google sign-in creates a fresh free account", async (t) => {
  assert.equal(typeof adminController.deleteUser, "function");
  setupCleanup(t);
  let storedUser = new User({
    _id: memberId, email, role: "user", deactivated: true,
    accessRole: "yearly_premium_user", onboardingCompleted: true,
    profile: { name: "Old name", branch: "CSE", passingYear: 2027 },
    telegram: { chatId: "old-chat-id" }, savedJobs: [otherId],
  });
  t.mock.method(User, "findById", (id) => {
    const found = storedUser && String(storedUser._id) === String(id) ? storedUser : null;
    const query = Promise.resolve(found);
    query.select = () => query;
    return query;
  });
  t.mock.method(User, "deleteOne", async () => { storedUser = null; return { deletedCount: 1 }; });
  t.mock.method(User, "findOne", async () => storedUser);
  t.mock.method(PendingUser, "findOne", async () => null);
  t.mock.method(BlacklistedToken, "findOne", async () => null);
  t.mock.method(googleIdentity, "verifyCredential", async () => ({ email, emailVerified: true, sub: "verified-google-id", name: "Fresh name" }));
  t.mock.method(User.prototype, "save", async function () { storedUser = this; return this; });
  const deleted = responseDouble();
  await adminController.deleteUser({ params: { id: memberId }, user: { _id: adminId } }, deleted);
  assert.equal(deleted.statusCode, 200);
  const oldSession = responseDouble();
  const oldToken = jwt.sign({ id: memberId }, process.env.JWT_SECRET);
  let oldSessionAllowed = false;
  await protect({ headers: { authorization: `Bearer ${oldToken}` } }, oldSession, () => { oldSessionAllowed = true; });
  assert.equal(oldSessionAllowed, false, "Deleted session must be rejected");
  assert.equal(oldSession.statusCode, 401);
  const signedIn = responseDouble();
  await authenticateWithGoogle({ body: { credential: "test-credential" } }, signedIn);
  assert.equal(signedIn.statusCode, 200);
  assert.equal(signedIn.body.user.email, email);
  assert.notEqual(String(storedUser._id), memberId);
  assert.equal(storedUser.role, "user");
  assert.equal(storedUser.accessRole, "free_user");
  assert.equal(storedUser.deactivated, false);
  assert.equal(storedUser.onboardingCompleted, false);
  assert.equal(storedUser.profile.branch, undefined);
  assert.equal(storedUser.telegram.chatId, null);
  assert.deepEqual([...storedUser.savedJobs], []);
});
