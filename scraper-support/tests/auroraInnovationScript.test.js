import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { statSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { createAuroraInnovationScraper } from '../../scraper/aurorainnovation/script.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const row = (overrides = {}) => ({
  id: 'de07a165-d527-4e60-a450-150337dbd155', jobId: 'c4d4dc77-cf21-4a17-9e15-430674d91f85', title: 'Software Engineer',
  locations: ['Bengaluru, India'], category: 'Software Engineering', isRemote: false,
  searchText: 'Build and operate autonomous vehicle systems.',
  applyLink: 'https://aurora.tech/careers?ashby_jid=de07a165-d527-4e60-a450-150337dbd155',
  publishedDate: '2026-10-22', updatedAt: '2026-10-23T00:00:00Z',
  ...overrides,
})
const response = (rows) => ({ jobs: rows,
  index: JSON.stringify({ documentCount: rows.length, documentIds: Object.fromEntries(rows.map((job, i) => [i, job.id])) }),
  facets: { locations: [...new Set(rows.flatMap(job => job.locations))], departments: [...new Set(rows.map(job => job.category))] },
})
const run = (rows, options = {}) => createAuroraInnovationScraper().run({ fetchJson: async () => response(rows), ...options })

test('fetches native inventory and returns source-backed India roles only', async () => {
  const jobs = await run([row(), row({ id: '7a8147e3-5a2b-4c8f-b788-f338f3fa0cd1', applyLink: 'https://aurora.tech/careers?ashby_jid=7a8147e3-5a2b-4c8f-b788-f338f3fa0cd1', locations: ['Pittsburgh, PA'] })])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, row().id)
  assert.equal(jobs[0].company, 'Aurora Innovation')
  assert.equal(jobs[0].source, 'aurorainnovation')
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})

test('complete native foreign inventory proves India zero with explicit scope', async () => {
  const jobs = await run([row({ locations: ['Pittsburgh, PA'] })])
  const evidence = readInventoryEvidence(jobs)
  assert.equal(jobs.length, 0)
  assert.equal(evidence.listingComplete, true)
  assert.equal(evidence.indiaFacetCount, 0)
  assert.equal(evidence.firstParty, true)
})

test('remote unknown location does not prove India zero', async () => {
  const jobs = await run([row({ locations: ['Remote'] })])
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('failed, malformed and truncated native feeds reject instead of returning empty', async () => {
  for (const payload of [{}, { error: 'upstream failed', jobs: [] }, { ...response([]), index: JSON.stringify({ documentCount: 1, documentIds: { 0: row().id } }) }]) {
    await assert.rejects(createAuroraInnovationScraper().run({ fetchJson: async () => payload }))
  }
  await assert.rejects(createAuroraInnovationScraper().run({ fetchJson: async () => { throw Error('blocked') } }), /blocked/)
})

test('missing source description remains missing and does not invent content', async () => {
  const jobs = await run([row({ searchText: undefined })])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobDescription, null)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('external abort propagates before any network request', async () => {
  const controller = new AbortController()
  controller.abort(Error('cancelled Aurora'))
  await assert.rejects(createAuroraInnovationScraper().run({ signal: controller.signal, fetchJson: async () => response([]) }), /cancelled Aurora/)
})

test('request budget aborts a stalled transport instead of hanging', async () => {
  const keepAlive = setTimeout(() => {}, 1000)
  try {
    await assert.rejects(createAuroraInnovationScraper().run({
      timeoutMs: 20,
      fetchJson: async (url, { signal }) => new Promise((resolve, reject) => {
        if (signal.aborted) reject(signal.reason)
        else signal.addEventListener('abort', () => reject(signal.reason), { once: true })
      }),
    }), /timeout|aborted/i)
  } finally { clearTimeout(keepAlive) }
})

test('importing with another scripts dry-run flag has no execution side effects', () => {
  const code = "process.argv.push('--dry-run'); await import('./scraper/aurorainnovation/script.js'); console.log('import-only')"
  const artifact = 'scraper/aurorainnovation/jobs.json'
  const before = statSync(artifact).mtimeMs
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: process.cwd(), encoding: 'utf8', timeout: 5000 })
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout.trim(), 'import-only')
  assert.equal(statSync(artifact).mtimeMs, before, 'import must not write jobs.json')
})

test('HTTP-200 error envelopes cannot masquerade as complete native inventories', async () => {
  for (const failure of [{ ok: false }, { status: 'error' }, { errors: ['backend unavailable'] }, { statusCode: 503 }]) {
    await assert.rejects(createAuroraInnovationScraper().run({ fetchJson: async () => ({ ...response([]), ...failure }) }), /inventory/)
  }
})

test('observed official feed reconciles all 98 identities and proves explicit India zero', async () => {
  const fixtureRoot = new URL('../../scraper/aurorainnovation/fixtures/', import.meta.url)
  const metadata = JSON.parse(readFileSync(new URL('metadata.json', fixtureRoot)))
  for (const entry of metadata.responses) {
    const bytes = readFileSync(new URL(entry.file, fixtureRoot))
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.captureSha256)
    const decoded = JSON.parse(bytes)
    const capture = entry.responseIndex == null ? decoded : decoded[entry.responseIndex]
    assert.equal(createHash('sha256').update(capture.body).digest('hex'), entry.bodySha256)
    assert.equal(capture.status, 200)
  }
  const capture = JSON.parse(readFileSync(new URL('jobs-response.json', fixtureRoot)))
  const payload = JSON.parse(capture.body)
  assert.equal(payload.jobs.length, 98)
  const jobs = await createAuroraInnovationScraper().run({ fetchJson: async url => {
    assert.equal(url, capture.url)
    return payload
  } })
  assert.equal(jobs.length, 0)
  assert.deepEqual(Object.fromEntries(['status', 'firstParty', 'listingComplete', 'reportedTotal', 'indiaFacetCount'].map(key => [key, readInventoryEvidence(jobs)[key]])), {
    status: 'complete-inventory', firstParty: true, listingComplete: true, reportedTotal: 98, indiaFacetCount: 0,
  })
  // Removing just one observed job cannot become a successful zero.
  await assert.rejects(createAuroraInnovationScraper().run({ fetchJson: async () => ({ ...payload, jobs: payload.jobs.slice(1) }) }), /count mismatch/)
})
