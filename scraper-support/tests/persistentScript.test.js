import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { createHash } from 'node:crypto'
import { getScraperCatalog, createCatalogScraper } from '../providers/index.js'
import { gunzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { buildJobDetailUrl, buildSearchPayload, createPersistentScraper, extractJobDetail, extractPaginationSummary, extractSearchResults } from '../../scraper/persistent/script.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'persistent')
const text = name => gunzipSync(readFileSync(path.join(dir, name))).toString('utf8')
const json = name => JSON.parse(text(name))
const SEARCH = 'https://public.zwayam.com/jobs/search'
const DETAIL = 'https://public.zwayam.com/jobs-service/v1/jobs/careersite'
const row = () => json('current-search.json.gz').data.data[0]._source
const nativeDetail = () => json('current-detail.json.gz')
const clone = value => structuredClone(value)
const response = (rows, { total = rows.length, hasMore = false, size = 1 } = {}) => {
  const payload = json('current-search.json.gz')
  Object.assign(payload.data, { data: rows.map(_source => ({ _source: clone(_source) })), totalCount: total, hasMoreData: hasMore })
  payload.data.facetedSearchConfig.paginationHowMuch = String(size)
  payload.data.facets.Location = [{ key: 'India', doc_count: total }]
  return payload
}
const setup = ({ rows = [row()], detailTransform = d => d, searchTransform = p => p, reqTransform = p => p, configTransform = p => p, mainTransform = t => t, shellTransform = t => t, officialTransform = r => r, beforeApi = () => {}, ...options } = {}) => {
  let searches = 0
  const details = rows.map((r, i) => { const d = nativeDetail(); Object.assign(d, { id: r.id, jobCode: r.jobCode, jobTitle: r.jobTitle, jobUrl: r.jobUrl, location: r.location, locationDisplayForManageJobs: r.locationDisplayForManageJobs, referenceNumber: r.referenceNumber }); d.jobConfigurationData.Location = r.location; d.jobConfigurationData['Job Code'] = String(r.jobCode); return detailTransform(d, i) })
  return createPersistentScraper({
    requestIntervalMs: 0,
    fetchTextImpl: async url => {
      if (url === 'https://www.persistent.com/careers/') return officialTransform({ text: shellTransform(text('current-careers.html.gz')), finalUrl: 'https://careers.persistent.com/' })
      if (url === 'https://careers.persistent.com/explore-opportunities') return { text: shellTransform(text('current-careers.html.gz')), finalUrl: url }
      if (url === 'https://careers.persistent.com/main.be21217dba32513f.js') return { text: mainTransform(text('current-main.js.gz')), finalUrl: url }
      throw new Error(`Unexpected document ${url}`)
    },
    fetchJsonImpl: async (url, request) => {
      request?.signal?.throwIfAborted()
      beforeApi(url, request)
      if (url === 'https://public.zwayam.com/data-service/v2/company/16344/careersite-configurations') return configTransform(json('current-company.json.gz'))
      if (url === SEARCH) {
        assert.equal(request.method, 'POST')
        assert.equal(request.body.get('companyId'), 'MTYzNDQ=')
        assert.equal(request.body.get('domain'), 'careers.persistent.com')
        const filter = JSON.parse(request.body.get('filterCri'))
        return searchTransform(response(rows.slice(filter.paginationStartNo, filter.paginationStartNo + 1), { total: rows.length, hasMore: filter.paginationStartNo + 1 < rows.length }), searches++, filter.paginationStartNo)
      }
      if (url === DETAIL) {
        assert.equal(request.method, 'POST')
        const body = JSON.parse(request.body)
        assert.equal(body.companyId, '16344')
        assert.equal(body.externalSource, 'CareerSite')
        const d = details[rows.findIndex(r => Number(r.id) === Number(body.jobId))]
        assert.equal(body.jobUrl, d.jobUrl)
        return clone(d)
      }
      if (/^https:\/\/public\.zwayam\.com\/requisition_service\/getReqFieldsForCareersSite\/\d+\/16344$/.test(url)) return reqTransform(json('current-requisition.json.gz'))
      throw new Error(`Unexpected API ${url}`)
    }, ...options,
  })
}
const withPostedDate = d => { d.jobConfigurationData['Posted On'] = '2026-10-25T00:00:00.000Z'; return d }

test('current Persistent public contract binds account16344 and native URL includes internal ID', () => {
  assert.equal(buildSearchPayload().companyId, 'MTYzNDQ=')
  assert.equal(JSON.parse(buildSearchPayload({ page: 2 }).filterCri).paginationStartNo, 9)
  assert.equal(buildJobDetailUrl('native-role', 1061575), 'https://careers.persistent.com/jobview/native-role?id=1061575')
})
test('current real search preserves explicit India country and native reference separately', () => {
  const jobs = extractSearchResults(json('current-search.json.gz'))
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].nativePostingId, '1061575')
  assert.equal(jobs[0].nativeReferenceNumber, 'PSLP_0000001R')
  assert.equal(jobs[0].requisitionId, null)
  assert.equal(jobs[0].postingDate, null)
})
test('country substring and familiar city never establish India authority', () => {
  const r = row(); r.text1 = 'Indian Ocean'; r.jobLocationRecord = [{ country: 'Indian Ocean', city: 'Pune' }]
  assert.equal(extractSearchResults(response([r])).length, 0)
  r.text1 = null; r.jobLocationRecord = [{ city: 'Pune' }]
  assert.equal(extractSearchResults(response([r])).length, 0)
})
test('current real detail reads the complete visible nested model and refuses created-date fallback', () => {
  const d = extractJobDetail(nativeDetail(), extractSearchResults(response([row()]))[0])
  assert.equal(d.title, 'Snowflake Data Engineer')
  assert.equal(d.postingDate, null)
  assert.equal(d.requisitionId, null)
  assert.deepEqual(d.requiredSkills, ['DevOps'])
  assert.equal(d.experienceRequired, '11-15 years')
  assert.match(d.jobDescription, /Design, develop, and manage scalable data ingestion/)
  assert.match(d.jobDescription, /prohibits discrimination and harassment of any kind/)
  assert.equal(d.sourceDetailComplete, true)
  assert.equal(d.sourcePublicationDateComplete, false)
})
test('only native visible Posted On is used as publication date and modified-date configuration invalidates it', () => {
  const d = withPostedDate(nativeDetail())
  assert.equal(extractJobDetail(d).postingDate, '2026-10-25')
  d.modifiedDateConfiguredForCareerSiteView = true
  assert.equal(extractJobDetail(d).postingDate, null)
})
test('pagination rejects absent count and non-boolean terminal markers', () => {
  assert.throws(() => extractPaginationSummary({ data: { data: [], hasMoreData: false } }), /count|contract/i)
  assert.throws(() => extractPaginationSummary({ data: { data: [], totalCount: 0, hasMoreData: 'false' } }), /pagination|contract/i)
})
test('unknown original publication date is explicit and does not defeat reconciled native inventory', async () => {
  const jobs = await setup().run()
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].sourceDetailComplete, true)
  assert.equal(jobs[0].sourceScopeComplete, true)
  assert.equal(jobs[0].sourceListingComplete, true)
  assert.equal(jobs[0].sourcePublicationDateUnavailable, true)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
  assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory')
})
test('complete native details and matching closing enumeration establish inventory only with explicit dates', async () => {
  const jobs = await setup({ detailTransform: withPostedDate }).run()
  assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory')
  assert.equal(jobs[0].sourceNativeInventory.pagesFetched, 2)
  assert.equal(jobs[0].sourceNativeInventory.detailsFetched, 1)
  assert.equal(jobs[0].sourceNativeInventory.closingStable, true)
})
test('caps apply after every native page and full detail and force partial evidence', async () => {
  const r2 = row(); Object.assign(r2, { id: 1061623, jobCode: 106851, jobUrl: 'salesforce-lead-india-salesforce-2024101615280278', jobTitle: 'Salesforce Health Cloud Developer', referenceNumber: 'PSLH_0000006Z' })
  const jobs = await setup({ rows: [row(), r2], detailTransform: withPostedDate }).run({ maxJobs: 1, maxPages: 1 })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].sourceNativeInventory.detailsFetched, 2)
  assert.equal(jobs[0].sourceNativeInventory.pagesFetched, 4)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 2)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})
