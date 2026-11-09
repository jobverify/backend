import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import * as source from '../../scraper/sharechat/script.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { getScraperCatalog } from '../providers/index.js'

const fixture = name => JSON.parse(readFileSync(new URL(`./fixtures/sharechat/native-20261024/${name}.json`, import.meta.url)))
const listing = fixture('listing'), tenant = fixture('tenant'), dates = fixture('publication-dates')
const rows = listing.data.careersList.flatMap(group => group.data)
const roles = new Map(rows.map(row => [row.requisitionId, fixture(`role-${row.requisitionId}`)]))
const originalFetch = globalThis.fetch
test.before(() => { globalThis.fetch = async () => ({ ok: true, json: async () => structuredClone(listing) }) })
test.after(() => { globalThis.fetch = originalFetch })
const native = 'https://sharechat.prod.us1.mynexthire.io/d17/careers/requisition/object'
const tenantUrl = 'https://sharechat.mynexthire.com/employer/jobboard/details_by_shortname/get/sharechat/'
const datesUrl = 'https://sharechat.mynexthire.com/ats/public-apis/v1/careers/job-posting-dates/list'
const clock = () => '2026-10-24T18:38:55.294Z'
const receipt = (url, payload) => ({ status: 200, url, html: JSON.stringify(payload) })
const request = async (url, options = {}) => {
  if (url === source.buildSearchUrl()) return receipt(url, listing)
  if (url === tenantUrl) return receipt(url, tenant)
  if (url === datesUrl) {
    assert.equal(options.method, 'POST')
    const body = JSON.parse(options.body)
    assert.equal(body.srcShortName, 'careers')
    assert.ok(body.requisitionIdList.every(id => roles.has(id)))
    return receipt(url, { ...dates, data: { careersJobPostingDatesList: dates.data.careersJobPostingDatesList.filter(row => body.requisitionIdList.includes(row.requisitionId)) } })
  }
  if (url === native) {
    assert.equal(options.method, 'POST')
    const body = JSON.parse(options.body)
    assert.deepEqual(body, { source: 'careers', id: '', code: '', reqId: body.reqId })
    assert.ok(roles.has(body.reqId))
    return receipt(url, roles.get(body.reqId))
  }
  throw Error('Unexpected ShareChat request: ' + url)
}
const execute = options => source.run({ now: clock, requestIntervalMs: 0, fetchPage: request, ...options })

