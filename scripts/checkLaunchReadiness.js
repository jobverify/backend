import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const paidPlans = new Set(['0.5c-512mb', '1c-2g', '2c-4g', '2c-8g', '2c-16g', '4c-8g', '4c-16g', '4c-32g', '8c-16g', '8c-32g', '8c-64g', '12c-24g', '12c-48g', '12c-96g']);
const text = value => String(value ?? '').trim();
function httpsOrigin(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password
      && url.pathname === '/' && !url.search && !url.hash;
  } catch { return false; }
}
function sentryDsn(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.username) && !url.password
      && /^\/[0-9]+$/.test(url.pathname) && !url.search && !url.hash;
  } catch { return false; }
}

export function assessLaunchReadiness({ backend = {}, frontend = {}, render = '', paid = false } = {}) {
  const checks = [];
  const add = (id, passes, message) => checks.push({ id, status: passes ? 'pass' : 'fail', message });
  const plan = render.match(/^\s+plan:\s*["']?([A-Za-z0-9.-]+)["']?\s*(?:#.*)?$/m)?.[1];
  add('render-blueprint', paidPlans.has(plan), 'The Render blueprint must select a documented paid compute plan; confirm the actual service plan before launch.');
  const relay = text(backend.EMAIL_RELAY_URL);
  const smtpPort = Number(text(backend.SMTP_PORT));
  const sender = text(backend.SMTP_FROM).match(/<([^<>]+)>$/)?.[1] || text(backend.SMTP_FROM);
  const gmail = text(backend.SMTP_USER).toLowerCase() === 'jobverify.in@gmail.com'
    && sender.toLowerCase() === 'jobverify.in@gmail.com';
  const delivery = relay
    ? httpsOrigin(relay) && text(backend.EMAIL_RELAY_SECRET).length >= 32
    : text(backend.SMTP_HOST).toLowerCase() === 'smtp.gmail.com'
      && [465, 587].includes(smtpPort) && Boolean(text(backend.SMTP_PASS))
      && (text(backend.SMTP_SECURE).toLowerCase() === 'true') === (smtpPort === 465);
  add('account-email', Boolean(gmail && delivery), 'Configure Gmail sender jobverify.in@gmail.com and either the authenticated HTTPS relay or matching Gmail SMTP/TLS settings. A configured relay never falls back to SMTP.');
  add('server-monitoring', sentryDsn(backend.SENTRY_DSN), 'Set a valid server SENTRY_DSN. An installed SDK without a project DSN does not deliver errors.');
  add('browser-monitoring', sentryDsn(frontend.VITE_SENTRY_DSN), 'Set a valid public VITE_SENTRY_DSN; browser capture also requires analytics consent.');
  if (paid) {
    add('production-payments', text(backend.PAYMENT_PROVIDER).toLowerCase() === 'razorpay'
      && /^rzp_live_[A-Za-z0-9]+$/.test(backend.RAZORPAY_KEY_ID || '')
      && Boolean(text(backend.RAZORPAY_KEY_SECRET)) && Boolean(text(backend.RAZORPAY_WEBHOOK_SECRET)),
    'A paid launch requires live Razorpay keys and a nonempty webhook secret; keep billing disabled until live purchase and refund verification.');
  }
  const manualChecks = [
    { id: 'gmail-delivery', action: 'Deploy the updated Gmail Worker before the API. Test signup, resend, reset and email change in fresh Gmail/Outlook inboxes, including received authentication headers.' },
    { id: 'monitoring-delivery', action: 'Configure alert destinations and verify one scrubbed staging browser error, server error and alert delivery. Check source-map resolution and consent withdrawal.' },
    { id: 'restore-drill', action: 'Configure the protected backups environment, run the full encrypted backup/restore workflow, inspect restored account/resume/payment records and verify backup-failure notifications.' },
    { id: 'provider-budgets', action: 'Verify enforced budgets/quotas and billing notifications in the active GitHub Actions, hosting, Cloudflare and optional Anthropic/SerpApi accounts. Check prepaid balance and expiry when used.' },
    { id: 'release-recovery', action: 'Review paid compute pricing and actual hosting tiers, then rehearse preview promotion, backend/frontend rollback and an old open browser tab.' },
    { id: 'human-beta', action: 'Complete a human beta of signup, discovery, saved jobs, resumes, recovery and deletion with issue/retest records.' },
  ];
  if (!paid) manualChecks.unshift({ id: 'production-payments', action: 'This check assumes a free launch. Confirm live /api/site-settings has billingEnabled=false; rerun with --paid before enabling checkout.' });
  return { scope: 'Configuration check only: no provider dashboards, messages, purchases, databases or hosted settings are accessed.', checks, manualChecks };
}

function loadEnvironment(file, required) {
  if (fs.existsSync(file)) return dotenv.parse(fs.readFileSync(file));
  if (required) throw new Error('Configuration file unavailable');
  return {};
}

function main() {
  const options = { backend: path.join(root, '.env'), frontend: path.resolve(root, '../jobverify-frontend/.env'),
    render: path.join(root, 'render.yaml'), paid: false, json: false };
  const paths = new Set(['--backend-env', '--frontend-env', '--render-config']);
  const supplied = new Set();
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === '--json') options.json = true;
    else if (flag === '--paid') options.paid = true;
    else if (paths.has(flag) && args[i + 1] && !args[i + 1].startsWith('--')) {
      const name = { '--backend-env': 'backend', '--frontend-env': 'frontend', '--render-config': 'render' }[flag];
      options[name] = path.resolve(args[++i]);
      supplied.add(name);
    } else throw new Error('Unsupported launch check option');
  }
  const environment = name => {
    const values = loadEnvironment(options[name], supplied.has(name));
    return supplied.has(name) ? values : { ...values, ...process.env };
  };
  const report = assessLaunchReadiness({
    backend: environment('backend'),
    frontend: environment('frontend'),
    render: fs.readFileSync(options.render, 'utf8'), paid: options.paid,
  });
  if (options.json) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(report.scope);
    for (const check of report.checks) console.log(check.status.toUpperCase() + ' ' + check.id + ': ' + check.message);
    for (const check of report.manualChecks) console.log('MANUAL ' + check.id + ': ' + check.action);
  }
  process.exitCode = report.checks.some(check => check.status === 'fail') ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); }
  catch {
    console.error('Unable to read launch configuration. Check option names, file paths and permissions; no configuration values were printed.');
    process.exitCode = 2;
  }
}