test('company name/account mismatch fails before accepting listing records', async () => {
  await assert.rejects(setup({ configTransform: p => { p.reponseObject.company.companyName = 'Other Employer'; return p } }).run(), /identity|binding|employer/i)
})
test('untrusted native endpoint in first-party client cannot authorize POSTs', async () => {
  await assert.rejects(setup({ mainTransform: t => t.replaceAll('https://public.zwayam.com/', 'https://unrelated.example/') }).run(), /binding|endpoint|contract/i)
})
test('mismatching native detail identity never falls back to listing snippets', async () => {
  const jobs = await setup({ detailTransform: d => { d.id = 999; return d } }).run()
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
})
test('missing full visible description never falls back to the listing summary', async () => {
  const jobs = await setup({ detailTransform: d => { delete d.jobConfigurationData.Description; return d } }).run()
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
})
test('native extra requisition fields form part of full displayed detail', async () => {
  const jobs = await setup({ reqTransform: p => { p.reponseObject.customDetails = { 'Minimum Qualification': '<p>Bachelor of Technology</p>', 'Requisition ID': 'PSL-NATIVE-29' }; return p } }).run()
  assert.match(jobs[0].jobDescription, /Minimum Qualification: Bachelor of Technology/)
  assert.equal(jobs[0].minimumQualification, 'Bachelor of Technology')
  assert.equal(jobs[0].requisitionId, 'PSL-NATIVE-29')
})
test('changed closing country/status proof excludes the stale row and stays partial', async () => {
  const jobs = await setup({ detailTransform: withPostedDate, searchTransform: (p, i) => { if (i) p.data.data[0]._source.displayStatus = 'Closed'; return p } }).run()
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})
test('unknown countries make a nonempty global inventory partial without guessed India rows', async () => {
  const r = row(); r.text1 = null; r.jobLocationRecord = [{ city: 'Pune' }]
  const jobs = await setup({ rows: [r] }).run()
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
})
test('native empty response still requires employer binding and stable closing count', async () => {
  const jobs = await setup({ rows: [] }).run()
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'verified-empty')
})
test('run forwards cancellation before public access', async () => {
  const controller = new AbortController(); controller.abort(new Error('persistent-cancelled'))
  await assert.rejects(setup().run({ signal: controller.signal }), /persistent-cancelled/)
})

