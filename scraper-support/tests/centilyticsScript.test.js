import assert from 'node:assert/strict'
import test from 'node:test'

const loadCentilyticsModule = async () => {
  try {
    return await import('../../scraper/centilytics/script.js')
  } catch {
    assert.fail('Expected Centilytics scraper module at ../../scraper/scraper/centilytics/script.js')
  }
}

const samplePayload = {
  code: 'success',
  data: [],
}

test('buildApiUrl keeps Centilytics on the first-party public Zoho Recruit feed', async () => {
  const { API_URL, buildApiUrl } = await loadCentilyticsModule()

  assert.equal(buildApiUrl(), API_URL)
  assert.equal(
    API_URL,
    'https://jobs.centilytics.com/recruit/v2/public/Job_Openings?source=CareerSite&pagename=Careers',
  )
})

test('extractSearchResults returns no jobs when the live Centilytics public Zoho Recruit feed is empty', async () => {
  const { extractSearchResults } = await loadCentilyticsModule()
  const jobs = extractSearchResults(samplePayload)

  assert.deepEqual(jobs, [])
})

test('run reconciles the current Centilytics board and API before certifying empty inventory', async () => {
  const { createCentilyticsScraper, API_URL } = await loadCentilyticsModule()
  const { makeZohoFixture, zohoFixtureOptions } = await import('./fixtures/zohoNativeOptions.js')
  const { readInventoryEvidence } = await import('../utils/inventoryEvidence.js')
  const data = makeZohoFixture('centilytics'); data.rows = []
  const jobs = await createCentilyticsScraper().run(zohoFixtureOptions(data))
  assert.equal(jobs.length, 0)
  assert.equal(data.requests.filter(url => url === API_URL).length, 2)
  assert.equal(data.requests.filter(url => url === data.spec.board).length, 2)
  assert.equal(readInventoryEvidence(jobs).status, 'verified-empty')
})
