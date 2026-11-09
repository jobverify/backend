import '../loadEnv.js';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// Run locally; the existing Gmail credentials never appear in command output.
const relayDir = new URL('../workers/gmail-relay/', import.meta.url);
const secretsFile = new URL('.dev.vars', relayDir);
const previous = fs.existsSync(secretsFile) ? dotenv.parse(fs.readFileSync(secretsFile)) : {};
const user = String(process.env.SMTP_USER ?? '').trim();
const password = String(process.env.SMTP_PASS ?? '').trim();
if (!user || !password) {
  console.error('Set SMTP_USER and SMTP_PASS in the backend .env before preparing the relay.');
  process.exitCode = 1;
} else {
  const values = {
    GMAIL_USER: user,
    GMAIL_APP_PASSWORD: password,
    RELAY_SECRET: previous.RELAY_SECRET?.length >= 32 ? previous.RELAY_SECRET : randomBytes(32).toString('hex'),
  };
  fs.writeFileSync(secretsFile, Object.entries(values).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join('\n') + '\n', { mode: 0o600 });
  console.log(`Prepared ignored local secrets at ${fileURLToPath(secretsFile)}.`);
  console.log('No credentials printed. Existing relay secret is preserved on repeat runs.');
  console.log('Upload with: npx wrangler secret bulk .dev.vars (from workers/gmail-relay).');
}
