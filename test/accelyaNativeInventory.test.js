import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createCatalogScraper, getScraperCatalog } from '../scraper-support/providers/index.js'
import { run } from '../scraper/accelyasolutionsindialimited/script.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'
import { WORKDAY_COUNTRY_INVENTORY_PROOF } from '../scraper-support/myworkday/countryInventoryProof.js'

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('../scraper/accelyasolutionsindialimited/fixtures/native-20261029.json.gz', import.meta.url))))
const consumerFixture = JSON.parse(gunzipSync(readFileSync(new URL('../scraper/accelyasolutionsindialimited/fixtures/corporate-consumers-20261030.json.gz', import.meta.url))))
const official = 'https://w3.accelya.com/careers/'
const api = 'https://accelya.wd103.myworkdayjobs.com/wday/cxs/accelya/Careers/jobs'
const scheduler = { acquire: async () => () => {}, recordRateLimit: () => {} }
const provider = getScraperCatalog().find(row => row.source === 'accelyasolutionsindialimited')
const execute = async (t, { change = () => {}, options = {}, registered = false } = {}) => {
  const state = { responses: { ...structuredClone(fixture.responses), ...structuredClone(consumerFixture.consumerResponses) }, calls: [], listings: 0 }
  t.mock.method(globalThis, 'fetch', async (input, init = {}) => {
    const url = String(input), method = init.method || 'GET'
    init.signal?.throwIfAborted()
    const body = init.body ? JSON.parse(init.body) : undefined
    state.calls.push({ url, method, body })
    // This exact historical parameter reproduces the real native HTTP400.
    if (url === api && body?.appliedFacets?.Location_Country) return new Response('{"errorCode":"HTTP_400","httpStatus":400}', { status: 400 })
    const captured = state.responses[`${method} ${url}`]
    assert.ok(captured, `Unexpected public request ${method} ${url}`)
    const current = structuredClone(captured)
    if (url === api) state.listings++
    change(current, url, state)
    const response = new Response(current.body, { status: current.status, headers: { 'content-type': current.contentType } })
    Object.defineProperty(response, 'url', { value: current.url })
    return response
  })
  const args = { requestScheduler: scheduler, retryBaseDelayMs: 0, requestTimeoutMs: 1000,
    now: () => '2026-10-30T00:00:00.000Z', ...options }
  const jobs = await (registered ? createCatalogScraper(provider).run(args) : run(args))
  return { jobs, evidence: readInventoryEvidence(jobs), calls: state.calls }
}

test('Accelya catalog advertises its current native Workday contract', () => {
  assert.equal(provider.atsPlatform, 'officially-linked-workday-cxs')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /accelyasolutionsindialimited[\\/]script\.js$/)
  assert.doesNotMatch(provider.extractionStrategy, /return-empty|api-failure/)
})

test('Accelya current native inventory recovers nine India roles with full criteria from thirteen postings', async t => {
  const { jobs, evidence, calls } = await execute(t)
  assert.equal(jobs.length, 9)
  assert.equal(new Set(jobs.map(job => job.jobId)).size, 9)
  assert.ok(jobs.every(job => job.country === 'India' && job.sourceDetailComplete === true && job.sourceListingComplete === true))
  assert.ok(jobs.every(job => job.jobDescription.length > 1000 && job.company === job.nativeEmployer))
  assert.equal(jobs.find(job => job.jobId === 'JR102564').company, 'Accelya Services India Private Limited')
  assert.equal(evidence.listingComplete, true)
  assert.equal(evidence.indiaFacetCount, 9)
  assert.equal(jobs[WORKDAY_COUNTRY_INVENTORY_PROOF].boards[0].reportedTotal, 13)
  assert.ok(calls.filter(call => call.url === api).every(call => Object.keys(call.body.appliedFacets).length === 0 && call.body.searchText === ''))
})

test('Accelya registered catalog entry preserves complete native evidence and all nine identities', async t => {
  const { jobs, evidence } = await execute(t, { registered: true })
  assert.equal(jobs.length, 9)
  assert.equal(evidence.listingComplete, true)
  assert.equal(jobs[WORKDAY_COUNTRY_INVENTORY_PROOF].completeSourceScope, true)
})

test('Accelya another active hiring inventory keeps source coverage unknown while retaining proven India jobs', async t => {
  const { jobs, evidence } = await execute(t, { change: (row, url) => {
    if (url === official) row.body += '<a href="https://jobs.ashbyhq.com/another"><img alt="More"></a>'
  } })
  assert.equal(jobs.length, 9)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.indiaFacetCount, null)
  assert.ok(jobs.every(job => job.sourceListingComplete === false && job.lifecycleCleanupAllowed === false))
})

