import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const getRouteLayer = (router, routePath, method) =>
  router.stack.find(
    (entry) => entry.route?.path === routePath && entry.route?.methods?.[method],
  );

const getMiddlewareNames = (layer) => layer?.route?.stack?.map((entry) => entry.name) ?? [];

test("job router mounts publicJobAbuseGuard only on browse, search, and detail routes", async () => {
  const originalJwtSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = originalJwtSecret || "x".repeat(32);

  try {
    const { default: router } = await import(`../src/routes/jobRoutes.js?case=${Date.now()}`);

    const listRoute = getRouteLayer(router, "/", "get");
    const searchGetRoute = getRouteLayer(router, "/search", "get");
    const searchPostRoute = getRouteLayer(router, "/search", "post");
    const metaRoute = getRouteLayer(router, "/meta", "get");
    const companiesRoute = getRouteLayer(router, "/meta/companies", "get");
    const statsRoute = getRouteLayer(router, "/stats", "get");
    const liveCompaniesRoute = getRouteLayer(router, "/live-companies", "get");
    const seoFeedRoute = getRouteLayer(router, "/seo-feed", "get");
    const detailRoute = getRouteLayer(router, "/:id", "get");
    const clickRoute = getRouteLayer(router, "/:id/click", "post");

    for (const [label, routeLayer, controllerName] of [
      ["list", listRoute, "getAllJobs"],
      ["search-get", searchGetRoute, "getJobSearch"],
      ["search-post", searchPostRoute, "getJobSearch"],
      ["detail", detailRoute, "getJobById"],
    ]) {
      const middlewareNames = getMiddlewareNames(routeLayer);

      assert.ok(routeLayer, `expected ${label} route to exist`);
      assert.ok(
        middlewareNames.includes("publicJobAbuseGuard"),
        `expected ${label} route to include publicJobAbuseGuard`,
      );
      assert.ok(
        middlewareNames.indexOf("publicJobAbuseGuard") < middlewareNames.indexOf(controllerName),
        `expected ${label} route to run the guard before ${controllerName}`,
      );
    }

    for (const [label, routeLayer] of [
      ["meta", metaRoute],
      ["meta-companies", companiesRoute],
      ["stats", statsRoute],
      ["live-companies", liveCompaniesRoute],
      ["seo-feed", seoFeedRoute],
      ["click", clickRoute],
    ]) {
      assert.ok(routeLayer, `expected ${label} route to exist`);
      assert.equal(
        getMiddlewareNames(routeLayer).includes("publicJobAbuseGuard"),
        false,
        `expected ${label} route to stay outside the public abuse guard`,
      );
    }
  } finally {
    process.env.JWT_SECRET = originalJwtSecret;
  }
});

test(".env.example documents the explicit public abuse guard defaults", () => {
  const envExample = fs.readFileSync(
    path.join(import.meta.dirname, "..", ".env.example"),
    "utf8",
  );

  assert.match(envExample, /PUBLIC_JOB_ABUSE_PAGE_WALK_WINDOW_MS=60000/);
  assert.match(envExample, /PUBLIC_JOB_ABUSE_PAGE_WALK_LIMIT=30/);
  assert.match(envExample, /PUBLIC_JOB_ABUSE_DETAIL_WINDOW_MS=60000/);
  assert.match(envExample, /PUBLIC_JOB_ABUSE_DETAIL_LIMIT=90/);
  assert.match(envExample, /PUBLIC_JOB_ABUSE_VIOLATION_WINDOW_MS=900000/);
  assert.match(envExample, /PUBLIC_JOB_ABUSE_VIOLATION_LIMIT=5/);
  assert.match(envExample, /PUBLIC_JOB_ABUSE_BLOCK_MS=900000/);
  assert.match(envExample, /PUBLIC_JOB_ABUSE_MAX_RECORDS=5000/);
});
