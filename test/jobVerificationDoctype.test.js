import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import test from 'node:test';
import { readJobPage } from '../src/jobVerification/content.js';

const url = 'https://employer.example/jobs/123';

test('doctype removal preserves vacancy content and Unicode offsets', () => {
  const page = readJobPage('\u0130<!DoCtYpE html><title>Engineer</title><!DOCTYPE html><h1>Engineer</h1><p>Build services.</p>', url);
  assert.equal(page.title, 'Engineer');
  assert.match(page.text, /Build services\./);
});

test('an unterminated doctype rejects the page instead of interpreting the remainder', () => {
  const page = readJobPage('<title>Untrusted role</title><!DOCTYPE html', url);
  assert.equal(page.title, '');
  assert.equal(page.text, '');
  assert.deepEqual(page.links, []);
});

test('repeated unterminated doctypes finish within an isolated process deadline', { timeout: 10_000 }, async () => {
  const moduleUrl = new URL('../src/jobVerification/content.js', import.meta.url).href;
  const script = `
    import { readJobPage } from ${JSON.stringify(moduleUrl)};
    const page = readJobPage('<!DoCtYpE'.repeat(200_000), 'https://employer.example/jobs/123');
    process.stdout.write(JSON.stringify({ title: page.title, text: page.text, links: page.links }));
  `;
  const { stdout } = await promisify(execFile)(process.execPath, ['--input-type=module', '--eval', script], {
    timeout: 5_000,
    maxBuffer: 4096,
    windowsHide: true,
  });
  assert.deepEqual(JSON.parse(stdout), { title: '', text: '', links: [] });
});