for (const [label, addition] of [
  ['application form', '<form action="https://recruiting.example/apply"><input name="resume"><button>Apply</button></form>'],
  ['external hiring script', '<script src="https://boards.greenhouse.io/embed/job_board/js?for=another"></script>'],
  ['new inline script', '<script>window.currentHiringBoard="https://recruiting.example/openings"</script>'],
  ['data-configured hiring widget', '<div data-hiring-url="https://jobs.ashbyhq.com/another"></div>'],
]) test(`Accelya unreviewed ${label} retains known jobs with unknown source coverage`, async t => {
  const { jobs, evidence } = await execute(t, { change: (row, url) => { if (url === official) row.body += addition } })
  assert.equal(jobs.length, 9)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.indiaFacetCount, null)
  assert.ok(jobs.every(job => job.lifecycleCleanupAllowed === false))
})

test('Accelya foreign listing with unreviewed additional country cannot certify source scope', async t => {
  const { jobs, evidence } = await execute(t, { change: (row, url) => {
    if (url === api) {
      const payload = JSON.parse(row.body); payload.jobPostings[0].additionalCountries = ['India']; row.body = JSON.stringify(payload)
    }
  } })
  assert.equal(jobs.length, 9)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.indiaFacetCount, null)
})

test('Accelya nested country under a reviewed detail field remains unresolved', async t => {
  const { jobs, evidence } = await execute(t, { change: (row, url) => {
    if (url.includes('/job/Colombia-Bogota/Software-Engineer---OpenConnect--OC-_JR102587')) {
      const payload = JSON.parse(row.body); payload.jobPostingInfo.remoteType = { descriptor: payload.jobPostingInfo.remoteType, additionalCountries: ['India'] }; row.body = JSON.stringify(payload)
    }
  } })
  assert.equal(jobs.length, 9)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.indiaFacetCount, null)
})

test('Accelya unreviewed mandatory criteria revoke only the affected India role detail proof', async t => {
  const { jobs, evidence } = await execute(t, { change: (row, url) => {
    if (url.includes('/job/India-Mumbai/Engineer-II---Quality-Assurance_JRS0076')) {
      const payload = JSON.parse(row.body); payload.jobPostingInfo.additionalQualificationRequirements = 'A newly required mandatory professional license.'; row.body = JSON.stringify(payload)
    }
  } })
  assert.equal(jobs.length, 9)
  assert.equal(jobs.find(job => job.jobId === 'JRS0076').sourceDetailComplete, false)
  assert.equal(jobs.filter(job => job.sourceDetailComplete).length, 8)
  assert.equal(evidence.listingComplete, false)
})

test('Accelya final raw closing criteria changes cannot retain an old full-detail claim', async t => {
  const { jobs, evidence } = await execute(t, { change: (row, url, state) => {
    if (url.includes('/job/India-Mumbai/Engineer-II---Quality-Assurance_JRS0076') && state.listings === 5) {
      const payload = JSON.parse(row.body); payload.jobPostingInfo.jobDescription += '<p>A newly required mandatory professional license.</p>'; row.body = JSON.stringify(payload)
    }
  } })
  assert.equal(jobs.length, 9)
  assert.equal(jobs.find(job => job.jobId === 'JRS0076').sourceDetailComplete, false)
  assert.equal(jobs.filter(job => job.sourceDetailComplete).length, 8)
  assert.equal(evidence.listingComplete, false)
})

test('Accelya raw typed country conflict cannot retain an India role proof from other reads', async t => {
  const { jobs, evidence } = await execute(t, { change: (row, url, state) => {
    if (url.includes('/job/India-Mumbai/Engineer-II---Quality-Assurance_JRS0076') && [1, 5].includes(state.listings)) {
      const payload = JSON.parse(row.body); payload.jobPostingInfo.country = { descriptor: 'United States of America', id: 'bc33aa3152ec42d4995f4791a106ed09' }; row.body = JSON.stringify(payload)
    }
  } })
  assert.equal(jobs.length, 9)
  assert.equal(jobs.find(job => job.jobId === 'JRS0076').sourceDetailComplete, false)
  assert.equal(evidence.listingComplete, false)
})

test('Accelya extracted closing date must match the raw closed native cohort', async t => {
  const { jobs, evidence } = await execute(t, { change: (row, url, state) => {
    if (url.includes('/job/India-Mumbai/Engineer-II---Quality-Assurance_JRS0076') && [2, 4].includes(state.listings)) {
      const payload = JSON.parse(row.body); payload.jobPostingInfo.endDate = '2026-12-31'; row.body = JSON.stringify(payload)
    }
  } })
  assert.equal(jobs.length, 9)
  assert.equal(jobs.find(job => job.jobId === 'JRS0076').sourceDetailComplete, false)
  assert.equal(evidence.listingComplete, false)
})

test('Accelya a contradictory raw native India country ID revokes the affected role proof', async t => {
  const { jobs, evidence } = await execute(t, { change: (row, url, state) => {
    if (url.includes('/job/India-Mumbai/Engineer-II---Quality-Assurance_JRS0076') && [1, 5].includes(state.listings)) {
      const payload = JSON.parse(row.body); payload.jobPostingInfo.country.id = 'e8106cd6a3534f2dba6fdee2d41db89d'; row.body = JSON.stringify(payload)
    }
  } })
  assert.equal(jobs.find(job => job.jobId === 'JRS0076').sourceDetailComplete, false)
  assert.equal(evidence.listingComplete, false)
})

