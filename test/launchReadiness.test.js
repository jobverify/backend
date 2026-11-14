import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const script = fileURLToPath(new URL('../scripts/checkLaunchReadiness.js', import.meta.url));
const privateValue = 'fixture-private-value-that-must-not-be-printed';
function run(t, { backend = {}, frontend = {}, plan = '0.5c-512mb', paid = true, ambient = {} } = {}) {
  const prefix = path.join(tmpdir(), 'jobverify-launch-check-');
  const directory = mkdtempSync(prefix);
  t.after(() => {
    if (!directory.startsWith(prefix)) throw new Error('Invalid test cleanup path');
    rmSync(directory, { recursive: true, force: true });
  });
  const backendEnv = { PAYMENT_PROVIDER: 'razorpay', EMAIL_RELAY_URL: 'https://relay.example.test', EMAIL_RELAY_SECRET: privateValue,
    SMTP_USER: 'jobverify.in@gmail.com', SMTP_FROM: 'Jobverify <jobverify.in@gmail.com>',
    SENTRY_DSN: 'https://public@o0.ingest.sentry.io/123',
    RAZORPAY_KEY_ID: 'rzp_live_Fixture123', RAZORPAY_KEY_SECRET: privateValue,
    RAZORPAY_WEBHOOK_SECRET: privateValue, ...backend };
  const frontendEnv = { VITE_SENTRY_DSN: 'https://public@o0.ingest.sentry.io/456', ...frontend };
  const backendPath = path.join(directory, 'backend.env');
  const frontendPath = path.join(directory, 'frontend.env');
  const renderPath = path.join(directory, 'render.yaml');
  const serialize = env => Object.entries(env).map(([key, value]) => key + '=' + value).join('\n') + '\n';
  writeFileSync(backendPath, serialize(backendEnv));
  writeFileSync(frontendPath, serialize(frontendEnv));
  writeFileSync(renderPath, 'services:\n  - type: web\n    name: jobverify-backend\n    runtime: node\n    plan: ' + plan + '\n    autoDeployTrigger: off\n');
  const args = [script, '--json', '--backend-env', backendPath, '--frontend-env', frontendPath, '--render-config', renderPath];
  if (paid) args.push('--paid');
  const result = spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 15000,
    env: { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(?:SENTRY|VITE_SENTRY|SMTP_|EMAIL_RELAY|PAYMENT_PROVIDER|RAZORPAY)/.test(key))), ...ambient } });
  return { ...result, report: result.stdout ? JSON.parse(result.stdout) : null };
}

test('launch check accepts configured live services while retaining explicit manual release checks', t => {
  const result = run(t);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.report.checks.filter(check => check.status === 'pass').length >= 5);
  assert.equal(result.report.checks.find(check => check.id === 'production-payments').status, 'pass');
  assert.ok(result.report.manualChecks.some(check => check.id === 'restore-drill'));
  assert.ok(!result.stdout.includes(privateValue));
});

test('launch check refuses sandbox keys for a paid launch without disclosing credentials', t => {
  const result = run(t, { backend: { RAZORPAY_KEY_ID: 'rzp_test_Fixture123' } });
  assert.equal(result.status, 1);
  assert.equal(result.report.checks.find(check => check.id === 'production-payments').status, 'fail');
  assert.ok(!result.stdout.includes(privateValue));
});

test('a free launch keeps paid configuration explicitly pending instead of requiring test keys to be replaced locally', t => {
  const result = run(t, { paid: false, backend: { RAZORPAY_KEY_ID: 'rzp_test_Fixture123', RAZORPAY_WEBHOOK_SECRET: '' } });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.report.manualChecks.some(check => check.id === 'production-payments'));
});

test('launch check rejects missing monitoring rather than treating installed SDKs as operational', t => {
  const result = run(t, { backend: { SENTRY_DSN: '' }, frontend: { VITE_SENTRY_DSN: '' } });
  assert.equal(result.status, 1);
  for (const id of ['server-monitoring', 'browser-monitoring']) {
    assert.equal(result.report.checks.find(check => check.id === id).status, 'fail');
  }
});

test('a configured but invalid mail relay cannot pass through an SMTP fallback', t => {
  const result = run(t, { backend: { EMAIL_RELAY_URL: 'https://private:secret@relay.test/extra' } });
  assert.equal(result.status, 1);
  assert.equal(result.report.checks.find(check => check.id === 'account-email').status, 'fail');
  assert.ok(!result.stdout.includes('private:secret'));
});

test('launch check catches a sleeping deployment plan', t => {
  const result = run(t, { plan: 'free' });
  assert.equal(result.status, 1);
  assert.equal(result.report.checks.find(check => check.id === 'render-blueprint').status, 'fail');
});

test('a paid launch refuses a mock payment provider even when live-shaped keys are present', t => {
  const result = run(t, { backend: { PAYMENT_PROVIDER: 'mock' } });
  assert.equal(result.status, 1);
  assert.equal(result.report.checks.find(check => check.id === 'production-payments').status, 'fail');
});


test('explicit deployment exports cannot borrow missing monitoring or live keys from the shell', t => {
  const result = run(t, {
    backend: { SENTRY_DSN: '', RAZORPAY_KEY_ID: 'rzp_test_Export123' },
    frontend: { VITE_SENTRY_DSN: '' },
    ambient: { SENTRY_DSN: 'https://public@o0.ingest.sentry.io/123',
      VITE_SENTRY_DSN: 'https://public@o0.ingest.sentry.io/456', RAZORPAY_KEY_ID: 'rzp_live_Shell123' },
  });
  assert.equal(result.status, 1);
  for (const id of ['server-monitoring', 'browser-monitoring', 'production-payments']) {
    assert.equal(result.report.checks.find(check => check.id === id).status, 'fail');
  }
  assert.ok(!result.stdout.includes(privateValue));
});