test('actual ShareChat native inventory joins 11 exact role JDs with native publishedOn and keeps partial coverage', async () => {
  const jobs = await execute()
  assert.equal(jobs.length, 11)
  const job = jobs.find(job => job.jobId === '2478')
  assert.equal(job.title, 'Intern - Content Moderation (Hindi & Punjabi)')
  assert.equal(job.jobDescription, roles.get(2478).data.reqDetailsBO.jdDisplay)
  assert.equal(job.sourceDescription, roles.get(2478).data.reqDetailsBO.jdDisplay)
  assert.equal(job.jobDescriptionHtml, roles.get(2478).data.reqDetailsBO.jdDisplay)
  assert.equal(job.postingDate, '2026-10-13T08:12:12.573Z')
  assert.equal(job.sourceNativeDates.publishedOn, 1791879132573)
  assert.equal(job.sourceNativeDates.createdDate, 1791813264311)
  assert.equal(job.sourceNativeDates.approvedDate, 1791876350971)
  assert.equal(job.country, 'India')
  assert.equal(job.city, 'Bangalore')
  assert.equal(job.sourceNativeLocations[0].country, null)
  assert.equal(job.sourceNativeLocations[0].office, 'Bangalore')
  assert.match(job.sourceNativeLocations[0].address, /Bengaluru, Karnataka 560029/)
  assert.equal(job.sourceNativeCountryEvidence.method, 'role-assigned-office-trusted-india-city')
  assert.equal(job.sourceNativeEmployerEvidence.clientId, 1109)
  assert.equal(job.sourceNativeStatusEvidence.statusId, 3)
  assert.equal(job.sourceNativeStatusEvidence.requisitionPublished, true)
  assert.equal(job.applyUrl, source.buildJobUrl(2478))
  assert.equal(job.sourceUrl, source.buildJobUrl(2478))
  assert.equal(job.sourceListingComplete, false)
  assert.equal(job.lifecycleCleanupAllowed, false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
  const mumbai = jobs.find(job => job.jobId === '2443')
  assert.equal(mumbai.city, 'Mumbai')
  assert.equal(mumbai.sourceNativeLocations[0].address, 'Mumbai')
  const india = jobs.find(job => job.jobId === '2450')
  assert.equal(india.city, null)
  assert.equal(india.location, 'India')
  assert.equal(india.sourceNativeLocations[0].country, null)
  assert.equal(india.sourceNativeCountryEvidence.method, 'role-assigned-explicit-india-label')
})

test('ShareChat catalog metadata never promotes the partial native route inventory to whole-company counts', () => {
  const provider = getScraperCatalog().find(item => item.source === 'sharechat')
  assert.equal(provider.sourceScopeComplete, false)
  assert.equal(provider.verifiedPublicJobCount, null)
  assert.equal(provider.verifiedIndiaJobCount, null)
})

test('ShareChat rejects mismatched role identity, title, status, office, employer and publication evidence', async () => {
  for (const [urlToChange, mutate] of [
    [native, x => { x.data.reqDetailsBO.reqId = 1 }],
    [native, x => { x.data.reqDetailsBO.reqTitle = 'Unrelated role' }],
    [native, x => { x.data.reqDetailsBO.statusId = 4 }],
    [native, x => { x.data.reqDetailsBO.requisitionPublished = false }],
    [native, x => { x.data.reqDetailsBO.locationList = [] }],
    [native, x => { x.data.reqDetailsBO.locationList[0].office = 'London' }],
    [native, x => { x.data.reqDetailsBO.locationList[0].address = 'London, United Kingdom' }],
    [native, x => { x.data.reqDetailsBO.locationList[0].country = 'United States' }],
    [native, x => { x.data.reqDetailsBO.jdDisplay = '<template>Build systems for ShareChat</template>' }],
    [datesUrl, x => { x.data.careersJobPostingDatesList[0].publishedOn = null }],
    [datesUrl, x => { x.data.careersJobPostingDatesList[0].publishedOn = 1798761600000 }],
    [datesUrl, x => { x.data.careersJobPostingDatesList.push(x.data.careersJobPostingDatesList[0]) }],
  ]) {
    const jobs = await execute({ maxJobs: 1, fetchPage: async (url, options) => {
      const response = await request(url, options)
      if (url === urlToChange) { const value = JSON.parse(response.html); mutate(value); response.html = JSON.stringify(value) }
      return response
    } })
    assert.equal(jobs.length, 0, 'accepted conflicting native evidence: ' + String(mutate))
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  }
  for (const mutate of [x => { x.clientId = 1 }, x => { x.clientName = 'Other' }, x => { x.companyWebsite = 'https://other.example' },
    x => { x.tenantPreferencesMap.career_page_url.url[0].url = 'https://other.example/jobs' }]) {
    await assert.rejects(execute({ fetchPage: async (url, options) => {
      const response = await request(url, options)
      if (url === tenantUrl) { const value = JSON.parse(response.html); mutate(value); response.html = JSON.stringify(value) }
      return response
    } }), /ShareChat/)
  }
})

test('ShareChat never fabricates HTTP success, retries permission denial, or fills detail failure from listing', async () => {
  await assert.rejects(execute({ fetchPage: async () => JSON.stringify(listing) }), /ShareChat.*receipt/)
  await assert.rejects(execute({ fetchText: async () => JSON.stringify(listing) }), /ShareChat.*receipt/)
  let attempts = 0
  const jobs = await execute({ maxJobs: 1, fetchPage: async (url, options) => {
    if (url === native) { attempts++; return { status: 403, url, html: '{"error":"permission denied"}' } }
    return request(url, options)
  } })
  assert.equal(attempts, 1)
  assert.equal(jobs.length, 0)
  assert.match(readInventoryEvidence(jobs).reason, /403/)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
})

test('ShareChat caps selected detail requests and rejects duplicate listings and wrong response URLs', async () => {
  const ids = []
  const jobs = await execute({ maxJobs: 2, fetchPage: async (url, options) => {
    if (url === native) ids.push(JSON.parse(options.body).reqId)
    return request(url, options)
  } })
  assert.equal(jobs.length, 2)
  assert.deepEqual(ids, [2478, 2473])
  await assert.rejects(execute({ fetchPage: async (url, options) => {
    const response = await request(url, options)
    if (url === source.buildSearchUrl()) { const x = structuredClone(listing); x.data.careersList[0].data.push(x.data.careersList[0].data[0]); response.html = JSON.stringify(x) }
    return response
  } }), /ShareChat.*(repeat|duplicate)/)
  await assert.rejects(execute({ fetchPage: async (url, options) => ({ ...await request(url, options), url: 'https://other.example/' }) }), /ShareChat.*receipt/)
})

test('ShareChat aborts before requests and bounds an uncooperative transport deadline', async () => {
  const controller = new AbortController(), reason = Error('stop ShareChat')
  controller.abort(reason)
  let calls = 0
  await assert.rejects(execute({ signal: controller.signal, fetchPage: async () => { calls++; return {} } }), error => error === reason)
  assert.equal(calls, 0)
  let timer
  const outcome = await Promise.race([
    execute({ sourceBudgetMs: 10, fetchPage: async () => new Promise(() => {}) }).then(() => ({ success: true }), error => ({ error })),
    new Promise(resolve => { timer = setTimeout(() => resolve({ timedOut: true }), 500) }),
  ])
  clearTimeout(timer)
  assert.equal(outcome.timedOut, undefined)
  assert.match(outcome.error?.message || '', /ShareChat.*source deadline/)
})
