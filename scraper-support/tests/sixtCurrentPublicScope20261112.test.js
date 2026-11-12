import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { createSixtScraper } from '../../scraper/sixt/script.js'
import { isCompleteScraperAttempt as completeAttempt, readInventoryEvidence, sourceLifecycleCleanupForbidden } from '../utils/inventoryEvidence.js'
import { extractionDetailHealth } from '../utils/extractionDetailHealth.js'

const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/sixt-current-public-originals-20261112.json.gz', import.meta.url))))
const originals = new Map(fixture.responses.map(row => [row.requestedUrl, row]))
const list = 'https://www.sixt.jobs/in/jobs?q=&country=IN'
const native = 'https://www.sixt.jobs/in/jobs/results?q=&country=IN&page=1&per_page=20'
const smart = 'https://api.smartrecruiters.com/v1/companies/SIXT/postings?offset=0&limit=100&country=in'
const nativeDetail = 'https://api.smartrecruiters.com/v1/companies/SIXT/postings/744000161218929'
const home = 'https://www.sixt.jobs/in/research-and-development-india'
const client = 'https://cdn.sixt.jobs/build/assets/app-kLBNkimr.js'
const isCompleteScraperAttempt = jobs => completeAttempt({
  success: true, completedAt: '2026-11-12T16:20:00.000Z',
  inventoryEvidence: readInventoryEvidence(jobs), detailHealth: extractionDetailHealth(jobs),
  lifecycleCleanupForbidden: sourceLifecycleCleanupForbidden(jobs),
  staleCheckSkipped: sourceLifecycleCleanupForbidden(jobs), staleCheckReasonCode: 'source-cleanup-forbidden',
}, { now: '2026-11-12T16:20:00.000Z' })
const mutateJSON = (page, change) => { const json = JSON.parse(page.html); change(json); page.html = JSON.stringify(json) }

async function collect(change = () => {}, options = {}) {
  const seen = new Map()
  const jobs = await createSixtScraper({ now: () => '2026-11-12T16:20:00.000Z', ...options }).run({
    signal: options.signal,
    fetchPage: async url => {
      const original = originals.get(url)
      assert.ok(original, 'Unexpected public request: ' + url)
      const page = { status: original.status, url: original.url, html: original.body }
      const occurrence = (seen.get(url) || 0) + 1
      seen.set(url, occurrence)
      change(page, url, occurrence)
      return page
    },
  })
  return { jobs, seen }
}

test('current native SIXT India inventory, all original criteria and public channels reconcile', async () => {
  const { jobs, seen } = await collect()
  assert.equal(jobs.length, 5)
  assert.ok(jobs.every(job => job.jobDescription.length > 3000 && job.country === 'India'))
  assert.equal(seen.get(smart), 2)
  assert.equal(seen.get(native), 2)
  assert.equal(seen.get(client), 2)
  assert.ok(jobs.every(job => job.sourceScopeComplete === true && job.lifecycleCleanupAllowed === true))
  assert.equal(sourceLifecycleCleanupForbidden(jobs), false)
  assert.equal(isCompleteScraperAttempt(jobs), true)
  assert.match(readInventoryEvidence(jobs).reason, /current-public-channels-and-independent-native-inventory-qualified/)
})