for (const field of ['jobPostingSiteId', 'jobPostingId']) test(`Accelya closed raw ${field} must identify the extracted native posting`, async t => {
  const { jobs, evidence } = await execute(t, { change: (row, url, state) => {
    if (url.includes('/job/India-Mumbai/Engineer-II---Quality-Assurance_JRS0076') && [1, 5].includes(state.listings)) {
      const payload = JSON.parse(row.body); payload.jobPostingInfo[field] = 'foreign-native-identity'; row.body = JSON.stringify(payload)
    }
  } })
  assert.equal(jobs.find(job => job.jobId === 'JRS0076').sourceDetailComplete, false)
  assert.equal(evidence.listingComplete, false)
})

test('Accelya reviewed non-hiring cookie expiry and viewport parameters may vary without losing native coverage', async t => {
  const { jobs, evidence } = await execute(t, { change: (row, url) => {
    if (url === official) row.body = row.body.replace('Fri, 30 Oct 2026 18:02:20 GMT', 'Sat, 31 Oct 2026 18:02:20 GMT')
      .replace('"is_mobile":true,"width_threshold":393,"height_threshold":830', '"is_mobile":false,"width_threshold":1600,"height_threshold":700')
      .replace('wpr_preload_links wpr_mobile', 'wpr_preload_links wpr_desktop')
  } })
  assert.equal(jobs.length, 9)
  assert.equal(evidence.listingComplete, true)
})

test('Accelya extra code after a reviewed configuration literal invalidates source coverage', async t => {
  const { evidence } = await execute(t, { change: (row, url) => {
    if (url === official) row.body = row.body.replace('//# sourceURL=wpml-cookie-js-extra', '//# sourceURL=wpml-cookie-js-extra\nwindow.extraHiring="https://jobs.ashbyhq.com/another";')
  } })
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.indiaFacetCount, null)
})

test('Accelya foreign employer newly advertising India cannot bypass native employer checks', async t => {
  await assert.rejects(execute(t, { change: (row, url) => {
    if (url.includes('/job/Colombia-Bogota/Software-Engineer---OpenConnect--OC-_JR102587')) {
      const payload = JSON.parse(row.body); payload.jobPostingInfo.additionalLocations = ['India, Mumbai']; row.body = JSON.stringify(payload)
    }
  } }), /native employer unavailable or mismatched|native.*country|scope/i)
})

test('Accelya failed native inventory does not become verified empty', async t => {
  await assert.rejects(execute(t, { change: (row, url) => {
    if (url === api) row.body = '{"errorCode":"HTTP_500","httpStatus":500}'
  } }), /HTTP|inventory|Workday|payload|scope/i)
})

test('Accelya changed closing inventory cannot certify source coverage', async t => {
  await assert.rejects(execute(t, { change: (row, url, state) => {
    if (url === api && state.listings > 2) {
      const payload = JSON.parse(row.body); payload.jobPostings[0].title += ' changed'; row.body = JSON.stringify(payload)
    }
  } }), /closing|identity|changed|inventory/i)
})

test('Accelya raw audits must match the exact global inventory certified by the native engine', async t => {
  const { jobs, evidence } = await execute(t, { change: (row, url, state) => {
    if (url === api && state.listings >= 2 && state.listings <= 4) {
      const payload = JSON.parse(row.body); payload.jobPostings[0].title += ' transient revision'; row.body = JSON.stringify(payload)
    } else if (url.includes('/job/Colombia-Bogota/Software-Engineer---OpenConnect--OC-_JR102587') && state.listings === 2) {
      const payload = JSON.parse(row.body); payload.jobPostingInfo.title += ' transient revision'; row.body = JSON.stringify(payload)
    }
  } })
  assert.equal(jobs.length, 9)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.indiaFacetCount, null)
})

test('Accelya contradictory native country evidence remains unresolved', async t => {
  await assert.rejects(execute(t, { change: (row, url) => {
    if (url.includes('/job/India-Mumbai/Engineer-II---Quality-Assurance_JRS0076')) {
      const payload = JSON.parse(row.body); payload.jobPostingInfo.country = { descriptor: 'Colombia', id: 'e8106cd6a3534f2dba6fdee2d41db89d' }; row.body = JSON.stringify(payload)
    }
  } }), /country|scope|location|native/i)
})

test('Accelya native proof requires the observed first-party response URL', async t => {
  await assert.rejects(execute(t, { change: (row, url) => { if (url === official) row.url = 'https://other.example/careers' } }), /response|URL|identity|careers|scope/i)
})

test('Accelya explicit inventory caps are rejected before source certification', async t => {
  await assert.rejects(execute(t, { options: { maxJobs: 1 } }), /cap|limit/i)
})

test('Accelya pre-aborted source check never requests a native page', async t => {
  const controller = new AbortController(); controller.abort(new Error('Accelya check cancelled'))
  await assert.rejects(execute(t, { options: { signal: controller.signal } }), /cancelled/)
})
