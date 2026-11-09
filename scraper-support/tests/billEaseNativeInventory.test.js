import assert from 'node:assert/strict'
import test from 'node:test'
import { createBillEaseScraper, CAREERS_BOARD_URL } from '../../scraper/billease/script.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { createCatalogScraper, getScraperCatalog } from '../providers/index.js'
import { billEaseNativeOptions, billEaseIndiaRole, billEaseSingleForeignRole } from './fixtures/billEaseNativeOptions.js'
const INDIA_ID = 'e4a2c8c0-7687-4e82-af62-21be3c64f7ee'
const execute = async (mutate = () => {}, extra = {}) => {
  const options = billEaseNativeOptions(mutate)
  return { jobs: await createBillEaseScraper().run({ ...options, ...extra }), options }
}
test('BillEase reads both current native pages and preserves the corporate/native inventory discrepancy', async () => {
  const { jobs, options } = await execute(), evidence = readInventoryEvidence(jobs)
  assert.ok(evidence, 'An unadorned empty array cannot establish BillEase inventory evidence')
  assert.equal(jobs.length, 0)
  assert.equal(evidence.status, 'discovery-only')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.indiaFacetCount, null)
  assert.match(evidence.reason, /corporate-native-inventory-differs/)
  assert.match(evidence.reason, /native-country-unresolved/)
  assert.equal(jobs.nativeInventorySummary.corporateRoleCount, 46)
  assert.equal(jobs.nativeInventorySummary.nativeRoleCount, 48)
  assert.ok(options.calls.includes(CAREERS_BOARD_URL + '?page=2'))
  assert.equal(options.calls.filter(url => url === CAREERS_BOARD_URL + '?page=2').length, 2)
  const details = options.calls.filter(url => /\/jobs\//.test(url))
  assert.ok(details.length > 0 && details.length <= jobs.nativeInventorySummary.nativeRoleCount)
  assert.equal(new Set(details).size, details.length, 'Each unresolved native posting is read at most once')
  assert.equal(jobs.nativeInventorySummary.publicDetailObservations.length + jobs.nativeInventorySummary.publicDetailFailures.filter(row => !row.notAttemptedAfterRateLimit).length, details.length)
})
test('BillEase extracts a future explicit India role with full nested native content and role-bound application', async () => {
  const { jobs } = await execute(packet => billEaseIndiaRole(packet))
  assert.equal(jobs.length, 1)
  const job = jobs[0]
  assert.equal(job.jobId, INDIA_ID)
  assert.equal(job.country, 'India')
  assert.equal(job.location, 'Bengaluru, Karnataka, India')
  assert.equal(job.city, 'Bengaluru')
  assert.equal(job.applyUrl, CAREERS_BOARD_URL + 'jobs/' + INDIA_ID + '/apply')
  assert.equal(job.requisitionId, null)
  assert.equal(job.postingDate, null)
  assert.equal(job.sourcePublicationDateUnavailable, true)
  assert.equal(job.sourceDetailComplete, true)
  assert.equal(job.lifecycleCleanupAllowed, false)
  assert.match(job.sourceDescription, /Key Responsibilities[\s\S]*Qualifications[\s\S]*Why Join Us/)
  assert.equal(job.sourceListingComplete, false)
})
test('BillEase rejects an external payload loader without requesting it', async () => {
  await assert.rejects(execute(packet => {
    if (packet.name === 'corporate') packet.body = packet.body.replace(/data-src="[^"]*"/, 'data-src="https://other.example/careers/_payload.json?_b=bad"')
  }), /BillEase.*payload/i)
})
test('BillEase rejects missing native page cards instead of certifying the first page', async () => {
  await assert.rejects(execute(packet => { if (packet.name === 'native-board-2') packet.body = packet.body.replace(/<article\b[\s\S]*?<\/article>/, '') }), /BillEase.*(?:pagination|count|inventory)/i)
})
test('BillEase rejects duplicated native job identities', async () => {
  await assert.rejects(execute(packet => {
    if (packet.name === 'native-board-2') packet.body = packet.body.replaceAll('0e9217eb-910d-464d-9bdf-3a7599ab608c', INDIA_ID)
  }), /BillEase.*(?:duplicate|identity)/i)
})
test('BillEase rejects a detail role with a foreign application ID', async () => {
  await assert.rejects(execute(packet => {
    billEaseIndiaRole(packet)
    if (packet.url.endsWith('/jobs/' + INDIA_ID)) packet.body = packet.body.replaceAll('../jobs/' + INDIA_ID + '/apply', '../jobs/11111111-1111-1111-1111-111111111111/apply')
  }), /BillEase.*(?:application|identity)/i)
})
test('BillEase rejects a detail title that conflicts with the native listing', async () => {
  await assert.rejects(execute(packet => {
    billEaseIndiaRole(packet)
    if (packet.url.endsWith('/jobs/' + INDIA_ID)) packet.body = packet.body.replace(/(<h4 class="single-job-title[^>]*>)[\s\S]*?(<\/h4>)/, '$1 Other Role $2')
  }), /BillEase.*(?:title|identity)/i)
})
test('BillEase excludes hidden full descriptions and keeps their details incomplete', async () => {
  const { jobs } = await execute(packet => {
    billEaseIndiaRole(packet)
    if (packet.url.endsWith('/jobs/' + INDIA_ID)) packet.body = packet.body.replace(/(<div\b[^>]*class=")([^"]*\bjob-post-description\b[^"]*")/, '$1$2 style="display:none"')
  })
  assert.equal(jobs.length, 0)
  assert.match(readInventoryEvidence(jobs).reason, /description-unavailable/)
})
test('BillEase drops roles whose country changes in the closing inventory', async () => {
  const { jobs } = await execute((packet, index) => {
    billEaseIndiaRole(packet)
    if (packet.name === 'native-board-1' && index === 1) packet.body = packet.body.replaceAll('data-job-country="India"', 'data-job-country="Philippines"')
      .replaceAll('Bengaluru, Karnataka, India', 'Makati, Philippines')
  })
  assert.equal(jobs.length, 0)
  assert.match(readInventoryEvidence(jobs).reason, /closing-native-inventory-changed/)
})
test('BillEase rejects HTTP challenges and redirects without converting them into an empty inventory', async () => {
  for (const change of [packet => { packet.status = 403 }, packet => { packet.finalUrl = 'https://challenge.example/' }]) {
    await assert.rejects(execute(packet => { if (packet.name === 'native-board-1') change(packet) }), /BillEase.*(?:403|redirect)/i)
  }
})
test('BillEase propagates cancellation before any public request', async () => {
  const options = billEaseNativeOptions(), controller = new AbortController()
  controller.abort(Error('BillEase caller cancelled'))
  await assert.rejects(createBillEaseScraper().run({ ...options, signal: controller.signal }), /caller cancelled/)
  assert.equal(options.calls.length, 0)
})
test('BillEase does not silently discard an injected legacy transport and make real network requests', async () => {
  const original = globalThis.fetch
  globalThis.fetch = async () => { throw Error('Legacy transport fell through to default network') }
  try { await assert.rejects(createBillEaseScraper().run({ fetchText: async () => '' }), /BillEase.*fetchPage/i) }
  finally { globalThis.fetch = original }
})
test('BillEase does not transfer a conflicting listing city to an India detail', async () => {
  const { jobs } = await execute(packet => {
    billEaseIndiaRole(packet)
    if (packet.name === 'native-board-1') packet.body = packet.body.replaceAll('data-job-city="Bengaluru"', 'data-job-city="Mumbai"')
  })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].city, null)
  assert.equal(jobs[0].location, 'Bengaluru, Karnataka, India')
})
test('BillEase leaves a mixed India/foreign detail location unresolved', async () => {
  const { jobs } = await execute(packet => {
    billEaseIndiaRole(packet)
    packet.body = packet.body.replaceAll('Bengaluru, Karnataka, India', 'Bengaluru, India / United States')
  })
  assert.equal(jobs.length, 0)
  assert.match(readInventoryEvidence(jobs).reason, /country-or-location-unresolved/)
})
test('BillEase fully enumerates both native snapshots before applying a caller job cap', async () => {
  const second = '2b74ddfb-c0bc-4911-9002-377e69adb1d7'
  const { jobs, options } = await execute(packet => { billEaseIndiaRole(packet); billEaseIndiaRole(packet, second) }, { maxJobs: 1 })
  assert.equal(jobs.length, 1)
  assert.ok(options.calls.includes(CAREERS_BOARD_URL + 'jobs/' + second))
  assert.equal(options.calls.filter(url => url === CAREERS_BOARD_URL + '?page=2').length, 2)
  assert.match(readInventoryEvidence(jobs).reason, /source-job-limit/)
})
test('BillEase can establish complete zero-India evidence only for reconciled explicit foreign native inventory', async () => {
  const { jobs } = await execute(billEaseSingleForeignRole), evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'complete-inventory')
  assert.equal(evidence.reportedTotal, 1)
  assert.equal(evidence.indiaFacetCount, 0)
})
test('BillEase current registered extraction preserves partial inventory evidence through catalog normalization', async () => {
  const jobs = await createCatalogScraper(getScraperCatalog().find(provider => provider.source === 'billease')).run(billEaseNativeOptions())
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'discovery-only')
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
})
test('BillEase does not certify complete scope when corporate and explicit native countries differ', async () => {
  const { jobs } = await execute(packet => { billEaseSingleForeignRole(packet); billEaseIndiaRole(packet) })
  assert.equal(jobs.length, 1)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.match(readInventoryEvidence(jobs).reason, /corporate-native-country-differs/)
})
for (const [surface, extra] of [
  ['corporate', '<iframe src="https://jobs.ashbyhq.com/billease"></iframe>'],
  ['native-board-1', '<iframe src="https://jobs.ashbyhq.com/billease"></iframe>'],
  ['corporate', '<a href="https://careers.smartrecruiters.com/BillEase">Join our team</a>'],
  ['native-board-1', '<a href="https://jobs.ashbyhq.com/billease">Explore opportunities</a>'],
  ['corporate', '<script src="https://jobs.ashbyhq.com/billease/embed"></script>'],
  ['native-board-1', '<script src="https://jobs.ashbyhq.com/billease/embed"></script>'],
]) test(`BillEase retains partial scope for an additional hiring surface on ${surface}: ${extra.slice(0, 28)}`, async () => {
  const { jobs } = await execute(packet => {
    billEaseSingleForeignRole(packet)
    if (packet.name === surface) packet.body = packet.body.replace('</body>', extra + '</body>')
  })
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.match(readInventoryEvidence(jobs).reason, /additional-.*hiring-scope/)
})
