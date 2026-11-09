import assert from "node:assert/strict";
import test from "node:test";
import { getNextAlertDeliveryAt, normalizeAlertSchedule } from "../src/services/alertScheduleService.js";

test("accounts without a schedule wait until daily delivery at 09:00 IST", () => {
  const schedule = normalizeAlertSchedule(null);
  assert.deepEqual(schedule, { frequency: "daily", isActive: true, version: 0, deliveryTime: "09:00", weeklyDay: "Monday" });
  assert.equal(getNextAlertDeliveryAt(schedule.frequency, new Date("2026-09-12T02:00:00Z"), schedule).toISOString(), "2026-09-12T03:30:00.000Z");
  assert.throws(() => getNextAlertDeliveryAt("immediate"), TypeError);
});

test("legacy immediate schedules become daily and invalidate queued schedule versions", () => {
  const schedule = normalizeAlertSchedule({ telegramSchedule: { frequency: "immediate", isActive: false, scheduleVersion: 4, deliveryTime: "18:20" } });
  assert.equal(schedule.frequency, "daily");
  assert.equal(schedule.version, 5);
  assert.equal(schedule.isActive, false);
  assert.equal(getNextAlertDeliveryAt(schedule.frequency, new Date("2026-09-12T02:00:00Z"), schedule).toISOString(), "2026-09-12T12:50:00.000Z");
});

test("daily digests are due at the next 09:00 IST, including the exact boundary", () => {
  for (const [now, expected] of [
    ["2026-09-12T03:29:59Z", "2026-09-12T03:30:00.000Z"],
    ["2026-09-12T03:30:00Z", "2026-09-13T03:30:00.000Z"],
    ["2026-12-31T23:00:00Z", "2027-01-01T03:30:00.000Z"],
  ]) assert.equal(getNextAlertDeliveryAt("daily", new Date(now)).toISOString(), expected);
});

test("weekly digests are due Monday at 09:00 IST", () => {
  for (const [now, expected] of [
    ["2026-09-12T02:00:00Z", "2026-09-14T03:30:00.000Z"],
    ["2026-09-14T03:29:59Z", "2026-09-14T03:30:00.000Z"],
    ["2026-09-14T03:30:00Z", "2026-09-21T03:30:00.000Z"],
  ]) assert.equal(getNextAlertDeliveryAt("weekly", new Date(now)).toISOString(), expected);
});

test("paused subscriptions retain cadence and a stable settings version", () => {
  assert.deepEqual(normalizeAlertSchedule({ telegramSchedule: { frequency: "weekly", isActive: false, scheduleVersion: 4 } }), {
    frequency: "weekly", isActive: false, version: 4, deliveryTime: "09:00", weeklyDay: "Monday",
  });
});

test("daily delivery uses the selected IST time across UTC date boundaries", () => {
  for (const [now, deliveryTime, expected] of [
    ["2026-09-12T18:00:00Z", "00:15", "2026-09-12T18:45:00.000Z"],
    ["2026-09-12T18:45:00Z", "00:15", "2026-09-13T18:45:00.000Z"],
    ["2026-12-31T18:29:59Z", "00:00", "2026-12-31T18:30:00.000Z"],
    ["2026-09-12T02:00:00Z", "22:40", "2026-09-12T17:10:00.000Z"],
  ]) assert.equal(getNextAlertDeliveryAt("daily", new Date(now), { deliveryTime }).toISOString(), expected);
});

test("weekly delivery uses the selected local weekday and time", () => {
  for (const [now, expected] of [
    ["2026-09-12T18:00:00Z", "2026-09-12T18:45:00.000Z"],
    ["2026-09-12T18:45:00Z", "2026-09-19T18:45:00.000Z"],
  ]) assert.equal(getNextAlertDeliveryAt("weekly", new Date(now), {
    deliveryTime: "00:15", weeklyDay: "Sunday",
  }).toISOString(), expected);
});

test("Telegram uses its saved time and weekday independently of retired fields", () => {
  const subscription = { frequency: "daily", isActive: true, scheduleVersion: 2,
    telegramSchedule: { frequency: "weekly", isActive: false, scheduleVersion: 3, deliveryTime: "18:20", weeklyDay: "Friday" } };
  const telegram = normalizeAlertSchedule(subscription, "telegram");
  assert.equal(telegram.frequency, "weekly");
  assert.equal(telegram.deliveryTime, "18:20");
  assert.equal(telegram.weeklyDay, "Friday");
  assert.equal(telegram.isActive, false);
  assert.equal(telegram.version, 3);
  assert.equal(normalizeAlertSchedule(subscription).frequency, "weekly");
});

test("existing Telegram users retain their earlier cadence and pause until saving a new schedule", () => {
  assert.deepEqual(normalizeAlertSchedule({ frequency: "weekly", isActive: false, scheduleVersion: 6 }), {
    frequency: "weekly", isActive: false, version: 6, deliveryTime: "09:00", weeklyDay: "Monday",
  });
});
