import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import * as bmw from '../../scraper/bmwtechworksindia/script.js'

const fixture = async (name) => fs.readFile(new URL('./fixtures/bmwtechworksindia/' + name, import.meta.url), 'utf8')
const [publisher, portal, urlinfo, layout, details, ...pages] = await Promise.all([
  fixture('official-publisher.html'), fixture('public-portal.html'), fixture('urlinfo.json').then(JSON.parse),
  fixture('layout.json').then(JSON.parse), fixture('details.json').then(JSON.parse),
  ...[0, 45, 90].map((offset) => fixture('jobs-' + offset + '.json').then(JSON.parse)),
])
const origin = 'https://careers-bmwtechworks.peoplestrong.com'
const authority = 'https://www.linkedin.com/posts/bmw-techworks-india_bmwtechworksindia-bmwgroup-hiring-activity-7356277931834253313-1uyS'
const handoff = 'https://bit.ly/45qB9gC'
const clone = (value) => structuredClone(value)
const setup = ({ publisherHtml = publisher, handoffUrl = origin + '/job/detail/BTWI_S-E-P_1366947', jsonMutation } = {}) => {
  const requests = []
  return {
    requests,
    options: {
      fetchPage: async (url) => {
        requests.push(url)
        if (url === authority) return { status: 200, finalUrl: url, html: publisherHtml }
        if (url === handoff) return { status: 200, finalUrl: handoffUrl, html: portal }
        throw new Error('Unexpected page: ' + url)
      },
      fetchJson: async (url, options = {}) => {
        requests.push(url)
        const parsed = new URL(url)
        let result
        if (parsed.pathname.endsWith('/urlinfo')) result = clone(urlinfo)
        else if (parsed.pathname.endsWith('/layout')) result = clone(layout)
        else if (parsed.pathname.endsWith('/jobs/v1')) {
          assert.equal(options.method, 'POST')
          assert.equal(options.body, '{}')
          assert.equal(options.headers['Content-Type'], 'application/json')
          result = clone(pages[Number(parsed.searchParams.get('offset')) / 45])
        } else if (parsed.pathname.includes('/job/')) {
          const encodedCode = parsed.pathname.split('/job/')[1].replace(/\/v2$/, '')
          result = clone(details[decodeURIComponent(encodedCode)])
        } else throw new Error('Unexpected JSON: ' + url)
        return jsonMutation ? jsonMutation(result, parsed) : result
      },
    },
  }
}

test('BMW reads all current 116 India openings and every published detail via the employer-published public tenant', async () => {
  const { options, requests } = setup()
  const jobs = await bmw.run(options)
  assert.equal(jobs.length, 116)
  assert.equal(new Set(jobs.map((job) => job.jobId)).size, 116)
  assert.equal(jobs.every((job) => job.company === 'BMW TechWorks India' && job.country === 'India'), true)
  assert.equal(jobs.every((job) => job.jobDescription?.length > 0 && job.sourceListingComplete === true), true)
  assert.equal(jobs[0].jobId, 'BTWI/S-E/1879264')
  assert.equal(jobs[0].requisitionId, '1879264')
  assert.equal(jobs[0].location, 'Pune, Maharashtra, India')
  assert.equal(jobs[0].sourceUrl, pages[0].response[0].jobDetailUrl)
  assert.equal(jobs[0].applyUrl, jobs[0].sourceUrl)
  assert.match(jobs[0].jobDescription, /GitHub Copilot \/ Generative AI/)
  assert.equal(requests.some((url) => url.startsWith('https://www.bmwtechworks.in/')), false)
  assert.equal(requests.filter((url) => url.includes('/jobs/v1?')).length, 3)
  assert.equal(requests.filter((url) => url.includes('/cp/job/')).length, 116)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'complete-inventory')
  assert.equal(evidence.firstParty, true)
  assert.equal(evidence.listingComplete, true)
  assert.equal(evidence.reportedTotal, 116)
  assert.equal(evidence.indiaFacetCount, 116)
})

test('BMW verifies exact company publisher rather than matching job words in arbitrary HTML', async () => {
  const { options } = setup({ publisherHtml: publisher.replace('"@type":"Organization"', '"@type":"Person"') })
  await assert.rejects(bmw.run(options), /publisher|handoff/i)
})

test('BMW rejects a changed original recruitment handoff', async () => {
  const { options } = setup({ publisherHtml: publisher.replace('45qB9gC', 'different') })
  await assert.rejects(bmw.run(options), /publisher|handoff/i)
  const redirected = setup({ handoffUrl: 'https://careers-other.peoplestrong.com/job/detail/BTWI_S-E-P_1366947' })
  await assert.rejects(bmw.run(redirected.options), /handoff/i)
})

test('BMW rejects changed tenant realm and missing public employer branding', async () => {
  const wrongRealm = setup({ jsonMutation: (result, url) => {
    if (url.pathname.endsWith('/urlinfo')) result.response.realm = 999
    return result
  } })
  await assert.rejects(bmw.run(wrongRealm.options), /tenant|identity/i)
  const missingBrand = setup({ jsonMutation: (result, url) => url.pathname.endsWith('/layout') ? { response: [], messageCode: { code: 200 } } : result })
  await assert.rejects(bmw.run(missingBrand.options), /tenant|identity/i)
})

