import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { run } from './script.js'
import { activeScripts } from '../../scraper-support/utils/activeNativeHtml.js'
import { decodeJavaScriptStringLiteral } from '../../scraper-support/utils/safeLiteral.js'
import { spawnSync } from 'node:child_process'

const capture = name => JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/' + name + '-response.json.gz', import.meta.url))))
const replay = overrides => async url => {
  const name = url.includes('/recruit/v2/') ? 'native' : url.includes('/jobs/Careers/') ? 'detail' : url.includes('zohorecruit') ? 'board' : 'official'
  const saved = capture(name)
  return { status: saved.status, url: saved.finalUrl, text: async () => overrides?.[name] ?? saved.body }
}
const mutateApi = transform => {
  const data = JSON.parse(capture('native').body)
  transform(data)
  return JSON.stringify(data)
}
const mutateDetail = transform => {
  const body = capture('detail').body
  const expression = /\bvar jobs\s*=\s*JSON\.parse\(('(?:\\.|[^'\\])*')\)\s*;/g
  const match = activeScripts(body).flatMap(script => [...script.matchAll(expression)])[0]
  const rows = JSON.parse(decodeJavaScriptStringLiteral(match[1]))
  transform(rows[0])
  const literal = JSON.stringify(rows).replaceAll('<', '\\u003c').replaceAll('\\', '\\\\').replaceAll("'", "\\'")
  return body.replace(match[0], () => "var jobs = JSON.parse('" + literal + "');")
}

test('Jungleworks replays the actual official Zoho inventory and role detail', async () => {
  const jobs = await run({ fetchImpl: replay(), now: () => '2026-10-23T04:30:00.000Z' })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, '69660000013757052')
  assert.equal(jobs[0].title, 'B2B Sales Trainee')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].company, 'Jungleworks')
  assert.equal(jobs[0].postingDate, null)
  assert.equal(jobs[0].nativeDateOpened, '2026-10-06')
  assert.equal(jobs[0].state, 'Punjab')
  assert.match(jobs[0].jobDescription, /Qualify leads, schedule demos/i)
  assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 1)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
})

for (const [name, transform, pattern] of [
  ['unknown country', p => { p.data[0].Country = 'Unspecified' }, /country scope/],
  ['secondary country scope', p => { p.data[0].SecondaryLocations = [{ Country: 'India' }] }, /secondary/],
  ['duplicate job identity', p => { p.data.push(p.data[0]) }, /duplicate/],
  ['truncated inventory', p => { p.data = [] }, /inventory mismatch/],
  ['pagination continuation', p => { p.info.more_records = true }, /pagination/],
  ['wrong native URL', p => { p.data[0].$url = 'https://elsewhere.example/job' }, /URL identity/],
  ['contradictory India state', p => { p.data[0].State = 'CA'; p.data[0].City = 'Bengaluru' }, /state/],
  ['contradictory primary location country', p => { p.data[0].City = 'Toronto, Canada' }, /geograph/],
  ['unknown location field', p => { p.data[0].Location = 'Worldwide' }, /geograph/],
  ['secondary country field', p => { p.data[0].SecondaryCountry = 'United States' }, /geograph/],
  ['top-level continuation', p => { p.more_records = true }, /pagination/],
  ['info continuation', p => { p.info.hasMore = true }, /pagination/],
]) test('Jungleworks rejects ' + name, async () => {
  await assert.rejects(run({ fetchImpl: replay({ native: mutateApi(transform) }) }), pattern)
})

for (const description of [null, '<script>Employer description</script>', '<template>Employer description</template>', '<h2>Responsibilities</h2>', '<strong>Job Responsibilities</strong>', '<div hidden>Employer description</div>', '<div inert>Develop software and support enterprise customers.</div>', '<div style="content-visibility:hidden">Develop software and support enterprise customers.</div>']) {
  test('Jungleworks retains missing/inert/heading-only JD as partial: ' + String(description), async () => {
    const jobs = await run({ fetchImpl: replay({ detail: mutateDetail(row => { row.Job_Description = description }) }) })
    assert.equal(jobs.length, 1)
    assert.equal(jobs[0].jobDescription, null)
    assert.equal(jobs[0].sourceDetailComplete, false)
    assert.equal(readInventoryEvidence(jobs).status, 'discovery-only')
  })
}

test('Jungleworks rejects detail job identity or geography drift', async () => {
  await assert.rejects(run({ fetchImpl: replay({ detail: mutateDetail(row => { row.Country = 'United States' }) }) }), /identity or country/)
})
test('Jungleworks rejects newly added native detail secondary country scope', async () => {
  await assert.rejects(run({ fetchImpl: replay({ detail: mutateDetail(row => { row.SecondaryCountry = 'United States' }) }) }), /geograph/)
})

test('Jungleworks reports output caps as incomplete', async () => {
  const jobs = await run({ fetchImpl: replay(), maxJobs: 0 })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'discovery-only')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 1)
})

test('Jungleworks caller abort interrupts a noncooperative fetch', async () => {
  const controller = new AbortController(), reason = new Error('stop now')
  const pending = run({ fetchImpl: () => new Promise(() => {}), signal: controller.signal })
  controller.abort(reason)
  await assert.rejects(pending, error => error === reason)
})

test('Jungleworks propagates caller cancellation before reading a surface', async () => {
  const controller = new AbortController()
  const reason = new Error('caller cancelled')
  controller.abort(reason)
  await assert.rejects(run({ signal: controller.signal, fetchImpl: () => assert.fail('must not fetch') }), error => error === reason)
})

test('Jungleworks never turns failed discovery into verified empty', async () => {
  await assert.rejects(run({ fetchImpl: async () => { throw new Error('transport unavailable') } }), /transport unavailable/)
})

test('Jungleworks aggregate deadline bounds a noncooperative fetch', async () => {
  await assert.rejects(run({ timeoutMs: 20, fetchImpl: () => new Promise(() => {}) }), /deadline|timeout/i)
})

test('Jungleworks aggregate deadline also bounds an unresponsive response body', async () => {
  await assert.rejects(run({ timeoutMs: 20, fetchImpl: async url => ({ status: 200, url, text: () => new Promise(() => {}) }) }), /deadline|timeout/i)
})

test('Jungleworks rejects a changed first-party ATS handoff', async () => {
  await assert.rejects(run({ fetchImpl: async url => ({ status: 200, url, text: async () => '<title>Careers - JungleWorks</title><a href="https://elsewhere.example/jobs">Apply Now</a>' }) }), /handoff|identity/i)
})

test('Jungleworks rejects inert official handoff links', async () => {
  await assert.rejects(run({ fetchImpl: replay({ official: '<template><a href="https://jungleworks.zohorecruit.in/jobs/Careers">Apply</a></template>' }) }), /handoff/)
})

test('Jungleworks import stays inert when the caller uses --dry-run', () => {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', "globalThis.fetch=()=>{throw Error('import fetched')}; await import('./scraper/jungleworks/script.js'); console.log('import-only')", '--', '--dry-run'], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout.trim(), 'import-only')
})
