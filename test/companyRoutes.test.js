import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

Object.assign(process.env, {
  NODE_ENV: "test",
  JWT_SECRET: "local-tests-only-secret-at-least-32-characters",
  CORS_ORIGIN: "https://app.jobverify.test",
});

const { createApp } = await import("../src/app.js");
const { default: Job } = await import("../src/models/Job.js");
const { default: SiteSettings } = await import("../src/models/SiteSettings.js");

async function withApp(run) {
  const app = createApp();
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (
      error ? reject(error) : resolve()
    )));
  }
}

test("companies routes are public and use the validated response contract", async () => {
  const originalAggregate = Job.aggregate;
  const originalSettingsFind = SiteSettings.findById;
  SiteSettings.findById = () => ({ lean: async () => ({ experiencedJobsEnabled: true }) });
  Job.aggregate = () => ({ exec: async () => [{ companies: [], total: [] }] });

  try {
    await withApp(async (base) => {
      const response = await fetch(`${base}/api/companies?q=%20Acme%20&page=1&limit=24`);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.deepEqual(await response.json(), {
        code: 200,
        success: true,
        data: {
          companies: [],
          pagination: { page: 1, limit: 24, total: 0, totalPages: 0 },
          query: "Acme",
        },
      });
    });
  } finally {
    Job.aggregate = originalAggregate;
    SiteSettings.findById = originalSettingsFind;
  }
});

test("companies routes reject out-of-contract query and path inputs", async () => {
  await withApp(async (base) => {
    const invalidUrls = [
      "/api/companies?limit=49",
      "/api/companies?page=0",
      `/api/companies?q=${"a".repeat(101)}`,
      `/api/companies/${"a".repeat(101)}`,
    ];

    for (const path of invalidUrls) {
      const response = await fetch(base + path);
      assert.equal(response.status, 400, path);
      const payload = await response.json();
      assert.equal(payload.code, 400, path);
      assert.equal(payload.success, false, path);
      assert.equal(payload.message, "Validation failed", path);
    }
  });
});