for (const [name, mutate] of [
  ['malformed response', (result) => { result.response = {} }],
  ['invalid count', (result) => { result.totalRecords = -1 }],
  ['short page', (result) => { result.response.pop() }],
  ['duplicate requisition', (result) => { result.response[1] = result.response[0] }],
  ['missing title', (result) => { delete result.response[0].jobTitle }],
  ['different employer', (result) => { result.response[0].organizationUnitComplete = 'Tata Technologies>Digital Car' }],
  ['unscoped location', (result) => { result.response[0].locationHierarchyComplete = 'Pune' }],
  ['remote without country', (result) => { result.response[0].locationHierarchyComplete = 'Remote>Europe>Remote' }],
  ['foreign application host', (result) => { result.response[0].jobDetailUrl = 'https://other.example/apply' }],
]) test('BMW fails closed on listing ' + name, async () => {
  const { options } = setup({ jsonMutation: (result, url) => {
    if (url.pathname.endsWith('/jobs/v1') && url.searchParams.get('offset') === '0') mutate(result)
    return result
  } })
  await assert.rejects(bmw.run(options), /listing|inventory|employer|location|identity|application/i)
})

test('BMW refuses changed pagination totals and an explicitly truncated page cap', async () => {
  const changing = setup({ jsonMutation: (result, url) => {
    if (url.pathname.endsWith('/jobs/v1') && url.searchParams.get('offset') === '45') result.totalRecords += 1
    return result
  } })
  await assert.rejects(bmw.run(changing.options), /count|total|inventory/i)
  const capped = setup()
  await assert.rejects(bmw.run({ ...capped.options, maxPages: 2 }), /truncated|page cap|incomplete/i)
})

for (const [name, mutate] of [
  ['identity mismatch', (result) => { result.response.requisitionCode = 'BTWI/OTHER/1' }],
  ['location conflict', (result) => { result.response.locationHierarchyComplete = 'Germany>Bavaria>Munich>Munich' }],
  ['closed job', (result) => { result.response.requisitionStatus = 'CLOSED' }],
  ['missing description', (result) => { result.response.jobDescription = '' }],
]) test('BMW rejects detail ' + name, async () => {
  const { options } = setup({ jsonMutation: (result, url) => {
    if (url.pathname.includes('/cp/job/')) mutate(result)
    return result
  } })
  await assert.rejects(bmw.run(options), /detail|conflict|description|identity/i)
})

test('BMW filters foreign jobs only after matching authoritative listing and detail countries', async () => {
  const { options } = setup({ jsonMutation: (result, url) => {
    const foreign = 'Germany>Bavaria>Munich>Munich'
    if (url.pathname.endsWith('/jobs/v1') && url.searchParams.get('offset') === '0') result.response[0].locationHierarchyComplete = foreign
    if (url.pathname.includes('/cp/job/') && result.response.requisitionCode === pages[0].response[0].jobCode) result.response.locationHierarchyComplete = foreign
    return result
  } })
  const jobs = await bmw.run(options)
  assert.equal(jobs.length, 115)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 116)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 115)
})

test('BMW authorizes verified empty only after exact tenant and complete explicit zero payload', async () => {
  const { options } = setup({ jsonMutation: (result, url) => url.pathname.endsWith('/jobs/v1') ? { totalRecords: 0, response: [] } : result })
  const jobs = await bmw.run(options)
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'verified-empty')
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 0)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 0)
})

test('BMW propagates cancellation and public detail failures without returning partial success', async () => {
  const aborted = new AbortController()
  aborted.abort(new Error('cancelled fixture'))
  const pre = setup()
  await assert.rejects(bmw.run({ ...pre.options, signal: aborted.signal }), /cancelled fixture/)
  assert.equal(pre.requests.length, 0)
  const failure = setup()
  const fetchJson = failure.options.fetchJson
  await assert.rejects(bmw.run({ ...failure.options, fetchJson: async (url, options) => {
    if (url.includes('/cp/job/')) throw new Error('public detail unavailable')
    return fetchJson(url, options)
  } }), /public detail unavailable/)
})

for (const country of ['Unknown Region', 'European Union', 'United Nations']) {
  test('BMW refuses pseudo-country hierarchy ' + country + ' even when listing and detail agree', async () => {
    const ambiguous = country + '>Region>Remote>Remote'
    const { options } = setup({ jsonMutation: (result, url) => {
      if (url.pathname.endsWith('/jobs/v1') && url.searchParams.get('offset') === '0') result.response[0].locationHierarchyComplete = ambiguous
      if (url.pathname.includes('/cp/job/') && result.response.requisitionCode === pages[0].response[0].jobCode) result.response.locationHierarchyComplete = ambiguous
      return result
    } })
    await assert.rejects(bmw.run(options), /listing location lacks an explicit country/i)
  })
}
