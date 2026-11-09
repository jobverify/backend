import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const careersHtml = `
<html>
  <head><title>E2logy Careers | Join a Dynamic Team of IT Professionals</title></head>
  <body>
    <section class="current_opening">
      <div id="rec_job_listing_div"></div>
      <script>
        rec_embed_js.load({
          widget_id:"rec_job_listing_div",
          page_name:"Careers",
          source:"CareerSite",
          site:"https://e2logy.zohorecruit.com",
          empty_job_msg:"No current Openings"
        });
      </script>
    </section>
  </body>
</html>
`

const jobsPayload = {
  code: 'success',
  data: [
    {
      Industry: 'IT Services',
      Job_Type: 'Full time',
      Job_Opening_Name: 'Java SpringBoot Developer (ASE)',
      Posting_Title: 'Java SpringBoot Developer (ASE)',
      Country: 'India',
      City: 'Noida Sector 73',
      id: '424443000011051040',
      $url: 'https://e2logy.zohorecruit.com/jobs/Careers/424443000011051040/Java-SpringBoot-Developer-ASE?source=CareerSite',
    },
  ],
}

const loadE2logyModule = async () => import('./script.js')

test('E2logy retains the historical detached Zoho API URL without trusting its retired embed as current inventory', async () => {
  const e2logy = await loadE2logyModule()

  assert.equal(
    e2logy.buildZohoJobsApiUrl(),
    'https://e2logy.zohorecruit.com/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  )
  assert.equal(e2logy.hasOfficialCareersSignal(careersHtml), false)
  assert.equal(e2logy.hasVerifiedEmptyCareersSurface(careersHtml), false)
  let parsedReads = 0
  await assert.rejects(e2logy.run({ fetchText: async () => careersHtml, fetchJson: async () => { parsedReads++; return jobsPayload } }), /native careers/i)
  assert.equal(parsedReads, 0, 'The old parsed public feed cannot reestablish current employer authority')
})

const capture = JSON.parse(gunzipSync(readFileSync(new URL('../../scraper-support/tests/fixtures/currentNative20261106C25/capture.json.gz', import.meta.url))))
const corporateURL = 'https://e2logy.com/careers'
const currentNativeHtml = capture.documents[corporateURL].body
const originalPage = url => {
  const page = capture.documents[url]
  assert.ok(page && page.source === 'e2logysoftwaresolutions', `Only retained E2logy literal role entities: ${url}`)
  assert.equal(Buffer.byteLength(page.body), page.bytes, url)
  assert.equal(createHash('sha256').update(page.body).digest('hex'), page.sha256, url)
  return { status: page.status, url: page.finalUrl, headers: page.headers, body: page.body, bodyUnavailable: page.bodyUnavailable }
}

test('E2logy current run replays its two literal corporate role links with full native criteria and closing reads', async () => {
  const e2logy = await loadE2logyModule()
  const urls = []
  const jobs = await e2logy.createE2logySoftwareSolutionsScraper({
    now: () => '2026-11-06T12:00:00.000Z',
  }).run({
    fetchPage: async (url, init) => { urls.push(url); assert.equal(init.method, 'GET'); return originalPage(url) },
    fetchJson: async () => assert.fail('Literal native role documents do not authorize the detached parsed jobs API'),
  })

  const rows = e2logy.extractListings(currentNativeHtml)
  assert.deepEqual(urls, [corporateURL, ...rows.map(row => row.sourceUrl), ...rows.map(row => row.sourceUrl), corporateURL])
  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs.map(job => job.jobId), ['424443000011667046', '424443000011620017'])
  assert.ok(jobs.every(job => job.source === 'e2logysoftwaresolutions' && job.country === 'India' && job.jobDescription.length > 1000))
  assert.ok(jobs.every(job => job.requisitionId === null && job.postingDate === null && job.sourceScopeComplete === false && job.lifecycleCleanupAllowed === false && job.applicationVisited === false))
  assert.equal(jobs.nativeCollectionEvidence.nativeOpeningClosingCriteriaMatch, true)
  assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal, null)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

const historicalEmptyCareersHtml = readFileSync(new URL('./fixtures/current-careers.html', import.meta.url), 'utf8')

test('E2logy rejects the retained historical empty template instead of certifying zero jobs or querying a detached feed', async () => {
  const { run } = await loadE2logyModule()
  await assert.rejects(run({
    fetchPage: async url => ({ status: 200, url, headers: { 'content-type': 'text/html' }, body: historicalEmptyCareersHtml }),
    fetchJson: async () => assert.fail('The retired empty page cannot authorize the detached Zoho feed'),
  }), /Missing or excessive native vacancy cards/i)
})

for (const [name, mutate, error] of [
  ['careers branding changes', html => html.replace('<title>Careers at E2logy | Join Our AI and Software Team</title>', '<title>Other Employer</title>'), /Current employer careers title changed/],
  ['native vacancy cards disappear', html => html.replace(/<article\b[\s\S]*?<\/article>/g, ''), /Missing or excessive native vacancy cards/],
  ['an extra application link appears outside the qualified cohort', html => html.replace('</body>', '<a href="'+Object.keys(capture.documents).find(url => url.includes('/424443000011667046/'))+'">Apply now</a></body>'), /role links outside the qualified card scope/],
  ['a native application link names a different employer', html => html.replace(Object.keys(capture.documents).find(url => url.includes('/424443000011667046/')), 'https://other.example/jobs/role'), /Unbound or duplicate native employer role URL/],
  ['the corporate canonical names a different employer', html => html.replace('href="https://www.e2logy.com/careers"', 'href="https://other.example/careers"'), /canonical/i],
]) {
  test('E2logy fails closed on the current captured careers page when ' + name, async () => {
    const { run } = await loadE2logyModule()
    const html = mutate(currentNativeHtml)
    assert.notEqual(html, currentNativeHtml, 'The fault must mutate the actual current corporate document')
    await assert.rejects(run({ fetchPage: async url => {
      assert.equal(url, corporateURL, 'An invalid corporate binding must stop before native role acquisition')
      return { ...originalPage(url), body: html }
    } }), error)
  })
}

test('E2logy propagates original HTTP 503 even when the body is its historical empty careers template', async (t) => {
  const { run } = await loadE2logyModule()
  const requests = []
  t.mock.method(globalThis, 'fetch', async url => {
    requests.push(url)
    const response = new Response(historicalEmptyCareersHtml, { status: 503, headers: { 'content-type': 'text/html' } })
    Object.defineProperty(response, 'url', { value: url })
    return response
  })
  await assert.rejects(run(), error => error.status === 503 && error.failureKind === 'network_or_timeout' && /HTTP 503/.test(error.message))
  assert.deepEqual(requests, [corporateURL])
})
