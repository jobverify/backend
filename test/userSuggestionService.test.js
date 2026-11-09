import assert from "node:assert/strict";
import test from "node:test";

import UserSuggestion from "../src/models/UserSuggestion.js";
import {
  createUserSuggestion,
  UserSuggestionDailyLimitError,
} from "../src/services/userSuggestionService.js";
import {
  countSuggestionCharacters,
  getIndiaDayKey,
} from "../src/utils/userSuggestion.js";

const quotaCollision = () => {
  const error = new Error("duplicate suggestion quota slot");
  error.code = 11000;
  error.keyPattern = { user: 1, submittedDay: 1, dailySlot: 1 };
  return error;
};

test("suggestion character count includes whitespace", () => {
  assert.equal(countSuggestionCharacters("  Acme\n\tCareers   please "), 25);
  assert.equal(countSuggestionCharacters("   "), 3);
  assert.equal(countSuggestionCharacters("a".repeat(100)), 100);
  assert.equal(countSuggestionCharacters("a".repeat(101)), 101);
});

test("India day keys cross midnight at UTC+05:30", () => {
  assert.equal(
    getIndiaDayKey(new Date("2026-09-13T18:29:59.999Z")),
    "2026-09-13",
  );
  assert.equal(
    getIndiaDayKey(new Date("2026-09-13T18:30:00.000Z")),
    "2026-09-14",
  );
});

test("slot allocation retries quota collisions and reports remaining allowance", async () => {
  const originalCreate = UserSuggestion.create;
  const attempts = [];

  UserSuggestion.create = async (payload) => {
    attempts.push(payload);
    if (payload.dailySlot < 3) throw quotaCollision();

    return {
      ...payload,
      id: "suggestion-3",
      createdAt: new Date("2026-09-13T12:00:00.000Z"),
    };
  };

  try {
    const result = await createUserSuggestion({
      userId: "507f1f77bcf86cd799439011",
      message: "  Add Acme careers  ",
      now: new Date("2026-09-13T12:00:00.000Z"),
    });

    assert.deepEqual(attempts.map(({ dailySlot }) => dailySlot), [1, 2, 3]);
    assert.equal(attempts[0].submittedDay, "2026-09-13");
    assert.equal(result.suggestion.message, "Add Acme careers");
    assert.equal(result.remainingToday, 2);
  } finally {
    UserSuggestion.create = originalCreate;
  }
});

test("slot allocation rejects a sixth India-day submission", async () => {
  const originalCreate = UserSuggestion.create;
  let attempts = 0;

  UserSuggestion.create = async () => {
    attempts += 1;
    throw quotaCollision();
  };

  try {
    await assert.rejects(
      createUserSuggestion({
        userId: "507f1f77bcf86cd799439011",
        message: "Acme",
        now: new Date("2026-09-13T12:00:00.000Z"),
      }),
      UserSuggestionDailyLimitError,
    );
    assert.equal(attempts, 5);
  } finally {
    UserSuggestion.create = originalCreate;
  }
});

test("slot allocation never hides an unrelated database failure", async () => {
  const originalCreate = UserSuggestion.create;
  const databaseError = new Error("database unavailable");

  UserSuggestion.create = async () => {
    throw databaseError;
  };

  try {
    await assert.rejects(
      createUserSuggestion({
        userId: "507f1f77bcf86cd799439011",
        message: "Acme",
      }),
      databaseError,
    );
  } finally {
    UserSuggestion.create = originalCreate;
  }
});

test("the suggestion schema enforces message rules and the unique quota index", () => {
  const valid = new UserSuggestion({
    user: "507f1f77bcf86cd799439011",
    message: "a".repeat(100),
    submittedDay: "2026-09-13",
    dailySlot: 5,
  });
  assert.equal(valid.validateSync(), undefined);

  const invalid = new UserSuggestion({
    user: "507f1f77bcf86cd799439011",
    message: "a".repeat(101),
    submittedDay: "2026-09-13",
    dailySlot: 6,
  });
  const validation = invalid.validateSync();
  assert.ok(validation.errors.message);
  assert.ok(validation.errors.dailySlot);

  const quotaIndex = UserSuggestion.schema.indexes().find(([fields]) => (
    fields.user === 1
    && fields.submittedDay === 1
    && fields.dailySlot === 1
  ));
  assert.equal(quotaIndex?.[1]?.unique, true);
});
