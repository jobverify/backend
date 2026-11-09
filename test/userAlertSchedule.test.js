import assert from "node:assert/strict";
import test from "node:test";
import { validationResult } from "express-validator";
import Subscription from "../src/models/Subscription.js";
import { getUserTelegramAlertSchedule, updateUserTelegramAlertSchedule, telegramAlertScheduleValidation } from "../src/controllers/alertScheduleController.js";

const response = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

test("schedule GET returns daily defaults and explains local delivery time", async (t) => {
  t.mock.method(Subscription, "findOne", (filter) => {
    assert.deepEqual(filter, { user: "user-1" });
    return { lean: () => ({ exec: async () => null }) };
  });
  const res = response();
  await getUserTelegramAlertSchedule({ user: { _id: "user-1", accessRole: "semester_premium_user",
    premium: { planId: "semester", status: "active", telegramAlertsEnabled: true },
    telegram: { chatId: "1001", linkedAt: new Date("2026-01-01") },
    profile: { telegramAlertFilters: { jobType: ["Internship"] } } } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.frequency, "daily");
  assert.equal(res.body.data.isActive, true);
  assert.equal(res.body.data.timeZone, "Asia/Kolkata");
});

test("schedule validation rejects invalid cadence and non-boolean pause values", async () => {
  for (const body of [
    { frequency: "immediate", isActive: true },
    { frequency: "hourly", isActive: true },
    { frequency: "daily", isActive: "false" },
    { frequency: "daily" },
    { frequency: "", isActive: true },
  ]) {
    const req = { body: { deliveryTime: "09:00", weeklyDay: "Monday", ...body } };
    await Promise.all(telegramAlertScheduleValidation.map((rule) => rule.run(req)));
    assert.equal(validationResult(req).isEmpty(), false);
  }
});

test("schedule update never accepts invalid input even when called outside routing", async () => {
  const res = response();
  await updateUserTelegramAlertSchedule({ user: { _id: "user-1" }, body: { frequency: "hourly", isActive: true, deliveryTime: "09:00", weeklyDay: "Monday" } }, res);
  assert.equal(res.statusCode, 400);
});

test("Telegram schedules stay unavailable until linking, enabling and saved filters are complete", async (t) => {
  let loads = 0;
  t.mock.method(Subscription, "findOne", () => { loads++; return { lean: () => ({ exec: async () => null }) }; });
  const ready = { _id: "user-1", accessRole: "semester_premium_user",
    premium: { planId: "semester", status: "active", telegramAlertsEnabled: true },
    telegram: { chatId: "1001", linkedAt: new Date("2026-01-01") },
    profile: { telegramAlertFilters: { jobType: ["Internship"] } } };
  for (const user of [
    { ...ready, telegram: {} },
    { ...ready, premium: { ...ready.premium, telegramAlertsEnabled: false } },
    { ...ready, profile: { telegramAlertFilters: {} } },
    { ...ready, premium: { ...ready.premium, status: "expired" } },
  ]) {
    const res = response();
    await getUserTelegramAlertSchedule({ user }, res);
    assert.equal(res.statusCode, 409);
  }
  assert.equal(loads, 0);
  const res = response();
  await getUserTelegramAlertSchedule({ user: ready }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.deliveryTime, "09:00");
});

test("Telegram schedule rejects malformed time and weekday without persisting", async () => {
  for (const change of [{ deliveryTime: "24:00" }, { deliveryTime: "9:30" }, { deliveryTime: ["09:30"] }, { weeklyDay: "Funday" }]) {
    const req = { body: { frequency: "weekly", isActive: true, deliveryTime: "18:30", weeklyDay: "Friday", ...change } };
    await Promise.all(telegramAlertScheduleValidation.map((rule) => rule.run(req)));
    assert.equal(validationResult(req).isEmpty(), false);
    const res = response();
    await updateUserTelegramAlertSchedule(req, res);
    assert.equal(res.statusCode, 400);
  }
});
