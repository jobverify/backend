import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

Object.assign(process.env, {
  NODE_ENV: "test",
  JWT_SECRET: "user-suggestion-route-tests-secret-at-least-32-characters",
});

const { default: express } = await import("express");
const { default: jwt } = await import("jsonwebtoken");
const { default: BlacklistedToken } = await import("../src/models/BlacklistedToken.js");
const { default: UserSuggestion } = await import("../src/models/UserSuggestion.js");
const { default: User } = await import("../src/models/User.js");
const { default: userRoutes } = await import("../src/routes/userRoutes.js");

const userId = "507f1f77bcf86cd799439011";
const authorization = `Bearer ${jwt.sign(
  { id: userId, sessionVersion: 0 },
  process.env.JWT_SECRET,
)}`;

const authenticatedUser = {
  _id: userId,
  role: "user",
  accessRole: "free_user",
  deactivated: false,
  sessionVersion: 0,
  premium: {
    planId: "free",
    status: "inactive",
    expiresAt: null,
    telegramAlertsEnabled: false,
  },
};

const originalMethods = {
  blacklistFindOne: BlacklistedToken.findOne,
  suggestionCreate: UserSuggestion.create,
  userFindById: User.findById,
};

let server;
let baseUrl;

test.before(async () => {
  BlacklistedToken.findOne = async () => null;
  User.findById = () => ({ select: async () => authenticatedUser });

  const app = express();
  app.use(express.json());
  app.use("/api/user", userRoutes);
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  BlacklistedToken.findOne = originalMethods.blacklistFindOne;
  UserSuggestion.create = originalMethods.suggestionCreate;
  User.findById = originalMethods.userFindById;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test.beforeEach(() => {
  UserSuggestion.create = async (payload) => ({
    ...payload,
    id: "suggestion-1",
    createdAt: new Date("2026-09-13T12:00:00.000Z"),
  });
});

const postSuggestion = (message, authenticated = true) =>
  fetch(`${baseUrl}/api/user/suggestions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(authenticated ? { authorization } : {}),
    },
    body: JSON.stringify({ message }),
  });

test("suggestion submission rejects an unauthenticated request", async () => {
  const response = await postSuggestion("Please add Acme", false);

  assert.equal(response.status, 401);
});

test("suggestion submission rejects empty, non-text, and 101-word messages", async () => {
  for (const message of [
    "   ",
    42,
    Array.from({ length: 101 }, () => "word").join(" "),
  ]) {
    const response = await postSuggestion(message);
    assert.equal(response.status, 400);
    assert.equal((await response.json()).success, false);
  }
});

test("suggestion submission trims and stores an accepted message", async () => {
  const writes = [];
  UserSuggestion.create = async (payload) => {
    writes.push(payload);
    return {
      ...payload,
      id: "suggestion-1",
      createdAt: new Date("2026-09-13T12:00:00.000Z"),
    };
  };

  const response = await postSuggestion("  Please add Acme careers  ");
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].message, "Please add Acme careers");
  assert.equal(body.success, true);
  assert.equal(body.data.message, "Please add Acme careers");
  assert.equal(body.data.remainingToday, 4);
});

test("suggestion submission returns 429 after all five daily slots collide", async () => {
  UserSuggestion.create = async () => {
    const error = new Error("duplicate suggestion quota slot");
    error.code = 11000;
    error.keyPattern = { user: 1, submittedDay: 1, dailySlot: 1 };
    throw error;
  };

  const response = await postSuggestion("Sixth note");
  const body = await response.json();

  assert.equal(response.status, 429);
  assert.equal(body.success, false);
  assert.match(body.message, /midnight India time/i);
});

test("suggestion submission hides unexpected database errors", async () => {
  UserSuggestion.create = async () => {
    throw new Error("private database topology");
  };

  const response = await postSuggestion("Please add Acme");
  const body = await response.json();

  assert.equal(response.status, 500);
  assert.equal(body.message, "Internal Server Error");
  assert.doesNotMatch(JSON.stringify(body), /topology/i);
});
