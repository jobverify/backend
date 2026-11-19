import assert from 'node:assert/strict'
import test from 'node:test'
import { run, CAREERS_URL } from './script.js'
import { fixture, transport } from '../../scraper-support/tests/corporateFeedFixture20261118.js'
import { readInventoryEvidence, sourceLifecycleCleanupForbidden } from '../../scraper-support/utils/inventoryEvidence.js'

const intro = 'https://careers-mambu.icims.com/jobs/intro?in_iframe=1&hashed=-625943632&in_iframe=1'
const search = 'https://careers-mambu.icims.com/jobs/search?ss=1&in_iframe=1&hashed=-625943632'
const detail = 'https://careers-mambu.icims.com/jobs/3352/senior-account-executive-%28channel%29/job?in_iframe=1'
const entries = ({ india = false } = {}) => new Map([
  [CAREERS_URL, fixture('mambu', 'mambu')], ['https://new.mambu.com/', fixture('mambu', 'mambu')],
  ['https://careers-mambu.icims.com/', fixture('mambu', 'mambu-landing')],
  ['https://careers-mambu.icims.com/?in_iframe=1', { body: fixture('mambu', 'mambu-iframe'), url: intro }],
  [search, fixture('mambu', 'mambu-search').replaceAll('JP-Remote', india ? 'IN-Bengaluru' : 'JP-Remote')],
  [detail, fixture('mambu', 'mambu-detail-3352').replaceAll('JP-Remote', india ? 'IN-Bengaluru' : 'JP-Remote')
    .replaceAll('"addressCountry":"JP"', india ? '"addressCountry":"IN"' : '"addressCountry":"JP"')
    .replaceAll('"addressLocality":"Remote"', india ? '"addressLocality":"Bengaluru"' : '"addressLocality":"Remote"')],
])

test('Mambu follows its public iCIMS iframe/search handoffs and reconciles full role identity and country', async () => {
  const jobs = await run({ fetchImpl: transport(entries({ india: true })) })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, '3352')
  assert.equal(jobs[0].company, 'Mambu')
  assert.equal(jobs[0].country, 'India')
  assert.match(jobs[0].sourceDescription, /Channel Account Executive/)
  assert.equal(jobs[0].postingDate, '2026-04-02T22:00:00.000Z')
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
})

test('Mambu retains its observed foreign role without certifying India absence', async () => {
  const jobs = await run({ fetchImpl: transport(entries()) })
  assert.equal(jobs.length, 0)
  assert.equal(jobs.nativeCollectionEvidence.nativeBoards[0].nativeRecords.length, 1)
  assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory')
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
})

test('Mambu changed closing role models revoke configured native completeness', async () => {
  const pages = entries(), read = transport(pages)
  let observed = 0
  const jobs = await run({ fetchImpl: async url => {
    if (String(url) === detail && ++observed === 2) return transport(new Map([[detail,
      pages.get(detail).replace('2027-04-02T22:00:00.000Z', '2027-04-03T22:00:00.000Z')]]))(url)
    return read(url)
  } })
  assert.equal(observed, 2)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
})
