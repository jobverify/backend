import test from 'node:test';
import assert from 'node:assert/strict';
import { githubRequest } from '../src/pipeline/github.js';
import { dailyCron, parseSchedule, getScraperSchedule, updateScraperSchedule, intervalSettings, intervalSlot, nextIntervalRun } from '../src/pipeline/schedule.js';

const source = "name: Scraper\non:\n  schedule:\n    - cron: '0 17 * * *' # Daily\n  workflow_dispatch:\n    inputs:\n      pipeline_id:\n        type: string\njobs:\n  scrape:\n    runs-on: ubuntu-latest\n";
const sha = 'a'.repeat(40);
function remote(text = source) {
  const calls = [];
  const request = async (repo, endpoint, options) => {
    calls.push({ repo, endpoint, options });
    if (!endpoint) return { default_branch: 'release/current' };
    if (options?.method === 'PUT') return { content: { sha: 'b'.repeat(40) } };
    return { sha, encoding: 'base64', content: Buffer.from(text).toString('base64') };
  };
  return { calls, request };
}

test('IST daily times round trip including the UTC day boundary', () => {
  for (const [time, cron] of [['22:30', '0 17 * * *'], ['02:08', '38 20 * * *'], ['00:00', '30 18 * * *'], ['05:30', '0 0 * * *'], ['23:59', '29 18 * * *']]) {
    assert.equal(dailyCron(time), cron);
    assert.equal(parseSchedule(source.replace('0 17 * * *', cron)).time, time);
  }
  for (const value of ['24:00', '12:60', '1:30', '', null, 930]) assert.throws(() => dailyCron(value), { status: 400 });
});

test('unfamiliar schedules cannot be silently overwritten', () => {
  for (const text of [source.replace('0 17 * * *', '*/5 * * * *'), source.replace('0 17', '60 17'), source.replace('0 17', '0 24'), source.replace('  workflow_dispatch:', "    - cron: '0 8 * * *'\n  workflow_dispatch:"), source.replace('  workflow_dispatch:', '      timezone: Asia/Kolkata\n  workflow_dispatch:')]) {
    assert.throws(() => parseSchedule(text), { status: 409 });
  }
});

test('11-hour intervals keep their anchor across midnight, months and delayed ticks', () => {
  const schedule = intervalSettings(11, '2026-10-31T17:00:00Z');
  assert.equal(schedule.cron, '0 * * * *');
  assert.equal(intervalSlot(schedule, Date.parse('2026-10-31T16:59:00Z')), null);
  assert.equal(intervalSlot(schedule, Date.parse('2026-10-31T17:00:00Z')), 0);
  assert.equal(intervalSlot(schedule, Date.parse('2026-11-01T03:59:00Z')), 0);
  assert.equal(intervalSlot(schedule, Date.parse('2026-11-01T04:00:00Z')), 1);
  assert.equal(intervalSlot(schedule, Date.parse('2026-11-01T04:47:00Z')), 1);
  assert.equal(nextIntervalRun(schedule, Date.parse('2026-11-01T04:47:00Z')), '2026-11-01T15:00:00.000Z');
  assert.equal(nextIntervalRun(schedule, Date.parse('2026-10-31T16:00:00Z')), schedule.startAt);
  assert.equal(intervalSlot(schedule, Date.parse(schedule.startAt) + 11 * 3600000 * 1000), 1000);
  assert.equal(intervalSettings(11, '2026-10-31T16:38:00Z').cron, '38 * * * *');
  for (const hours of [0, -1, 1.5, 169, '11', null]) assert.throws(() => intervalSettings(hours, schedule.startAt), { status: 400 });
  for (const startAt of ['', '2026-10-31', '2026-02-30T00:00:00Z', '2026-10-31T17:00:01Z', 'invalid', null]) assert.throws(() => intervalSettings(11, startAt), { status: 400 });
});

test('GitHub rejection retains its status and workflow permission guidance', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ message: 'Resource not accessible by personal access token' }, { status: 403 }));
  await assert.rejects(githubRequest('owner/repo', '/contents/.github/workflows/scraper.yml', { token: 'test', method: 'PUT', body: {} }), error =>
    error.githubStatus === 403 && error.githubMessage === 'Resource not accessible by personal access token');
});
