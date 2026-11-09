import fs from 'node:fs';
import dotenv from 'dotenv';

try {
  const origin = new URL(process.argv[2]);
  if (origin.protocol !== 'https:' || origin.username || origin.password
    || origin.search || origin.hash || origin.pathname !== '/') throw new Error('Invalid Worker origin.');
  const localSecrets = dotenv.parse(fs.readFileSync(new URL('../workers/gmail-relay/.dev.vars', import.meta.url)));
  if (localSecrets.RELAY_SECRET?.length < 32 || !localSecrets.RELAY_SECRET) throw new Error('Local relay secret is missing.');
  const response = await fetch(new URL('/verify-smtp', origin), {
    method: 'POST', redirect: 'error',
    headers: { Authorization: `Bearer ${localSecrets.RELAY_SECRET}` },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok || (await response.json()).success !== true) {
    console.error(`Worker SMTP check failed (HTTP ${response.status}). Check Worker logs for the safe error code.`);
    process.exitCode = 1;
  } else console.log('Gmail authentication from the deployed Worker succeeded. No email was sent.');
} catch {
  console.error('Unable to verify the relay. Supply its HTTPS origin, prepare local secrets, and check network access.');
  process.exitCode = 1;
}
