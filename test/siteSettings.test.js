import assert from "node:assert/strict";
import test from "node:test";
import { once } from "node:events";
import express from "express";
import jwt from "jsonwebtoken";
import SiteSettings from "../src/models/SiteSettings.js";
import User from "../src/models/User.js";
import BlacklistedToken from "../src/models/BlacklistedToken.js";
import { getSiteSettings, saveSiteSettings } from "../src/services/siteSettingsService.js";
import { readSiteSettings, updateSiteSettings } from "../src/controllers/siteSettingsController.js";
import { loadSiteSettings, requireBillingEnabled } from "../src/middleware/siteSettings.js";
import { canUsePremiumFilters } from "../src/utils/accessControl.js";
process.env.JWT_SECRET = "site-settings-tests-only-secret-at-least-32-characters";
const { default: adminRoutes } = await import("../src/routes/adminRoutes.js");

test("settings default to free mode and persist explicit on/off values", async (t) => {
  let stored = null;
  t.mock.method(SiteSettings, "findById", () => ({ lean: async () => stored }));
  t.mock.method(SiteSettings, "findByIdAndUpdate", (id, update, options) => {
    assert.equal(id, "global");
    assert.equal(options.upsert, true);
    assert.equal(update.$set.updatedBy, "admin-1");
    stored = update.$set;
    return { lean: async () => stored };
  });
  assert.deepEqual(await getSiteSettings(), { billingEnabled: false, experiencedJobsEnabled: true });
  assert.deepEqual(await saveSiteSettings(true, "admin-1"), { billingEnabled: true, experiencedJobsEnabled: true });
  assert.deepEqual(await getSiteSettings(), { billingEnabled: true, experiencedJobsEnabled: true });
  assert.deepEqual(await saveSiteSettings(false, "admin-1"), { billingEnabled: false, experiencedJobsEnabled: true });
  assert.deepEqual(await getSiteSettings(), { billingEnabled: false, experiencedJobsEnabled: true });
});

test("real admin routes enforce authentication, role, boolean validation, and durable changes", async (t) => {
  let stored = null;
  const adminId = "507f1f77bcf86cd799439011";
  t.mock.method(SiteSettings, "findById", () => ({ lean: async () => stored }));
  t.mock.method(SiteSettings, "findByIdAndUpdate", (_id, update) => {
    stored = update.$set;
    return { lean: async () => stored };
  });
  t.mock.method(BlacklistedToken, "findOne", async () => null);
  t.mock.method(User, "findById", (id) => ({ select: async () => ({ _id: id, role: id === adminId ? "admin" : "user" }) }));
  const app = express();
  app.use(express.json());
  app.get("/api/site-settings", readSiteSettings);
  app.use("/api/admin", adminRoutes);
  app.post("/checkout", requireBillingEnabled, (_req, res) => res.json({ success: true }));
  app.get("/filters", loadSiteSettings, (req, res) => res.json({ allowed: canUsePremiumFilters(null, new Date(), req.siteSettings) }));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const base = "http://127.0.0.1:" + server.address().port;
    const update = (value, id) => fetch(base + "/api/admin/site-settings", {
      method: "PUT", headers: { "content-type": "application/json", ...(id ? { authorization: "Bearer " + jwt.sign({ id }, process.env.JWT_SECRET) } : {}) },
      body: JSON.stringify({ billingEnabled: value }),
    });
    assert.equal((await update(true)).status, 401);
    assert.equal((await update(true, "507f1f77bcf86cd799439012")).status, 403);
    assert.equal((await update("true", adminId)).status, 400);
    assert.equal((await fetch(base + "/checkout", { method: "POST" })).status, 403);
    assert.equal((await (await fetch(base + "/filters")).json()).allowed, true);
    assert.equal((await update(true, adminId)).status, 200);
    const response = await fetch(base + "/api/site-settings");
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal((await response.json()).data.billingEnabled, true);
    assert.equal((await (await fetch(base + "/filters")).json()).allowed, false);
    assert.equal((await fetch(base + "/checkout", { method: "POST" })).status, 200);
    assert.equal((await update(false, adminId)).status, 200);
    assert.equal((await (await fetch(base + "/api/site-settings")).json()).data.billingEnabled, false);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});

test("failed settings reads propagate errors instead of granting paid actions", async (t) => {
  const failure = new Error("database unavailable");
  t.mock.method(SiteSettings, "findById", () => ({ lean: async () => { throw failure; } }));
  let received;
  await requireBillingEnabled({}, {}, (error) => { received = error; });
  assert.equal(received, failure);
  await assert.rejects(getSiteSettings(), failure);
});

test("invalid settings updates never write to the database", async (t) => {
  const write = t.mock.method(SiteSettings, "findByIdAndUpdate", () => { throw new Error("must not write"); });
  for (const value of [null, undefined, "false", 0, {}, []]) {
    const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
    await updateSiteSettings({ body: { billingEnabled: value } }, res);
    assert.equal(res.code, 400);
  }
  assert.equal(write.mock.callCount(), 0);
});
