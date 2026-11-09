import assert from 'node:assert/strict'
import test from 'node:test'
import { execFileSync } from 'node:child_process'
import * as lucid from '../../scraper/lucidmotors/script.js'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
const capture = name => JSON.parse(gunzipSync(readFileSync(new URL(`../../scraper/lucidmotors/fixtures/${name}.json.gz`, import.meta.url))))
const native = capture('native-responses').map(p => JSON.parse(p.body))
const responses = [capture('search-response'), ...capture('client-api-responses'), ...capture('native-responses')]
const fixtureFetch = async url => {
  const response = responses.find(row => row.url === url)
  if (!response) throw new Error('Unrecorded unrelated client chunk')
  return { status: response.status, url, text: async () => response.body, json: async () => JSON.parse(response.body) }
}

test('Lucid Motors parses all 445 native roles using office country ancestry', () => {
  const result = lucid.parseNativeInventory(...native)
  assert.equal(result.total, 445)
  assert.deepEqual(result.jobs, [])
})

const synthetic = () => {
  const job = { ...native[0].jobs[0], id: 1, title: 'Engineer', absolute_url: 'https://lucidmotors.com/careers/search/1?gh_jid=1',
    location: { name: 'Bengaluru, Karnataka, India' }, offices: [{ id: 10 }], content: '&lt;p&gt;Build electric vehicles.&lt;/p&gt;' }
  return [{ jobs: [job], meta: { total: 1 } }, { departments: [{ id: 1, jobs: [job], children: [] }] },
    { offices: [{ id: 9, name: 'India', location: 'India', children: [{ id: 10, name: 'Bengaluru', location: job.location.name, children: [] }] }] }]
}

test('Lucid Motors preserves India source content and native dates while retaining missing details', () => {
  const data = synthetic()
  let jobs = lucid.parseNativeInventory(...data).jobs
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].jobDescription, '<p>Build electric vehicles.</p>')
  assert.equal(jobs[0].postingDate, '2026-08-03T17:31:27-04:00')
  data[0].jobs[0].content = '&lt;p&gt;&amp;nbsp;&lt;/p&gt;'
  jobs = lucid.parseNativeInventory(...data).jobs
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].sourceListingComplete, false)
})

test('Lucid Motors rejects incomplete or erroneous data and contradictory geography', () => {
  for (const change of [
    d => { d[0].meta.total = 2 }, d => { d[1].departments[0].jobs = [] },
    d => { delete d[1].departments[0].id },
    d => { d[0].jobs.push(d[0].jobs[0]); d[0].meta.total = 2 },
    d => { d[0].jobs[0].company_name = 'Other' },
    d => { d[0].jobs[0].absolute_url = 'https://other.example/jobs/1' },
    d => { d[0].jobs[0].first_published = '2026-02-31T01:00:00-04:00' },
    d => { d[0].jobs[0].location.name = 'Bengaluru, Canada' },
    d => { d[2].offices[0].name = 'United States' },
    d => { d[0].jobs[0].offices = [{ id: 999 }] },
  ]) { const data = synthetic(); change(data); assert.throws(() => lucid.parseNativeInventory(...data), /Lucid/) }
  for (const flags of [{ error: 'outage' }, { errors: ['outage'] }, { success: false }, { ok: false }, { hasError: true }, { failed: true }, { status: 503 }, { status: 'error' }, { statusCode: 503 }]) {
    assert.throws(() => lucid.parseNativeInventory({ jobs: [], meta: { total: 0 }, ...flags }, { departments: [] }, { offices: [] }), /Lucid/)
  }
})

test('Lucid Motors rejects contradictory country containers at every office depth', () => {
  for (const [parent, child] of [['United States', 'India'], ['India', 'United States']]) {
    const data = synthetic()
    data[0].jobs[0].location.name = 'Office X'
    Object.assign(data[2].offices[0], { name: parent, location: parent })
    Object.assign(data[2].offices[0].children[0], { name: child, location: 'Office X' })
    assert.throws(() => lucid.parseNativeInventory(...data), /contradictory office geography/)
  }
})

