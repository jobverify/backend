import assert from 'node:assert/strict'
import test from 'node:test'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { run } from '../../scraper/pixis/script.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const capture = JSON.parse(readFileSync(new URL('../../scraper/pixis/fixtures/careers-response.json', import.meta.url)))
const page = (html = capture.body) => ({ status: 200, url: capture.finalUrl, html })

test('Pixis propagates caller cancellation instead of returning an unobserved empty inventory', async () => {
  const controller = new AbortController()
  controller.abort(new Error('stop Pixis'))
  await assert.rejects(run({ signal: controller.signal }), /stop Pixis/)
})

test('Pixis import has no side effects when a parent process has a dry-run flag', () => {
  const url = new URL('../../scraper/pixis/script.js', import.meta.url).href
  assert.equal(execFileSync(process.execPath, ['--input-type=module', '-e', `
    import fs from 'node:fs';
    fs.writeFileSync = () => { throw Error('Unexpected import write'); };
    globalThis.fetch = () => { throw Error('Unexpected import fetch'); };
    process.argv.push('--dry-run');
    await import(${JSON.stringify(url)});
    console.log('imported');
  `], { encoding: 'utf8', timeout: 10000 }).trim(), 'imported')
})

test('Pixis rejects generic or blocked pages without declaring verified empty', async () => {
  await assert.rejects(run({ fetchPage: async () => ({ status: 200, url: 'https://pixis.ai/careers/', html: '<html><head><title>Pixis</title></head><body>Careers</body></html>' }) }), /Pixis|identity|empty/i)
})

test('Pixis observes its captured first-party explicit empty section before attaching fresh empty evidence', async () => {
  let requests = 0
  const jobs = await run({ fetchPage: async url => { requests++; assert.equal(url, 'https://pixis.ai/careers/'); return page() } })
  assert.equal(requests, 1)
  assert.equal(jobs.length, 0)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'verified-empty')
  assert.equal(evidence.listingComplete, true)
  assert.equal(evidence.reportedTotal, 0)
  assert.equal(evidence.indiaFacetCount, 0)
  assert.equal(evidence.firstParty, true)
  assert.equal(evidence.pagesFetched, 1)
  assert.ok(Date.now() - Date.parse(evidence.verifiedAt) < 5000)
})

test('Pixis refuses changed, inactive or truncated empty sections and new vacancy signals', async () => {
  for (const html of [
    capture.body.replace('There are no vacancies at this time', 'Open positions are loading'),
    capture.body.replace('class="text-block generic-html job-listing__no-jobs-text"', 'hidden class="text-block generic-html job-listing__no-jobs-text"'),
    capture.body.slice(0, capture.body.indexOf('There are no vacancies') + 180),
    capture.body.replace('id="vacancies"', 'id="other"'),
    capture.body.replace('</main>', '<a href="https://jobs.lever.co/pixis/123">Engineer</a></main>'),
    capture.body.replace('</main>', '<script type="application/ld+json">{"@type":"JobPosting","title":"Engineer"}</script></main>'),
    capture.body.replace('</main>', '<iframe src="https://jobs.example.com/pixis"></iframe></main>'),
  ]) await assert.rejects(run({ fetchPage: async () => page(html) }))
})

test('Pixis refuses HTTP failures and redirects to an unverified surface', async () => {
  for (const changed of [{ ...page(), status: 503 }, { ...page(), url: 'https://other.example/careers/' }]) {
    await assert.rejects(run({ fetchPage: async () => changed }))
  }
})

test('Pixis bounds a stalled transport and honours in-flight caller cancellation', async () => {
  await assert.rejects(run({ timeoutMs: 20, fetchPage: () => new Promise(() => {}) }), /timed out/i)
  const controller = new AbortController()
  await assert.rejects(run({ signal: controller.signal, fetchPage: () => {
    queueMicrotask(() => controller.abort(new Error('stop active Pixis')))
    return new Promise(() => {})
  } }), /stop active Pixis/)
})

test('Pixis rejects a native CMS listing error even while cached empty markup remains', async () => {
  const changed = capture.body.replace(/(<script\b[^>]*id="__NUXT_DATA__"[^>]*>)([\s\S]*?)(<\/script>)/, (_match, open, raw, close) => {
    const data = JSON.parse(raw)
    const errors = data[data[data[0]._errors][1]]
    errors['job-listing'] = data.length
    data.push({ message: 'CMS listing unavailable' })
    return open + JSON.stringify(data) + close
  })
  await assert.rejects(run({ fetchPage: async () => page(changed) }), /CMS listing load failed/)
})

test('Pixis default transport sends the bounded cancellation signal to the official source', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://pixis.ai/careers/')
    assert.ok(options.signal instanceof AbortSignal)
    return { status: 200, url, text: async () => capture.body }
  })
  assert.equal(readInventoryEvidence(await run()).status, 'verified-empty')
})

test('Pixis rejects generic newly advertised recruiting handoffs outside its empty section', async () => {
  for (const advertised of [
    '<a href="https://careers.smartrecruiters.com/Pixis">View open jobs</a>',
    '<a href="https://recruit.example.test/company/pixis">Explore opportunities</a>',
    '<a href="https://example.test/opaque" aria-label="Browse open positions">Continue</a>',
    '<a href="/opportunities/">View open roles</a>',
    '<a href="https://careers.example.test/Pixis">Learn more</a>',
    '<button onclick="location.href=\'https://example.test/opaque\'">View open jobs</button>',
    '<form action="https://example.test/apply"><button>Apply now</button></form>',
  ]) {
    const html = capture.body.replace('</main>', advertised + '</main>')
    await assert.rejects(run({ fetchPage: async () => page(html) }), /new.*(?:vacancy|recruit|board|hiring)|handoff/i, advertised)
  }
})
