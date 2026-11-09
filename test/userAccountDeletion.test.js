import assert from "node:assert/strict";
import test from "node:test";

import { deleteUserAccount } from "../src/controllers/userController.js";
import Click from "../src/models/Click.js";
import JobAlertDelivery from "../src/models/JobAlertDelivery.js";
import PlanPurchase from "../src/models/PlanPurchase.js";
import AccessEvent from "../src/models/AccessEvent.js";
import Subscription from "../src/models/Subscription.js";
import TelegramLinkToken from "../src/models/TelegramLinkToken.js";
import User from "../src/models/User.js";
import UserSuggestion from "../src/models/UserSuggestion.js";
import PendingUser from "../src/models/PendingUser.js";
import AdminAudit from "../src/models/AdminAudit.js";
import SiteSettings from "../src/models/SiteSettings.js";
import Application from '../src/models/Application.js';
import Resume from '../src/models/Resume.js';
import { mockAccountDeletion } from './helpers/accountDeletionDoubles.js';

const createResponseDouble = () => ({
  statusCode: 200,
  body: null,
  clearedCookie: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    return this;
  },
  clearCookie(name) {
    this.clearedCookie = name;
  },
});

test("deleteUserAccount removes the authenticated user's account-linked data and clears their session", async (t) => {
  mockAccountDeletion(t);
  const resumeDeletion = t.mock.method(Resume, 'deleteMany', async () => ({ deletedCount: 1 }));
  const userId = "507f1f77bcf86cd799439011";
  const email = "deleted.account@gmail.com";
  const originalMethods = {
    deleteOne: User.deleteOne,
    subscriptions: Subscription.deleteMany,
    clicks: Click.deleteMany,
    deliveries: JobAlertDelivery.deleteMany,
    purchases: PlanPurchase.deleteMany,
    accessEvents: AccessEvent.deleteMany,
    suggestions: UserSuggestion.deleteMany,
    telegramTokens: TelegramLinkToken.deleteMany,
    pendingUsers: PendingUser.deleteMany,
    audits: AdminAudit.deleteMany,
    settings: SiteSettings.updateMany,
    applications: Application.deleteMany,
  };
  const removals = [];

  User.deleteOne = async (filter) => { removals.push(["user", filter]); };
  Subscription.deleteMany = async (filter) => { removals.push(["subscription", filter]); };
  Click.deleteMany = async (filter) => { removals.push(["click", filter]); };
  JobAlertDelivery.deleteMany = async (filter) => { removals.push(["delivery", filter]); };
  PlanPurchase.deleteMany = async (filter) => { removals.push(["purchase", filter]); };
  AccessEvent.deleteMany = async (filter) => { removals.push(["accessEvent", filter]); };
  UserSuggestion.deleteMany = async (filter) => { removals.push(["suggestion", filter]); };
  Application.deleteMany = async (filter) => { removals.push(['application', filter]); };
  TelegramLinkToken.deleteMany = async (filter) => { removals.push(["telegramToken", filter]); };
  PendingUser.deleteMany = async (filter) => { removals.push(["pendingUser", filter]); };
  AdminAudit.deleteMany = async (filter) => { removals.push(["audit", filter]); };
  SiteSettings.updateMany = async (filter, update) => { removals.push(["settings", filter, update]); };

  try {
    const res = createResponseDouble();
    await deleteUserAccount({
      user: { _id: userId, email },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
      code: 200,
      success: true,
      message: "Account deleted successfully",
    });
    assert.equal(res.clearedCookie, "jobverify_token");
    assert.deepEqual(resumeDeletion.mock.calls[0].arguments, [{ user: userId }]);
    assert.deepEqual(removals, [
      ["subscription", { user: userId }],
      ["click", { user: userId }],
      ["delivery", { user: userId }],
      ["purchase", { user: userId }],
      ["accessEvent", { user: userId }],
      ["telegramToken", { user: userId }],
      ["suggestion", { user: userId }],
      ['application', { user: userId }],
      ["pendingUser", { email }],
      ["audit", { $or: [{ admin: userId }, { targetType: "User", targetId: userId }] }],
      ["settings", { updatedBy: userId }, { $unset: { updatedBy: "" } }],
      ["user", { _id: userId }],
    ]);
  } finally {
    User.deleteOne = originalMethods.deleteOne;
    Subscription.deleteMany = originalMethods.subscriptions;
    Click.deleteMany = originalMethods.clicks;
    JobAlertDelivery.deleteMany = originalMethods.deliveries;
    PlanPurchase.deleteMany = originalMethods.purchases;
    AccessEvent.deleteMany = originalMethods.accessEvents;
    UserSuggestion.deleteMany = originalMethods.suggestions;
    TelegramLinkToken.deleteMany = originalMethods.telegramTokens;
    PendingUser.deleteMany = originalMethods.pendingUsers;
    AdminAudit.deleteMany = originalMethods.audits;
    SiteSettings.updateMany = originalMethods.settings;
    Application.deleteMany = originalMethods.applications;
  }
});
