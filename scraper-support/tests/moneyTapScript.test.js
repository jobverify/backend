import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { run, OFFICIAL_ATS_URL } from '../../scraper/moneytap/script.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const capture = JSON.parse(readFileSync(new URL('../../scraper/moneytap/fixtures/careers-response.json', import.meta.url)))
const page = extra => ({ status: capture.status, url: capture.finalUrl, html: capture.body, ...extra })
const replay = (extra, options = {}) => run({ fetchPage: async () => page(extra), ...options })

test('MoneyTap observes the captured closed branded native empty section on every run', async () => {
  let calls = 0
  const jobs = await run({ fetchPage: async (url, options) => {
    calls++; assert.equal(url, OFFICIAL_ATS_URL); assert.ok(options.signal)
    return page()
  }, now: () => '2026-10-23T04:00:00.000Z' })
  assert.equal(calls, 1)
  assert.equal(jobs.length, 0)
  assert.deepEqual(readInventoryEvidence(jobs), { status: 'verified-empty', surface: OFFICIAL_ATS_URL,
    firstParty: true, listingComplete: true, pagesFetched: 1, reportedTotal: 0, indiaFacetCount: 0,
    verifiedAt: '2026-10-23T04:00:00.000Z', reason: 'official-jobsoid-board-explicit-current-no-openings' })
})

test('MoneyTap rejects failed HTTP, changed identity and unverified redirects', async () => {
  for (const extra of [{ status: 503 }, { url: 'https://other.jobsoid.com/' }, { url: OFFICIAL_ATS_URL + '?filter=none' },
    { html: capture.body.replaceAll('moneytap', 'other-company') }]) await assert.rejects(replay(extra), /MoneyTap/)
  await assert.rejects(run({ fetchPage: async () => { throw Error('upstream offline') } }), /upstream offline/)
})

test('MoneyTap does not certify truncated, hidden, duplicated or nonempty listing sections', async () => {
  for (const html of [capture.body.replace('</html>', ''), capture.body.replace('</body>', ''),
    capture.body.replace('id="sectionContainer"', 'hidden id="sectionContainer"'),
    capture.body.replace('No Current Openings', 'New openings coming soon'),
    capture.body.replace('</body>', '<section id="sectionContainer" class="current-openings"><h2>Current Openings</h2><h3>No Current Openings</h3></section></body>')]) {
    await assert.rejects(replay({ html }), /MoneyTap|unclosed/)
  }
})

test('MoneyTap new native roles or arbitrary recruiting handoffs cannot retain old empty proof', async () => {
  for (const markup of ['<a href="/j/123/software-engineer">Engineer</a>',
    '<a href="https://careers.smartrecruiters.com/MoneyTap">View open jobs</a>',
    '<a href="https://www.jobsoid.com/company/moneytap-1/">View open jobs</a>',
    '<a href="https://unknown.example/x" aria-label="Open roles">Continue</a>',
    '<form action="https://unknown.example/x"><input type="submit" value="View open jobs"></form>',
    '<form action="https://unknown.example/x"><input type="image" alt="View open jobs" src="jobs.png"></form>',
    '<button data-url="/opportunities">View vacancies</button>',
    '<script type="application/ld+json">{"@type":"JobPosting","title":"Engineer"}</script>',
    '<iframe src="https://unknown.example/board"></iframe>']) {
    await assert.rejects(replay({ html: capture.body.replace('</body>', markup + '</body>') }), /MoneyTap/)
  }
})

test('MoneyTap does not certify empty text hidden by content-visibility on a listing or ancestor', async () => {
  for (const html of [capture.body.replace('id="sectionContainer"', 'style="content-visibility:hidden" id="sectionContainer"'),
    capture.body.replace('id="list"', 'style="content-visibility: hidden !important" id="list"')]) {
    await assert.rejects(replay({ html }), /MoneyTap/)
  }
})

test('MoneyTap honors pre-abort without observing the source', async () => {
  const controller = new AbortController(); controller.abort(Error('cancel MoneyTap'))
  await assert.rejects(run({ signal: controller.signal, fetchPage: async () => assert.fail('must not fetch') }), /cancel MoneyTap/)
})

test('MoneyTap bounds ignored-signal transports and body reads and responds to caller abort', async () => {
  await assert.rejects(run({ timeoutMs: 15, fetchPage: () => new Promise(() => {}) }), /timed out/)
  await assert.rejects(run({ timeoutMs: 15, fetchImpl: async () => ({ status: 200, url: OFFICIAL_ATS_URL, text: () => new Promise(() => {}) }) }), /timed out/)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(Error('caller stop')), 15)
  try { await assert.rejects(run({ signal: controller.signal, fetchPage: () => new Promise(() => {}) }), /caller stop/) }
  finally { clearTimeout(timer) }
})

test('MoneyTap validates request budgets', async () => {
  for (const timeoutMs of [0, -1, Infinity, 1.5, 300001]) await assert.rejects(replay({}, { timeoutMs }), /MoneyTap/)
})

test('MoneyTap import with a parent dry-run flag performs no network or persistence', () => {
  const url = new URL('../../scraper/moneytap/script.js', import.meta.url).href
  assert.equal(execFileSync(process.execPath, ['--input-type=module', '-e', `
    import fs from 'node:fs';
    fs.writeFileSync = () => { throw Error('unexpected write'); };
    globalThis.fetch = () => { throw Error('unexpected request'); };
    process.argv.push('--dry-run'); await import(${JSON.stringify(url)}); console.log('imported');
  `], { encoding: 'utf8', timeout: 3000 }).trim(), 'imported')
})