test('access denial stops further detail scheduling and preserves partial evidence without a closing retry', async () => {
  const rows = Array.from({ length: 20 }, (_, i) => ({ ...row(), id: 1061575 + i, jobCode: 106803 + i, jobUrl: `native-role-${i}` }))
  const jobs = await setup({ rows, beforeApi: (url, request) => {
    if (url === DETAIL && JSON.parse(request.body).jobId > 1061575) { const error = new Error('HTTP 403 access denied'); error.status = 403; throw error }
  } }).run()
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.match(readInventoryEvidence(jobs).reason, /public.*403|denied/i)
  // No completion is inferred when public permission ended; all omitted roles stay unresolved.
  assert.ok(jobs.length <= 1)
  if (jobs.length) { assert.ok(jobs[0].sourceNativeInventory.detailsFetched <= 5); assert.equal(jobs[0].sourceNativeInventory.closingStable, false) }
})
test('closing search failure preserves previously complete details as partial and never certifies closure', async () => {
  let searches = 0
  const jobs = await setup({ beforeApi: url => { if (url === SEARCH && ++searches === 2) { const error = new Error('HTTP 503 closing unavailable'); error.status = 503; throw error } } }).run()
  assert.equal(jobs.length, 1)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(jobs[0].sourceNativeInventory.closingStable, false)
})
test('known non-India global inventory is complete with zero India count without a bare empty certificate', async () => {
  const r = clone(json('current-search.json.gz').data.data[3]._source)
  const jobs = await setup({ rows: [r], searchTransform: p => { p.data.facets.Location = [{ key: 'United States', doc_count: 1 }]; return p } }).run()
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory')
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 0)
})
test('configured description shorter than native full body is unresolved instead of silently truncated', async () => {
  const jobs = await setup({ detailTransform: d => { d.jobConfigurationData.Description = '<p>A public summary copied here with more than one hundred characters to resemble a plausible but incomplete role description.</p>'; return d } }).run()
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
})

