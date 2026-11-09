import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

Object.assign(process.env, {
  NODE_ENV: "test",
  JWT_SECRET: "admin-suggestion-route-tests-secret-at-least-32-characters",
});

const { default: express } = await import("express");
const { default: jwt } = await import("jsonwebtoken");
const { default: adminRoutes } = await import("../src/routes/adminRoutes.js");
const { default: BlacklistedToken } = await import("../src/models/BlacklistedToken.js");
const { default: UserSuggestion } = await import("../src/models/UserSuggestion.js");
const { default: User } = await import("../src/models/User.js");

const adminId = "507f1f77bcf86cd799439011";
const memberId = "507f1f77bcf86cd799439012";
const tokenFor = (id) => `Bearer ${jwt.sign(
  { id, sessionVersion: 0 },
  process.env.JWT_SECRET,
)}`;

const userRecord = (id) => ({
  _id: id,
  role: id === adminId ? "admin" : "user",
  accessRole: "free_user",
  deactivated: false,
  sessionVersion: 0,
  premium: {
    planId: "free",
    status: "inactive",
    expiresAt: null,
    telegramAlertsEnabled: false,
  },
});

const originalMethods = {
  blacklistFindOne: BlacklistedToken.findOne,
  suggestionCount: UserSuggestion.countDocuments,
  suggestionFind: UserSuggestion.find,
  userFindById: User.findById,
};

let server;
let baseUrl;
let queryTrace;

test.before(async () => {
  BlacklistedToken.findOne = async () => null;
  User.findById = (id) => ({ select: async () => userRecord(String(id)) });
  UserSuggestion.countDocuments = async () => 21;
  UserSuggestion.find = (filter) => {
    queryTrace = { filter };
    return {
      sort(value) {
        queryTrace.sort = value;
        return this;
      },
      skip(value) {
        queryTrace.skip = value;
        return this;
      },
      limit(value) {
        queryTrace.limit = value;
        return this;
      },
      populate(value) {
        queryTrace.populate = value;
        return this;
      },
      lean() {
        queryTrace.lean = true;
        return this;
      },
      async exec() {
        return [{
          _id: "suggestion-21",
          message: "Please add Example Company.",
          createdAt: new Date("2026-09-13T12:00:00.000Z"),
          user: {
            _id: memberId,
            email: "member@example.com",
            profile: { name: "Member Name" },
          },
        }];
      },
    };
  };

  const app = express();
  app.use(express.json());
  app.use("/api/admin", adminRoutes);
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  BlacklistedToken.findOne = originalMethods.blacklistFindOne;
  UserSuggestion.countDocuments = originalMethods.suggestionCount;
  UserSuggestion.find = originalMethods.suggestionFind;
  User.findById = originalMethods.userFindById;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

const getSuggestions = (authorization, query = "") =>
  fetch(`${baseUrl}/api/admin/suggestions${query}`, {
    headers: authorization ? { authorization } : {},
  });

test("admin suggestions require an authenticated administrator", async () => {
  const unauthenticated = await getSuggestions();
  assert.equal(unauthenticated.status, 401);

  const member = await getSuggestions(tokenFor(memberId));
  assert.equal(member.status, 403);
});

test("admin suggestions reject invalid pagination", async () => {
  const response = await getSuggestions(tokenFor(adminId), "?page=0&limit=51");

  assert.equal(response.status, 400);
  assert.equal((await response.json()).success, false);
});

test("admin suggestions return stable newest-first populated rows", async () => {
  const response = await getSuggestions(tokenFor(adminId), "?page=2&limit=20");
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(queryTrace, {
    filter: {},
    sort: { createdAt: -1, _id: -1 },
    skip: 20,
    limit: 20,
    populate: { path: "user", select: "email profile.name" },
    lean: true,
  });
  assert.equal(body.total, 21);
  assert.equal(body.page, 2);
  assert.equal(body.pages, 2);
  assert.deepEqual(body.data, [{
    id: "suggestion-21",
    message: "Please add Example Company.",
    createdAt: "2026-09-13T12:00:00.000Z",
    user: {
      id: memberId,
      email: "member@example.com",
      profile: { name: "Member Name" },
    },
  }]);
});