const controls = [
  ['unknown native India country', native, page => mutateJSON(page, j => { j.items[0].country_slug = '' })],
  ['contradictory native country', native, page => mutateJSON(page, j => { j.items[0].country = 'United States'; j.items[0].country_slug = 'US' })],
  ['native country filter removed', native, page => mutateJSON(page, j => { j.filters.country = '' })],
  ['additional hidden department filter', native, page => mutateJSON(page, j => { j.filters.department = 'tech' })],
  ['native pagination still has more', native, page => mutateJSON(page, j => { j.has_more = true })],
  ['native total exceeds published rows', native, page => mutateJSON(page, j => { j.total += 1 })],
  ['unknown secondary workplace field', native, page => mutateJSON(page, j => { j.items[0].allLocations = ['Remote'] })],
  ['uninspected native criteria field', native, page => mutateJSON(page, j => { j.items[0].requirements = 'Additional original requirements' })],
  ['extra independent ATS role', smart, page => mutateJSON(page, j => { j.content.push({ ...j.content[0], id: '744000000000000' }); j.totalFound += 1 })],
  ['ATS native country missing', smart, page => mutateJSON(page, j => { delete j.content[0].location.country })],
  ['ATS native total mismatch', smart, page => mutateJSON(page, j => { j.totalFound += 1 })],
  ['ATS full criteria add an uncopied section', nativeDetail, page => mutateJSON(page, j => { j.jobAd.sections.qualifications.text = '<p>Additional publisher requirements absent from the corporate page.</p>' })],
  ['ATS full original duties unavailable', nativeDetail, page => mutateJSON(page, j => { j.jobAd.sections.jobDescription.text = '' })],
  ['ATS requisition differs', nativeDetail, page => mutateJSON(page, j => { j.refNumber = 'REF00000X' })],
  ['ATS employer differs', nativeDetail, page => mutateJSON(page, j => { j.company.identifier = 'OtherCompany' })],
  ['ATS role is inactive', nativeDetail, page => mutateJSON(page, j => { j.active = false })],
  ['ATS role is not public', nativeDetail, page => mutateJSON(page, j => { j.visibility = 'INTERNAL' })],
  ['new official recruiting link', home, page => { page.html = page.html.replace('</body>', '<a href="https://example.invalid/jobs">More careers</a></body>') }],
  ['unreviewed official script', home, page => { page.html = page.html.replace('</body>', '<script src="https://example.invalid/careers.js"></script></body>') }],
  ['hidden official embedded board', home, page => { page.html = page.html.replace('</body>', '<iframe hidden src="https://example.invalid/jobs"></iframe></body>') }],
  ['unreviewed official form', home, page => { page.html = page.html.replace('</body>', '<form action="https://example.invalid/jobs"><button>Openings</button></form></body>') }],
  ['new declarative executable handler', home, page => { page.html = page.html.replace('</body>', '<div x-init="fetch(\'https://example.invalid/jobs\')"></div></body>') }],
  ['current client changed', client, page => { page.html += '\nwindow.unreviewedCareers = true' }],
  ['official page authority changed', home, page => { page.url = 'https://example.invalid/careers' }],
]
for (const [label, target, alter] of controls) {
  test(label + ' keeps descriptions but holds completeness and cleanup', async () => {
    const { jobs, seen } = await collect((page, url) => { if (url === target) alter(page) })
    assert.ok(seen.has(target), 'The independent proof surface must actually be inspected')
    assert.equal(jobs.length, 5)
    assert.ok(jobs.every(job => job.sourceScopeComplete === false && job.lifecycleCleanupAllowed === false))
    assert.equal(isCompleteScraperAttempt(jobs), false)
    assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
  })
}

test('closing native model changes keep cleanup held', async () => {
  const { jobs } = await collect((page, url, occurrence) => {
    if (url === native && occurrence === 2) mutateJSON(page, j => { j.items[0].title += ' changed' })
  })
  assert.equal(isCompleteScraperAttempt(jobs), false)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
})

test('closing controller changes keep cleanup held', async () => {
  const { jobs } = await collect((page, url, occurrence) => {
    if (url === client && occurrence === 2) page.html += '\n// publisher changed'
  })
  assert.equal(isCompleteScraperAttempt(jobs), false)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
})

for (const maxJobs of [0, 2]) test('caller cap ' + maxJobs + ' carries an array-level cleanup hold', async () => {
  const { jobs } = await collect(() => {}, { maxJobs })
  assert.equal(jobs.length, maxJobs)
  assert.equal(isCompleteScraperAttempt(jobs), false)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
  assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed, false)
})

test('caller cancellation propagates during scope proof', async () => {
  const controller = new AbortController(), reason = new Error('stop current SIXT proof')
  await assert.rejects(collect((page, url) => { if (url === native) controller.abort(reason) }, { signal: controller.signal }),
    error => error === reason)
})

test('native empty terminal must remain empty', async () => {
  const terminal = native.replace('page=1', 'page=2')
  const { jobs, seen } = await collect((page, url) => {
    if (url === terminal) mutateJSON(page, j => { j.items.push(JSON.parse(originals.get(native).body).items[0]) })
  })
  assert.ok(seen.has(terminal))
  assert.equal(isCompleteScraperAttempt(jobs), false)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
})

test('a cloned listing count cannot qualify different independent ATS identities', async () => {
  const { jobs } = await collect((page, url) => {
    if (url === smart) mutateJSON(page, j => { j.content[0].id = '744000000000000' })
  })
  assert.equal(isCompleteScraperAttempt(jobs), false)
})
