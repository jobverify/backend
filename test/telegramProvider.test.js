import assert from "node:assert/strict";
import test from "node:test";

import {
  getTelegramProvider,
  isTelegramDeliveryEnabled,
} from "../src/services/telegramProvider.js";

test("Telegram provider posts a text message and returns Telegram's message id", async () => {
  const originalEnabled = process.env.TELEGRAM_ENABLED;
  const originalToken = process.env.TELEGRAM_BOT_TOKEN;
  const originalFetch = global.fetch;
  const controller = new AbortController();
  const requests = [];

  process.env.TELEGRAM_ENABLED = "true";
  process.env.TELEGRAM_BOT_TOKEN = "test-bot-token";
  global.fetch = async (url, options) => {
    requests.push({ url, options });
    return {
      ok: true,
      json: async () => ({ ok: true, result: { message_id: 42 } }),
    };
  };

  try {
    const result = await getTelegramProvider().sendTextMessage({
      chatId: "99",
      body: "New job",
      signal: controller.signal,
    });

    assert.equal(isTelegramDeliveryEnabled(), true);
    assert.equal(result.providerName, "telegram");
    assert.equal(result.providerMessageId, "42");
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, "https://api.telegram.org/bottest-bot-token/sendMessage");
    assert.equal(requests[0].options.method, "POST");
    assert.equal(requests[0].options.signal, controller.signal);
    assert.deepEqual(JSON.parse(requests[0].options.body), {
      chat_id: "99",
      text: "New job",
      disable_web_page_preview: true,
    });
  } finally {
    process.env.TELEGRAM_ENABLED = originalEnabled;
    process.env.TELEGRAM_BOT_TOKEN = originalToken;
    global.fetch = originalFetch;
  }
});

test("Telegram delivery is disabled unless TELEGRAM_ENABLED is truthy", () => {
  const originalEnabled = process.env.TELEGRAM_ENABLED;
  process.env.TELEGRAM_ENABLED = "false";

  try {
    assert.equal(isTelegramDeliveryEnabled(), false);
  } finally {
    process.env.TELEGRAM_ENABLED = originalEnabled;
  }
});

test("Telegram provider does not expose the bot token when the request fails", async () => {
  const originalEnabled = process.env.TELEGRAM_ENABLED;
  const originalToken = process.env.TELEGRAM_BOT_TOKEN;
  const originalFetch = global.fetch;

  process.env.TELEGRAM_ENABLED = "true";
  process.env.TELEGRAM_BOT_TOKEN = "sensitive-bot-token";
  global.fetch = async () => {
    throw new Error("request to bot sensitive-bot-token failed");
  };

  try {
    await assert.rejects(
      getTelegramProvider().sendTextMessage({ chatId: "99", body: "New job" }),
      (error) => {
        assert.doesNotMatch(error.message, /sensitive-bot-token/);
        return true;
      },
    );
  } finally {
    process.env.TELEGRAM_ENABLED = originalEnabled;
    process.env.TELEGRAM_BOT_TOKEN = originalToken;
    global.fetch = originalFetch;
  }
});

test("Telegram provider rejects successful HTTP responses without a Telegram message id", async () => {
  const originalEnabled = process.env.TELEGRAM_ENABLED;
  const originalToken = process.env.TELEGRAM_BOT_TOKEN;
  const originalFetch = global.fetch;

  process.env.TELEGRAM_ENABLED = "true";
  process.env.TELEGRAM_BOT_TOKEN = "test-bot-token";
  global.fetch = async () => ({ ok: true, status: 200, json: async () => ({ ok: true, result: {} }) });

  try {
    await assert.rejects(
      getTelegramProvider().sendTextMessage({ chatId: "99", body: "New job" }),
      /Telegram send failed\./,
    );
  } finally {
    process.env.TELEGRAM_ENABLED = originalEnabled;
    process.env.TELEGRAM_BOT_TOKEN = originalToken;
    global.fetch = originalFetch;
  }
});

test('Telegram provider distinguishes payload failures, unavailable chats and rate limits without exposing provider text', async t => {
  const originalEnabled = process.env.TELEGRAM_ENABLED;
  const originalToken = process.env.TELEGRAM_BOT_TOKEN;
  process.env.TELEGRAM_ENABLED = 'true';
  process.env.TELEGRAM_BOT_TOKEN = 'private-fixture-token';
  t.after(() => {
    if (originalEnabled === undefined) delete process.env.TELEGRAM_ENABLED; else process.env.TELEGRAM_ENABLED = originalEnabled;
    if (originalToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN; else process.env.TELEGRAM_BOT_TOKEN = originalToken;
  });
  let payload;
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: payload.error_code, json: async () => payload }));
  for (const [status, description, unavailable, delay] of [
    [400, 'Bad Request: message is too long', false, null],
    [400, 'Bad Request: chat not found', true, null],
    [403, 'Forbidden: bot was blocked by the user', true, null],
    [403, 'Forbidden: user is deactivated', true, null],
    [403, 'Forbidden: operation is temporarily unavailable', false, null],
    [429, 'Too Many Requests: retry after 180', false, 180],
    [401, 'Unauthorized: private-fixture-token', false, null],
  ]) {
    payload = { ok: false, error_code: status, description, ...(delay ? { parameters: { retry_after: delay } } : {}) };
    await assert.rejects(getTelegramProvider().sendTextMessage({ chatId: '99', body: 'Job alert' }), error => {
      assert.equal(error.chatUnavailable, unavailable, description);
      assert.equal(error.retryAfterSeconds, delay);
      assert.equal(error.statusCode, status);
      assert.doesNotMatch(error.message, /private-fixture-token|Unauthorized:/);
      return true;
    });
  }
});
