/**
 * @file Telegram Bot API provider abstraction for alert delivery.
 * @module services/telegramProvider
 */

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

export const isTelegramDeliveryEnabled = () =>
  TRUE_VALUES.has(String(process.env.TELEGRAM_ENABLED || "false").trim().toLowerCase());

const createTelegramProvider = () => ({
  name: "telegram",
  async sendTextMessage({ chatId, body, signal }) {
    if (!isTelegramDeliveryEnabled()) {
      throw new Error("Telegram delivery is disabled.");
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      throw new Error("Telegram bot credentials are not configured.");
    }

    let response;
    try {
      response = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: body,
            disable_web_page_preview: true,
          }),
          signal,
        },
      );
    } catch {
      throw new Error("Telegram send failed.");
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.ok !== true || data?.result?.message_id === undefined) {
      const statusCode = Number.isInteger(data?.error_code) ? data.error_code : response.status;
      const description = String(data?.description || '').toLowerCase();
      // A 400 can mean our message is malformed, not that the user disconnected.
      // Classify only known recipient failures; never log Telegram's raw response.
      const chatUnavailable = [400, 403].includes(statusCode)
        && /chat not found|bot was blocked by the user|user is deactivated|bot can'?t initiate conversation with a user/.test(description);
      const retryAfter = data?.parameters?.retry_after;
      throw Object.assign(new Error("Telegram send failed."), {
        statusCode, chatUnavailable,
        retryAfterSeconds: statusCode === 429 && Number.isSafeInteger(retryAfter) && retryAfter > 0 ? retryAfter : null,
        code: chatUnavailable ? 'telegram_chat_unavailable' : statusCode === 429 ? 'telegram_rate_limited'
          : statusCode === 400 && description.includes('message is too long') ? 'telegram_message_too_long' : 'telegram_send_failed',
      });
    }

    return {
      providerName: "telegram",
      providerMessageId: String(data.result.message_id),
    };
  },
});

export const getTelegramProvider = () => createTelegramProvider();
