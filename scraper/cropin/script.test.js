import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { spawnSync } from 'node:child_process'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { run } from './script.js'

const read = file => {
  const bytes = readFileSync(new URL(`./fixtures/${file}`, import.meta.url))
  return JSON.parse(file.endsWith('.gz') ? gunzipSync(bytes) : bytes)
}
const responses = [read('official-response.json'), read('board-response.json'), ...read('native-responses.json.gz')]
const replay = (mutate = row => row) => async url => {
  const original = responses.find(row => row.url === url)
  assert.ok(original, `Uncaptured request ${url}`)
  const row = mutate(structuredClone(original))
  return { ok: row.status === 200, status: row.status, url: row.finalUrl, text: async () => row.body }
}

test('CropIn proves empty from current tenant API and reviewed unfiltered client contract', async () => {
  const jobs = await run({ fetch: replay() })
  assert.deepEqual(jobs, [])
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'verified-empty')
  assert.equal(evidence.firstParty, true)
  assert.equal(evidence.listingComplete, true)
  assert.equal(evidence.reportedTotal, 0)
  assert.equal(evidence.indiaFacetCount, 0)
  assert.equal(evidence.pagesFetched, 7)
})

for (const [name, change] of [
  ['hidden official handoff ancestor', row => row.url === 'https://www.cropin.com/career/' ? { ...row, body: '<div style="content-visibility:hidden">' + row.body + '</div>' } : row],
  ['inert official handoff ancestor', row => row.url === 'https://www.cropin.com/career/' ? { ...row, body: '<div inert>' + row.body + '</div>' } : row],
  ['foreign employer', row => row.url.endsWith('careerportalinfo') ? { ...row, body: row.body.replaceAll('Cropin', 'Foreign employer') } : row],
  ['failed organization envelope', row => row.url.endsWith('careerportalinfo') ? { ...row, body: JSON.stringify({ ...JSON.parse(row.body), success: false }) } : row],
  ['foreign tenant configuration', row => row.url.endsWith('.html') ? { ...row, body: row.body.replaceAll('953bbd12', 'aaaaaaaa') } : row],
  ['changed client contract', row => row.url.includes('/embedjobs/js/') ? { ...row, body: row.body + '\n// changed' } : row],
  ['failed API envelope', row => row.url.includes('/default/active/') ? { ...row, body: '{"error":"unavailable","jobs":[]}' } : row],
  ['unverified nonempty schema', row => row.url.includes('/default/active/') ? { ...row, body: '[{"id":"new-role"}]' } : row],
  ['group inventory changed', row => row.url.includes('/grouplinkstatus/') ? { ...row, body: '{"isGroupLinked":true}' } : row],
  ['foreign response redirect', row => row.url.includes('/default/active/') ? { ...row, finalUrl: 'https://foreign.keka.com/careers/' } : row],
]) test(`CropIn cannot certify empty after ${name}`, async () => {
  await assert.rejects(run({ fetch: replay(change) }), error => error.code === 'CROPIN_COVERAGE_GAP')
})

test('CropIn bounds noncooperative response body reads', async () => {
  await assert.rejects(run({ fetch: async url => ({ ok: true, status: 200, url, text: () => new Promise(() => {}) }), timeoutMs: 20 }), /timed out/)
})

test('CropIn rejects oversized bodies before parsing native evidence', async () => {
  await assert.rejects(run({ fetch: async url => ({ status: 200, url, text: async () => 'x'.repeat(4 * 1024 * 1024 + 1) }) }), /response body too large/)
})

test('CropIn aborts its transport signal after a parser failure', async () => {
  let transportSignal
  await assert.rejects(run({ fetch: async (url, options) => {
    transportSignal = options.signal
    return { status: 200, url, text: async () => '<html>unrecognized page</html>' }
  } }), /coverage gap/)
  assert.equal(transportSignal.aborted, true)
})

test('import with unrelated dry-run arguments is inert', () => {
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', "process.argv.push('--dry-run'); globalThis.fetch=()=>{throw Error('unexpected network')}; await import('./scraper/cropin/script.js')"], { cwd: new URL('../../', import.meta.url), encoding: 'utf8' })
  assert.equal(child.status, 0, child.stderr)
})

test('CropIn transport failure cannot become a successful empty inventory', async () => {
  await assert.rejects(run({ fetch: async () => { throw Error('upstream unavailable') } }), /upstream unavailable/)
})

test('CropIn bounds a noncooperative fetch', async () => {
  await assert.rejects(run({ fetch: () => new Promise(() => {}), timeoutMs: 20 }), /timed out/)
})

test('CropIn honors caller cancellation even when transport ignores it', async () => {
  const controller = new AbortController()
  const pending = run({ fetch: () => new Promise(() => {}), signal: controller.signal })
  controller.abort(Error('caller cancelled'))
  await assert.rejects(pending, /caller cancelled/)
})
