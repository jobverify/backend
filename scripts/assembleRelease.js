import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SOURCE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DIRECTORIES = {
  backend: new Set(['src', 'db', 'scripts', 'scraper', 'scraper-support', 'workers', 'docs',
    'classification', 'rewriting', 'resume-tailoring']),
  frontend: new Set(['src', 'public', 'server', 'api', 'scripts', 'extensions']),
};
const FILES = new Set(['package.json', 'package-lock.json', 'server.js', 'loadEnv.js',
  'index.html', 'vite.config.js', 'eslint.config.js', 'jsconfig.json', 'components.json',
  'render.yaml', 'vercel.json', 'README.md', 'LICENSE', '.env.example']);
const OMIT = new Set(['node_modules', '.git', '.cache', '.secrets', '.codex', 'fixtures', 'tests', 'test',
  'reports', 'coverage', 'playwright-report', 'test-results', 'dist', '.venv', 'venv', '__pycache__']);
const SECRET_FILE = /(?:^|\/)(?:\.env(?:\..*)?|(?:backend|frontend)\.env|client_secret[^/]*\.json|credentials[^/]*\.json|[^/]+\.(?:pem|key|p12|pfx))$/i;
const RULES = [
  ['authenticated_database_uri', /mongodb(?:\+srv)?:\/\/[^\s/@:'"<>]+:[^\s/@'"<>]+@/i],
  ['github_token', /\b(?:github_pat_[a-z\d_]{40,}|gh[pousr]_[a-z\d]{30,})\b/i],
  ['telegram_token', /\b\d{7,12}:[a-z\d_-]{30,}\b/i],
  ['oauth_client_secret', /["']client_secret["']\s*:\s*["'][^"'\s]{6,}["']/i],
  ['private_key', /-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/],
];
const SECRET_SETTING = /^(?:MONGO_URI|JWT_SECRET|GITHUB_PAT|SMTP_PASS|EMAIL_RELAY_SECRET|RAZORPAY_KEY_SECRET|TELEGRAM_BOT_TOKEN|TELEGRAM_WEBHOOK_SECRET|TURNSTILE_SECRET_KEY|GOOGLE_CLIENT_SECRET)$/i;
const isExample = name => /(?:^|\/)\.env\.example$|\.env\.example$/i.test(name);

// Return only path/rule metadata. Never put matched values into diagnostics.
export const inspectRelease = async directory => {
  const findings = [];
  const walk = async (current, prefix = '') => {
    for (const entry of await fs.readdir(current, { withFileTypes: true })) {
      const relative = `${prefix}${entry.name}`;
      const file = path.join(current, entry.name);
      if (entry.isSymbolicLink()) { findings.push({ path: relative, rule: 'symbolic_link' }); continue; }
      if (entry.isDirectory()) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') findings.push({ path: relative, rule: 'private_directory' });
        else await walk(file, `${relative}/`);
        continue;
      }
      if (SECRET_FILE.test(relative) && !isExample(relative)) findings.push({ path: relative, rule: 'credential_file' });
      if (!/\.(?:js|jsx|mjs|cjs|ts|tsx|json|html|css|svg|xml|webmanifest|py|sh|ps1|yml|yaml|toml|md|txt|csv|example|env)$/i.test(entry.name)) continue;
      const text = await fs.readFile(file, 'utf8');
      for (const [rule, pattern] of RULES) if (pattern.test(text)) findings.push({ path: relative, rule });
      if (isExample(relative)) for (const line of text.split(/\r?\n/)) {
        const assignment = /^\s*([A-Z_][A-Z_\d]*)\s*=\s*(.*)$/i.exec(line);
        if (assignment && SECRET_SETTING.test(assignment[1]) && assignment[2].trim()) findings.push({ path: relative, rule: 'populated_secret_template' });
      }
    }
  };
  await walk(path.resolve(directory));
  return findings;
};

export const assembleRelease = async ({ destination, projects } = {}) => {
  const output = path.resolve(destination);
  if (!Array.isArray(projects) || projects.length === 0) throw new Error('Specify at least one release project');
  // Exclusive creation protects existing releases and prevents recursive copies.
  const canonicalOutput = path.join(await fs.realpath(path.dirname(output)), path.basename(output));
  const contains = (parent, child) => {
    const relative = path.relative(parent, child);
    return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
  };
  for (const { source } of projects) {
    const resolved = await fs.realpath(source);
    if (contains(resolved, canonicalOutput) || contains(canonicalOutput, resolved)) {
      throw new Error('Output must be outside every source checkout');
    }
  }
  await fs.mkdir(output, { recursive: false });
  const copy = async (source, target, relative) => {
    const stat = await fs.lstat(source);
    if (stat.isSymbolicLink()) throw new Error('Release source contains a symbolic link');
    const name = path.basename(source);
    if (stat.isDirectory()) {
      if (OMIT.has(name) || name.startsWith('.')) return;
      await fs.mkdir(target, { recursive: true });
      const entries = await fs.readdir(source);
      for (let offset = 0; offset < entries.length; offset += 16) {
        await Promise.all(entries.slice(offset, offset + 16).map(entry =>
          copy(path.join(source, entry), path.join(target, entry), `${relative}/${entry}`)));
      }
    } else {
      if ((SECRET_FILE.test(relative) && !isExample(relative)) || /(?:^|\/)(?:jobs[^/]*\.json|debug\.log)$|\.(?:test|spec)\.[cm]?jsx?$/i.test(relative)) return;
      if (!/\.(?:js|jsx|mjs|cjs|ts|tsx|json|html|css|xml|webmanifest|py|sh|ps1|svg|png|jpg|jpeg|webp|ico|woff2?|ttf|txt|csv|md|ya?ml|toml|example)$/i.test(name) && name !== 'LICENSE') return;
      await fs.copyFile(source, target);
    }
  };
  for (const { source, kind, name } of projects) {
    if (!DIRECTORIES[kind] || !/^[a-z\d-]+$/i.test(name)) throw new Error('Invalid release project');
    for (const entry of await fs.readdir(source, { withFileTypes: true })) {
      if ((entry.isDirectory() && DIRECTORIES[kind].has(entry.name)) || (entry.isFile() && FILES.has(entry.name))) {
        await fs.mkdir(path.join(output, name), { recursive: true });
        await copy(path.join(source, entry.name), path.join(output, name, entry.name), entry.name);
      }
    }
  }
  const findings = await inspectRelease(output);
  if (findings.length) throw new Error(`Release credential gate failed: ${JSON.stringify(findings)}`);
  return output;
};

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const args = process.argv.slice(2);
  const value = flag => args[args.indexOf(flag) + 1];
  try {
    if (!args.includes('--output') || !value('--output')) throw new Error('Specify a new --output directory');
    const projects = args.includes('--project-root')
      ? [{ source: path.resolve(value('--project-root')), kind: value('--kind'), name: value('--kind') }]
      : [{ source: path.join(SOURCE_ROOT, 'backend'), kind: 'backend', name: 'backend' },
        { source: path.join(SOURCE_ROOT, 'jobverify-frontend'), kind: 'frontend', name: 'jobverify-frontend' }];
    const output = await assembleRelease({ destination: value('--output'), projects });
    console.log(`Credential-gated release assembled: ${output}`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
