import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

import {
  CAREER_PAGE_URL,
  VERIFIED_ON,
  createFinolexIndustriesLimitedScraper,
  extractDepartmentOptions,
  hasEmptyOpeningsSignal,
  hasOfficialCareersSignal,
} from './script.js'

// Retained historical shell: these markers never establish current vacancies.
const historicalCareerShellHtml = `
  <html>
    <head>
      <title>Careers &amp; Jobs Opportunities | Work with Finolex Pipes</title>
    </head>
    <body>
      <h1><span>Join Us</span> To Shape the Future of Piping Solutions</h1>
      <div>Managing Director, Finolex Industries Ltd.</div>
      <section class="section2">
        <div class="career-heading">
          <p>Job Openings</p>
          <h2>Discover Your Career Path</h2>
        </div>
        <div class="search-job-container">
          <form class="search-field" id="joblocSearch">
            <div class="search-dropdown">
              <div class="custom-select">
                <div class="selected-value" id="selDepart">-Select Department-</div>
                <div class="options-container">
                  <div class="option" data-value="">-Select Department-</div>
                  <div class="option" data-value="Admin">Admin</div>
                  <div class="option" data-value="Data Analytics">Data Analytics</div>
                </div>
              </div>
            </div>
          </form>
          <div class="job-lists">
            <div class="job-list-container" id="jobListData"></div>
            <div class="job-list-container" id="jobListNoData">There are currently no open positions matching your search criteria.</div>
            <div class="job-detail-container" id="jobDetailsDiv"></div>
          </div>
        </div>
      </section>
      <div class="mobile-view">
        <div class="bottom-sheet" id="jobModal">
          <div class="content">
            <div class="body2">
              <div id="modalJobDetails"></div>
            </div>
          </div>
        </div>
      </div>
      <div class="job-not-found">
        <a>Apply via Mail</a>
        <a>Apply via Whatsapp</a>
        <p class="contact-email">Email: <a href="mailto:career@finolexind.com">career@finolexind.com</a></p>
        <p>500 Internal Server Error</p>
      </div>
      <section class="job-application-modal">
        <form class="application-form" id="applicationForm">
          <input type="text" id="jobDropdown" name="jobDropdown" value="abc" readonly />
          <select id="cityDropdown" name="cityDropdown"></select>
        </form>
      </section>
    </body>
  </html>
`

test('legacy Finolex marker helpers recognize the historical shell without a current verified date or inventory claim', () => {
  assert.equal(CAREER_PAGE_URL, 'https://www.finolexpipes.com/career/')
  assert.equal(VERIFIED_ON, null)
  assert.equal(hasOfficialCareersSignal(historicalCareerShellHtml), true)
  assert.equal(hasEmptyOpeningsSignal(historicalCareerShellHtml), true)
  assert.deepEqual(extractDepartmentOptions(historicalCareerShellHtml), [
    { value: 'Admin', label: 'Admin' },
    { value: 'Data Analytics', label: 'Data Analytics' },
  ])
  assert.equal(hasOfficialCareersSignal('<html><body>Finolex Pipes</body></html>'), false)
})

test('Finolex rejects original HTTP 500 even when the historical shell contains empty-state markers', async () => {
  const requestedUrls = []
  await assert.rejects(createFinolexIndustriesLimitedScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      return { status: 500, finalUrl: url, headers: { 'content-type': 'text/html' }, body: historicalCareerShellHtml }
    },
  }), /HTTP 500/)

  assert.deepEqual(requestedUrls, [CAREER_PAGE_URL])
})

test('Finolex rejects a historical shell without the current original corporate/client/query authority', async () => {

  await assert.rejects(
    createFinolexIndustriesLimitedScraper().run({
      fetchPage: async url => ({ status: 200, finalUrl: url, headers: { 'content-type': 'text/html' }, body: historicalCareerShellHtml }),
    }),
    /canonical|document|client/i,
  )
})

test('Finolex current factory replays genuine declared native query bytes and preserves all14 unresolved-country records', async () => {
  const capture = JSON.parse(gunzipSync(readFileSync(new URL('../../scraper-support/tests/fixtures/currentNative20261106C27/capture.json.gz', import.meta.url))))
  const packets = new Map(capture.responses.filter(row => row.source === 'finolexindustrieslimited').map(row => [row.requestedUrl, row]))
  const listing = 'https://www.finolexpipes.com/apis/joblist/'
  const client = 'https://www.finolexpipes.com/site/templates/assets/js/career-new.js'
  const requests = []
  const jobs = await createFinolexIndustriesLimitedScraper().run({ fetchPage: async (url, init) => {
    const page = packets.get(url)
    assert.ok(page, `Only original Finolex corporate/client/query entities: ${url}`)
    assert.equal(Buffer.byteLength(page.body), page.bytes, url)
    assert.equal(createHash('sha256').update(page.body).digest('hex'), page.sha256, url)
    assert.equal(init.method, page.method)
    assert.equal(init.body ?? null, page.requestBody ?? null)
    requests.push(url)
    return { status: page.status, finalUrl: page.finalUrl, headers: page.headers, body: page.body }
  } })
  assert.deepEqual(requests, [CAREER_PAGE_URL, client, listing, listing, client, CAREER_PAGE_URL])
  const records = JSON.parse(packets.get(listing).body)
  assert.equal(jobs.length, 14)
  assert.deepEqual(jobs.map(job => job.jobId), records.map(record => String(record.id)))
  assert.ok(jobs.every(job => job.country === null && job.sourceCountryScopeUnresolved === true && job.sourceDetailComplete === true))
  assert.ok(jobs.every(job => job.postingDate === null && job.requisitionId === null && job.lifecycleCleanupAllowed === false))
  assert.equal(jobs.nativeCollectionEvidence.observedVacancyCount, 14)
  assert.equal(jobs.nativeCollectionEvidence.closingReconciled, true)
  assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal, null)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})
