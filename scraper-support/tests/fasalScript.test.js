import { makeZohoFixture, zohoFixtureOptions } from './fixtures/zohoNativeOptions.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import assert from 'node:assert/strict'
import test from 'node:test'

const loadFasalModule = async () => {
  try {
    return await import('../../scraper/fasal/script.js')
  } catch {
    assert.fail('Expected Fasal scraper module at ../../scraper/fasal/script.js')
  }
}

const officialCareersHtml = `
  <html>
    <body>
      <section>
        <p>Join us in bringing a new era to Indian Agriculture</p>
        <a href="https://jobs.fasal.co/jobs/Careers" class="button-5 join-us w-button">View Vacancies</a>
      </section>
    </body>
  </html>
`

const portalHtml = `
  <html>
    <head>
      <title>Jobs at PeoplePlus</title>
      <meta property="og:url" content="https://jobs.fasal.co/jobs/Careers">
      <meta property="og:site_name" content="Wolkus Technology Solutions Private Limited">
    </head>
    <body>
      <input type="hidden" id="pageJson" value="{&quot;detail&quot;:{&quot;meta&quot;:{&quot;title&quot;:&quot;Jobs at PeoplePlus&quot;}}}">
      <input type="hidden" id="moduleMeta" value="[]">
      <input type="hidden" id="jobs" value="[]">
    </body>
  </html>
`

const emptyJobsPayload = {
  code: 'success',
  data: [],
  info: {
    page_name: 'Careers',
  },
}

test('Fasal constants stay pinned to the verified first-party careers handoff and Zoho public jobs API', async () => {
  const fasal = await loadFasalModule()

  assert.equal(fasal.COMPANY_NAME, 'Fasal')
  assert.equal(fasal.SOURCE, 'fasal')
  assert.equal(fasal.OFFICIAL_CAREERS_URL, 'https://www.fasal.co/life-at-fasal')
  assert.equal(fasal.CAREERS_PORTAL_URL, 'https://jobs.fasal.co/jobs/Careers')
  assert.equal(
    fasal.CAREERS_API_URL,
    'https://jobs.fasal.co/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  )
  assert.equal(fasal.hasOfficialCareersPageSignal(officialCareersHtml), true)
  assert.equal(fasal.hasOfficialPortalSignal(portalHtml), true)
})

test('Fasal factory certifies a reconciled employer-bound native empty board', async () => {
  const fasal = await loadFasalModule(), data = makeZohoFixture('fasal'); data.rows = []
  const jobs = await fasal.createFasalScraper().run(zohoFixtureOptions(data))
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'verified-empty')
  assert.deepEqual(fasal.extractIndiaJobs(emptyJobsPayload), [])
  assert.equal(data.requests.length, 5)
})

test('Fasal rejects employer handoff, reciprocal portal and native API changes', async () => {
  const fasal = await loadFasalModule()
  const absent = makeZohoFixture('fasal'); absent.homepage = '<h1>No handoff</h1>'
  await assert.rejects(fasal.createFasalScraper().run(zohoFixtureOptions(absent)), /careers handoff/i)
  const foreign = makeZohoFixture('fasal'); foreign.meta.org_info.id = 'other'
  await assert.rejects(fasal.createFasalScraper().run(zohoFixtureOptions(foreign)), /organization/i)
  const data = makeZohoFixture('fasal'), opts = zohoFixtureOptions(data)
  await assert.rejects(fasal.createFasalScraper().run({ ...opts, fetchJson: async () => ({ code: 'success' }) }), /API success envelope/i)
})
