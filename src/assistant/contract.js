export const ASSISTANT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
export const ASSISTANT_LIMITS = Object.freeze({
  messageCharacters: 2000, historyMessages: 10, bodyBytes: 24 * 1024,
  outputTokens: 512, deadlineMs: 30_000,
});

export class AssistantError extends Error {
  constructor(status, code, message, retryAfterSeconds = 0) {
    super(message);
    this.name = 'AssistantError';
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));

export function validateAssistantInput(body, rawBytes) {
  const invalid = () => { throw new AssistantError(400, 'assistant_invalid_input', 'Send a question of 1–2,000 characters and up to ten previous text messages.'); };
  if (!isRecord(body) || Object.keys(body).some(key => !['message', 'history'].includes(key))) invalid();
  const validText = value => typeof value === 'string' && value.trim().length > 0
    && value.length <= ASSISTANT_LIMITS.messageCharacters;
  if (!validText(body.message)) invalid();
  const history = body.history ?? [];
  if (!Array.isArray(history) || history.length > ASSISTANT_LIMITS.historyMessages) invalid();
  for (const entry of history) {
    if (!isRecord(entry) || Object.keys(entry).some(key => !['role', 'content'].includes(key))
      || !['user', 'assistant'].includes(entry.role) || !validText(entry.content)) invalid();
  }
  if ((rawBytes ?? Buffer.byteLength(JSON.stringify(body), 'utf8')) > ASSISTANT_LIMITS.bodyBytes) {
    throw new AssistantError(413, 'assistant_request_too_large', 'This conversation is too long. Clear the chat and try again.');
  }
  return { message: body.message.trim(), history: history.map(({ role, content }) => ({ role, content: content.trim() })) };
}

export function modelFailure(error, now = Date.now()) {
  if (error instanceof AssistantError) return error;
  const code = Number(error?.code) || Number(String(error?.message || '').match(/\b(3036|3040)\b/)?.[1]);
  if (code === 3036) {
    const seconds = Math.max(1, Math.ceil(((Math.floor(now / 86_400_000) + 1) * 86_400_000 - now) / 1000));
    return new AssistantError(429, 'assistant_quota_exhausted', 'The daily AI allowance has been used. Please try again after the daily reset.', seconds);
  }
  if (code === 3040) return new AssistantError(429, 'assistant_busy', 'The assistant is busy. Please try again shortly.', 30);
  return new AssistantError(503, 'assistant_unavailable', 'The assistant is temporarily unavailable. You can still browse jobs or contact support.', 30);
}