test('global country contradictions are counted even after early native access denial', async () => {
  const rows = Array.from({ length: 20 }, (_, i) => ({ ...row(), id: 1061575 + i, jobCode: 106803 + i, jobUrl: `native-role-${i}` }))
  rows[19].text1 = 'United States'
  const jobs = await setup({ rows, beforeApi: (url, request) => {
    if (url === DETAIL && JSON.parse(request.body).jobId > 1061575) { const error = new Error('HTTP 403 access denied'); error.status = 403; throw error }
  } }).run()
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].sourceNativeInventory.unknownCountries, 1)
  assert.equal(jobs[0].sourceNativeInventory.nonIndia, 1)
})

test('registered Persistent path replays exact captured622-role native inventory and stops on retained403 evidence', async () => {
  const captured = json('current-native-capture.json.gz')
  const key = (url, method, body) => JSON.stringify([url, method, body])
  const grouped = new Map(), reads = new Map()
  for (const { response, rawBody } of captured) {
    assert.equal(createHash('sha256').update(rawBody).digest('hex'), response.sha256)
    const k = key(response.url, response.method, response.requestBody)
    grouped.set(k, [...(grouped.get(k) || []), { response, rawBody }])
  }
  const replay = async (url, options = {}) => {
    const body = !options.body ? null : options.body instanceof FormData ? Object.fromEntries(options.body.entries()) : JSON.parse(options.body)
    const k = key(url, options.method || 'GET', body), index = reads.get(k) || 0
    reads.set(k, index + 1)
    const entry = grouped.get(k)?.[index]
    assert.ok(entry, `Missing captured response for ${url}`)
    if (entry.response.status !== 200) { const error = new Error(`HTTP ${entry.response.status} for ${url}`); error.status = entry.response.status; throw error }
    return entry
  }
  const provider = getScraperCatalog().find(p => p.source === 'persistent')
  const jobs = await createCatalogScraper(provider).run({ requestIntervalMs: 0,
    fetchTextImpl: async (url, options) => { const e = await replay(url, options); return { text: e.rawBody, finalUrl: e.response.finalUrl } },
    fetchJsonImpl: async (url, options) => JSON.parse((await replay(url, options)).rawBody),
  })
  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs.map(j => j.nativePostingId), ['1061575', '1061623'])
  assert.equal(jobs[0].sourceNativeInventory.reportedTotal, 622)
  assert.equal(jobs[0].sourceNativeInventory.indiaFacetCount, 585)
  assert.equal(jobs[0].sourceNativeInventory.indiaRecords, 584)
  assert.equal(jobs[0].sourceNativeInventory.unknownCountries, 3)
  assert.equal(jobs[0].sourceNativeInventory.nonIndia, 38)
  assert.equal(jobs[0].sourceNativeInventory.completeDetails, 9)
  assert.equal(jobs[0].sourceNativeInventory.detailsFetched, 10)
  assert.equal(jobs[0].sourceNativeInventory.detailBodiesFetched, 10)
  assert.equal(jobs[0].sourceNativeInventory.requisitionBodiesFetched, 9)
  assert.equal(jobs[0].sourceNativeInventory.detailsUnattempted, 612)
  assert.equal(jobs[0].sourceNativeInventory.publicFailureStatus, 403)
  assert.equal(jobs[0].sourceNativeInventory.closingStable, false)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.ok(jobs.every(j => j.postingDate === null && j.requisitionId === null && j.sourceDetailComplete === true && j.lifecycleCleanupAllowed === false))
})