test('Lucid Motors refuses changed handoffs, redirected feeds and truncated pages', async () => {
  for (const mode of ['handoff', 'redirect', 'truncate']) {
    await assert.rejects(lucid.run({ fetchImpl: async url => {
      const response = await fixtureFetch(url)
      if (mode === 'redirect' && url === lucid.JOBS_URL) return { ...response, url: 'https://other.example/jobs' }
      if (mode === 'truncate' && url === lucid.SEARCH_URL) return { ...response, text: async () => (await response.text()).replace('</body>', '') }
      if (mode === 'handoff' && url.includes('/_next/')) return { ...response, text: async () => (await response.text()).replaceAll('boards/lucidmotors/departments', 'boards/other/departments') }
      return response
    } }), /Lucid|unclosed/)
  }
})

test('Lucid Motors keeps missing-description India roles with incomplete inventory evidence', async () => {
  const data = synthetic()
  data[0].jobs[0].content = null
  const urls = [lucid.JOBS_URL, lucid.DEPARTMENTS_URL, lucid.OFFICES_URL]
  const jobs = await lucid.run({ fetchImpl: async url => {
    const index = urls.indexOf(url)
    return index < 0 ? fixtureFetch(url) : { status: 200, url, json: async () => data[index] }
  } })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].sourceListingComplete, false)
  assert.equal(readInventoryEvidence(jobs).status, 'discovery-only')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Lucid Motors verifies live official handoff before complete no-India evidence', async () => {
  const jobs = await lucid.run({ fetchImpl: fixtureFetch, now: () => '2026-10-23T04:00:00.000Z' })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 445)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 0)
})

test('Lucid Motors propagates native request failures rather than reporting zero', async () => {
  await assert.rejects(lucid.run({ fetchImpl: async () => { throw new Error('native unavailable') } }), /native unavailable/)
})

test('Lucid Motors honours caller cancellation before network access', async () => {
  const controller = new AbortController()
  controller.abort(new Error('caller cancelled'))
  await assert.rejects(lucid.run({ signal: controller.signal }), /caller cancelled/)
})

test('Lucid Motors bounds uncooperative fetches and bodies and responds to caller abort', () => {
  const moduleUrl = new URL('../../scraper/lucidmotors/script.js', import.meta.url).href
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', `
    import { run } from ${JSON.stringify(moduleUrl)};
    const keepAlive = setInterval(() => {}, 100);
    const never = () => new Promise(() => {});
    const results = [];
    try {
      for (const mode of ['fetch', 'body', 'cancel']) {
        const controller = new AbortController();
        const timer = mode === 'cancel' ? setTimeout(() => controller.abort(new Error('caller cancelled')), 10) : null;
        try {
          await run({ requestTimeoutMs: mode === 'cancel' ? 1000 : 10, signal: controller.signal,
            fetchImpl: mode === 'body' ? async url => ({ status: 200, url, text: never }) : never });
          results.push('unexpected success');
        } catch (error) { results.push(error.message); }
        finally { clearTimeout(timer); }
      }
      console.log(JSON.stringify(results));
    } finally { clearInterval(keepAlive); }
  `], { encoding: 'utf8', timeout: 2000 })
  const results = JSON.parse(output)
  assert.match(results[0], /timeout|deadline/i)
  assert.match(results[1], /timeout|deadline/i)
  assert.match(results[2], /caller cancelled/)
})

test('Lucid Motors rejects unsuccessful official requests', async () => {
  await assert.rejects(lucid.run({ fetchImpl: async url => ({ status: 503, url, text: async () => '' }) }), /HTTP 503/)
})

test('Lucid Motors import with --dry-run has no network or output side effects', () => {
  const moduleUrl = new URL('../../scraper/lucidmotors/script.js', import.meta.url).href
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', `
    import fs from 'node:fs';
    fs.writeFileSync = () => { throw new Error('Unexpected file write'); };
    process.argv.push('--dry-run');
    globalThis.fetch = () => { throw new Error('Unexpected import request'); };
    await import(${JSON.stringify(moduleUrl)});
    console.log('imported');
  `], { encoding: 'utf8', timeout: 5000 })
  assert.equal(output.trim(), 'imported')
})
