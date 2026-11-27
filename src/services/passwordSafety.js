import { createHash } from 'node:crypto';
import { isStrongPassword, PASSWORD_POLICY_MESSAGE } from '../utils/authSecurity.js';

const MAX_RANGE_BYTES = 128 * 1024;
const unavailable = () => new PasswordSafetyError('password_check_unavailable', 503,
  'Password safety verification is temporarily unavailable. Please try again.');

export class PasswordSafetyError extends Error {
  constructor(code, statusCode, message) {
    super(message);
    this.name = 'PasswordSafetyError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function createPasswordSafety({ fetchImpl = (...args) => globalThis.fetch(...args), timeoutMs = 5000 } = {}) {
  return {
    async check(password) {
      if (!isStrongPassword(password)) throw new PasswordSafetyError('password_invalid', 400, PASSWORD_POLICY_MESSAGE);
      const controller = new AbortController();
      let timer;
      const deadline = new Promise((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(unavailable()); }, timeoutMs);
      });
      try {
        await Promise.race([deadline, (async () => {
          // SHA-1 is only the range-query protocol; stored passwords still use bcrypt.
          const hash = createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
          const response = await fetchImpl('https://api.pwnedpasswords.com/range/' + hash.slice(0, 5), {
            headers: { Accept: 'text/plain', 'Add-Padding': 'true', 'User-Agent': 'Jobverify password screening' },
            // Workers rejects redirect: 'error'. Manual prevents following a
            // redirect, and the response.ok check below rejects its 3xx status.
            redirect: 'manual', cache: 'no-store', signal: controller.signal,
          });
          controller.signal.throwIfAborted();
          if (!response.ok || !response.body || Number(response.headers.get('content-length')) > MAX_RANGE_BYTES) throw unavailable();
          const reader = response.body.getReader();
          const cancel = () => { void reader.cancel().catch(() => {}); };
          controller.signal.addEventListener('abort', cancel, { once: true });
          const chunks = [];
          let size = 0;
          try {
            while (true) {
              const { done, value } = await reader.read();
              controller.signal.throwIfAborted();
              if (done) break;
              size += value.byteLength;
              if (size > MAX_RANGE_BYTES) {
                await reader.cancel();
                throw unavailable();
              }
              chunks.push(value);
            }
          } finally {
            controller.signal.removeEventListener('abort', cancel);
            reader.releaseLock();
          }
          const text = Buffer.concat(chunks).toString('utf8').trim();
          if (!text) throw unavailable();
          let compromised = false;
          for (const line of text.split(/\r?\n/)) {
            const match = /^([a-f0-9]{35}):(\d+)$/i.exec(line);
            if (!match || !Number.isSafeInteger(Number(match[2]))) throw unavailable();
            if (match[1].toUpperCase() === hash.slice(5) && Number(match[2]) > 0) compromised = true;
          }
          if (compromised) throw new PasswordSafetyError('password_compromised', 400,
            'This password has appeared in a data breach. Choose a different password.');
        })()]);
      } catch (error) {
        // Provider diagnostics can contain request data. Never forward or log them.
        throw error instanceof PasswordSafetyError ? error : unavailable();
      } finally {
        clearTimeout(timer);
        controller.abort();
      }
    },
  };
}

export const passwordSafety = createPasswordSafety();