test('native future closing date survives while impossible publication dates remain unknown', () => {
  const detail = nativeDetail()
  detail.jobConfigurationData['Closing Date'] = '2026-12-31'
  detail.jobConfigurationData['Posted On'] = '2026-02-31'
  const job = extractJobDetail(detail)
  assert.equal(job.closingDate, '2026-12-31')
  assert.equal(job.postingDate, null)
})
test('unknown structured requisition attributes remain unresolved instead of becoming object strings', async () => {
  const jobs = await setup({ reqTransform: p => { p.reponseObject.customDetails = { 'Native Qualification': { required: ['A', 'B'] } }; return p } }).run()
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
})

for (const [name, wrap] of [
  ['hidden attribute', html => `<div hidden>${html}</div>`],
  ['inert container', html => `<div inert>${html}</div>`],
  ['CSS-hidden container', html => `<style>.native-jd { display:none }</style><div class="native-jd">${html}</div>`],
]) test(`hidden native full descriptions cannot establish completeness: ${name}`, async () => {
  const jobs = await setup({ detailTransform: d => { d.jobConfigurationData.Description = wrap(d.jobConfigurationData.Description); d.longDescription = wrap(d.longDescription); return d } }).run()
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
})
test('displayed nested foreign location contradicting typed India geography is unresolved', async () => {
  const jobs = await setup({ detailTransform: d => { d.jobConfigurationData.Location = 'Toronto, Ontario, Canada'; return d } }).run()
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.match(readInventoryEvidence(jobs).reason, /geography|location/)
})
test('expired native visible closing date excludes role and retains a partial source result', async () => {
  const jobs = await setup({ detailTransform: d => { d.jobConfigurationData['Closing Date'] = '2025-01-01'; return d } }).run()
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.match(readInventoryEvidence(jobs).reason, /expir/)
})
test('expired bound native endtDate is honored even without a visible closing label', async () => {
  const r = row(); r.endtDate = '2025-01-01'
  const jobs = await setup({ rows: [r] }).run()
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.match(readInventoryEvidence(jobs).reason, /expir/)
})
test('closing enumeration changes to native expiry cannot retain a stale role', async () => {
  const jobs = await setup({ searchTransform: (p, i) => { if (i) p.data.data[0]._source.endtDate = '2025-01-01'; return p } }).run()
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
})
test('arbitrary nonempty country labels cannot certify zero India coverage', async () => {
  const r = row(); r.text1 = 'Unknown'; r.jobLocationRecord = [{ country: 'Unknown', city: 'Pune' }]
  const jobs = await setup({ rows: [r], searchTransform: p => { p.data.facets.Location = [{ key: 'Unknown', doc_count: 1 }]; return p } }).run()
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.match(readInventoryEvidence(jobs).reason, /country/)
})
for (const [kind, snippet] of [
  ['anchor', '<a href="https://persistent.wd5.myworkdayjobs.com/External">Careers</a>'],
  ['script', '<script src="https://persistent.wd5.myworkdayjobs.com/External/embed.js"></script>'],
  ['iframe', '<iframe src="https://persistent.wd5.myworkdayjobs.com/External"></iframe>'],
]) test(`additional active ATS ${kind} prevents empty inventory certification`, async () => {
  const jobs = await setup({ rows: [], shellTransform: html => html.replace('</body>', `${snippet}</body>`) }).run()
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.match(readInventoryEvidence(jobs).reason, /additional.*scope|unaccounted/)
})
test('inert ATS template cannot create an active employer scope', async () => {
  const snippet = '<template><a href="https://persistent.wd5.myworkdayjobs.com/External">Careers</a><iframe src="https://persistent.wd5.myworkdayjobs.com/External"></iframe></template>'
  const jobs = await setup({ rows: [], shellTransform: html => html.replace('</body>', `${snippet}</body>`) }).run()
  assert.equal(readInventoryEvidence(jobs).status, 'verified-empty')
})

test('additional ATS on an official handoff document remains unresolved even when the native shell is unchanged', async () => {
  const jobs = await setup({ rows: [], officialTransform: () => ({ finalUrl: 'https://www.persistent.com/careers/', text: '<a href="https://careers.persistent.com/">Persistent jobs</a><a href="https://persistent.wd5.myworkdayjobs.com/External">Other careers</a>' }) }).run()
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.match(readInventoryEvidence(jobs).reason, /additional.*scope|unaccounted/)
})
