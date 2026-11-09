import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import * as tcs from '../../scraper/tcs/script.js'

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'tcs')
const json = (name) => JSON.parse(readFileSync(path.join(fixtures, name), 'utf8'))
const html = (name) => readFileSync(path.join(fixtures, name), 'utf8')
const publishedPages = json('current-listing-pages.json')
const publishedDetails = json('current-details.json')
const records = [...publishedPages[0].payload.content.slice(0, 10), publishedPages[1].payload.content.at(-1)]
const details = new Map(publishedDetails.map((item) => [item.id, item.response]))
const copy = (value) => structuredClone(value)
const envelope = (payload) => ({ result: true, status: 200, message: 'Ok', payload })
const pagePayload = (page, entries = records) => {
  const size = 10
  const content = copy(entries.slice((page - 1) * size, page * size))
  const totalPages = Math.ceil(entries.length / size)
  return envelope({
    ...copy(publishedPages[0].payload), content, totalElements: entries.length,
    totalPages, number: page - 1, size, numberOfElements: content.length,
    first: page === 1, last: page >= totalPages, empty: content.length === 0,
    pageable: { ...copy(publishedPages[0].payload.pageable), pageNumber: page - 1, pageSize: size, offset: (page - 1) * size },
  })
}

const publicFetch = ({ entries = records, mutatePage, mutateDetail, failDetail, beforeResponse } = {}) => {
  const requests = []
  let sessionSequence = 0
  const sessions = new Map()
  let pendingDetails = 0
  let peakDetails = 0
  const respond = (body, headers = {}) => new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status: 200, headers: { 'Content-Type': typeof body === 'string' ? 'text/html' : 'application/json', ...headers },
  })
  const fetch = async (url, options = {}) => {
    const cookie = options.headers?.Cookie || ''
    requests.push({ url: String(url), ...options })
    if (beforeResponse) await beforeResponse(url, options)
    options.signal?.throwIfAborted()
    if (url === 'https://www.tcs.com/careers/india') return respond(html('current-india-careers.html'), { 'Set-Cookie': 'CORPORATE_ONLY=public-cookie; Path=/' })
    if (url === 'https://ibegin.tcsapps.com/candidate/next/') {
      const route = 'route-' + (++sessionSequence)
      sessions.set(route, { id: 'session-' + sessionSequence, csrf: 'csrf-' + sessionSequence, initialized: false })
      return respond(html('current-app-shell.html'), { 'Set-Cookie': 'ROUTEID=' + route + '; Path=/candidate/next' })
    }
    assert.ok(!cookie.includes('CORPORATE_ONLY='), 'Corporate-domain cookies must not be sent to iBegin')
    const route = /ROUTEID=([^;]+)/.exec(cookie)?.[1]
    const session = sessions.get(route)
    assert.ok(session, 'The current public app routing cookie must reach its API')
    if (String(url).endsWith('/api/geographies')) {
      return respond(json('current-geographies.json'), {
        'Set-Cookie': 'SESSION=' + session.id + '; Path=/candidate/next', 'X-NEXT-XSRF-TOKEN': session.csrf,
      })
    }
    assert.match(cookie, new RegExp('SESSION=' + session.id))
    if (String(url).endsWith('/api/candidate')) {
      session.initialized = true
      return respond({ result: true, status: 200, message: 'Ok' }, { 'X-NEXT-XSRF-TOKEN': session.csrf })
    }
    assert.equal(session.initialized, true, 'Only initialized ordinary anonymous public sessions may query jobs')
    if (String(url).endsWith('/en-IN/search/jobs')) {
      assert.equal(options.method, 'POST')
      assert.equal(options.headers['NEXT-XSRF-TOKEN'], session.csrf)
      const body = JSON.parse(options.body)
      assert.equal(body.resultsPerPage, 10)
      assert.equal(body.recentSortOrder, 'desc')
      assert.equal(body.relevancySortOrder, null)
      assert.deepEqual(body.searchTerms, [])
      assert.equal(body.includeRegularJob, true)
      assert.equal(body.includeWalkIn, true)
      const result = pagePayload(body.page, entries)
      if (mutatePage) mutatePage(result, body.page)
      session.csrf += '-rotated'
      return respond(result, { 'X-NEXT-XSRF-TOKEN': session.csrf })
    }
    const match = /\/en-IN\/job\/desc\/(walkin\/)?(\d+)$/.exec(String(url))
    assert.ok(match, 'Only the published read-only detail route may be called')
    assert.equal(options.method, 'GET')
    const id = match[2] + (match[1] ? 'W' : 'J')
    if (failDetail === id) return new Response(JSON.stringify({ result: false, status: 503, message: 'Unavailable' }), { status: 503, headers: { 'Content-Type': 'application/json' } })
    const result = copy(details.get(id))
    assert.ok(result, 'Expected captured current detail for ' + id)
    if (mutateDetail) mutateDetail(result, id)
    pendingDetails += 1
    peakDetails = Math.max(peakDetails, pendingDetails)
    await new Promise((resolve) => setTimeout(resolve, 1))
    pendingDetails -= 1
    return respond(result)
  }
  return { fetch, requests, sessions, get peakDetails() { return peakDetails } }
}

const execute = (transport, options = {}) => tcs.createTcsScraper({ pageSize: 10, ...options }).run({ fetch: transport.fetch })

test('TCS uses the verified current India search and detail contract with supported recent sorting', () => {
  assert.equal(tcs.CAREER_PAGE_URL, 'https://ibegin.tcsapps.com/candidate/next/')
  assert.equal(tcs.SEARCH_API_URL, 'https://ibegin.tcsapps.com/candidate/next/api/en-IN/search/jobs')
  assert.equal(tcs.DEFAULT_PAGE_SIZE, 50)
  assert.deepEqual(tcs.buildSearchPayload({ page: 2, pageSize: 25 }), {
    includeRegularJob: true, includeWalkIn: true, searchTerms: [], jobLocationFilters: [],
    jobDomainFilters: [], experienceLevelFilters: [], skillFilters: [],
    relevancySortOrder: null, recentSortOrder: 'desc', lastDateToApplySortOrder: null,
    page: 2, resultsPerPage: 25,
  })
  assert.equal(tcs.buildPublicJobUrl('434952J'), 'https://ibegin.tcsapps.com/candidate/next/en-IN/jobs/434952J')
  assert.equal(tcs.buildDetailApiUrl('434952J'), 'https://ibegin.tcsapps.com/candidate/next/api/en-IN/job/desc/434952')
  assert.equal(tcs.buildDetailApiUrl('143361W'), 'https://ibegin.tcsapps.com/candidate/next/api/en-IN/job/desc/walkin/143361')
})

test('TCS keeps cookie and rotating public CSRF continuity, reconciles all pages, and validates every detail', async () => {
  const transport = publicFetch()
  const jobs = await execute(transport)
  assert.equal(jobs.length, 11)
  assert.equal(new Set(jobs.map((job) => job.jobId)).size, 11)
  assert.ok(jobs.every((job) => job.country === 'India' && job.location.endsWith(', India')))
  assert.ok(jobs.every((job) => job.requisitionId === job.jobId.slice(0, -1)))
  assert.ok(jobs.every((job) => job.source === 'tcs' && job.link === job.applyUrl && job.applyUrl === job.sourceUrl))
  assert.equal(jobs[0].title, '.NET')
  assert.equal(jobs[0].city, 'Pune')
  assert.match(jobs[0].jobDescription, /NET/i)
  assert.equal(jobs.find((job) => job.jobId === '143361W').employmentType, 'Walk-in')
  assert.equal(transport.requests.filter((request) => request.url.endsWith('/search/jobs')).length, 2)
  assert.equal(transport.requests.filter((request) => /\/job\/desc\//.test(request.url)).length, 11)
  assert.ok(transport.peakDetails <= 2)
  const detailSessions = new Set(transport.requests.filter((request) => /\/job\/desc\//.test(request.url)).map((request) => /SESSION=([^;]+)/.exec(request.headers.Cookie)[1]))
  assert.equal(detailSessions.size, 2, 'Concurrent detail workers must use separate public sessions')
})

test('TCS preserves genuinely missing published descriptions without inventing text', async () => {
  const empty = publishedDetails.find((entry) => entry.id === '435433J')
  const listing = copy(publishedPages[0].payload.content[0])
  Object.assign(listing, { id: empty.id, title: empty.response.payload.title, location: empty.response.payload.location, domain: empty.response.payload.functionName, walkIn: false, applyBy: empty.response.payload.applyby })
  const jobs = await execute(publicFetch({ entries: [listing] }))
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobDescription, null)
  assert.equal(jobs[0].country, 'India')
})

test('TCS accepts zero only when its verified public API advertises a complete empty inventory', async () => {
  const jobs = await execute(publicFetch({ entries: [] }))
  assert.deepEqual(jobs, [])
})

test('TCS rejects duplicate pages rather than suppressing missing jobs in relevance ordering', async () => {
  await assert.rejects(execute(publicFetch({ mutatePage: (response, page) => {
    if (page === 2) response.payload.content[0] = copy(records[0])
  } })), /duplicate.*TCS|TCS.*duplicate/i)
})

test('TCS rejects changed totals, missing records, malformed pagination, and malformed listing identities', async () => {
  const mutations = [
    (response, page) => { if (page === 2) response.payload.totalElements += 1 },
    (response, page) => { if (page === 2) response.payload.content = [] },
    (response) => { response.payload.number = 42 },
    (response) => { response.payload.pageable.offset += 1 },
    (response) => { response.payload.totalPages += 1 },
    (response) => { response.payload.content[0].id = 'not-a-requisition' },
    (response) => { response.payload.content[0].walkIn = !response.payload.content[0].walkIn },
  ]
  for (const mutatePage of mutations) await assert.rejects(execute(publicFetch({ mutatePage })), /TCS.*(?:pagination|inventory|listing|requisition|identity|walk)/i)
})

test('TCS requires explicit India country and matching requisition, title, location, domain, and closing date in details', async () => {
  const mutations = [
    (detail) => { detail.jobId = 430193 },
    (detail) => { detail.title = 'Wrong title' },
    (detail) => { detail.location = 'Mumbai' },
    (detail) => { detail.country = 'United States' },
    (detail) => { delete detail.country },
    (detail) => { detail.countryMatch = 'N' },
    (detail) => { detail.functionName = 'Wrong domain' },
    (detail) => { detail.applyby = '2028-01-01' },
  ]
  for (const mutation of mutations) await assert.rejects(execute(publicFetch({ entries: records.slice(0, 1), mutateDetail: (response) => mutation(response.payload) })), (error) => error.code === 'TCS_DETAIL_CONFLICT')
})

test('TCS does not return a partial success after an upstream detail failure', async () => {
  await assert.rejects(execute(publicFetch({ failDetail: records[1].id })), /HTTP 503/)
})

test('TCS fails closed when caller caps would truncate the complete inventory', async () => {
  await assert.rejects(execute(publicFetch(), { maxPages: 1 }), /TCS.*(?:cap|limit|truncate|complete)/i)
  await assert.rejects(execute(publicFetch(), { maxJobs: 5 }), /TCS.*(?:cap|limit|truncate|complete)/i)
})

test('TCS verifies the first-party India handoff and current public shell before API use', async () => {
  const transport = publicFetch()
  await assert.rejects(tcs.createTcsScraper({ pageSize: 10 }).run({ fetch: async (url, options) => {
    if (url === 'https://www.tcs.com/careers/india') return new Response(html('current-india-careers.html').replace(/ibegin\.tcsapps\.com\/candidate\//g, 'wrong.example/jobs/'), { headers: { 'Content-Type': 'text/html' } })
    return transport.fetch(url, options)
  } }), /TCS.*(?:handoff|careers|surface)/i)
  await assert.rejects(tcs.createTcsScraper({ pageSize: 10 }).run({ fetch: async (url, options) => {
    if (url === 'https://ibegin.tcsapps.com/candidate/next/') return new Response('<html><title>Other</title></html>', { headers: { 'Content-Type': 'text/html' } })
    return transport.fetch(url, options)
  } }), /TCS.*(?:shell|surface|iBegin)/i)
})

test('TCS preserves typed maintenance and API-to-shell drift failures', async () => {
  await assert.rejects(tcs.createTcsScraper().run({ fetch: async () => new Response('<title>App Maintenance</title><p>iBegin is temporarily under maintenance</p>', { status: 404, headers: { 'Content-Type': 'text/html' } }) }), (error) => error.code === 'TCS_MAINTENANCE' && error.upstreamOutage && error.abortRetries)
  const transport = publicFetch()
  await assert.rejects(tcs.createTcsScraper({ pageSize: 10 }).run({ fetch: async (url, options) => {
    if (String(url).endsWith('/search/jobs')) {
      const response = new Response(html('current-app-shell.html'), { headers: { 'Content-Type': 'text/html' } })
      Object.defineProperty(response, 'url', { value: 'https://ibegin.tcsapps.com/candidate/next/' })
      return response
    }
    return transport.fetch(url, options)
  } }), (error) => error.code === 'TCS_API_MIGRATED' && error.abortRetries)
})

test('TCS preserves cancellation before fetch and while loading the public session', async () => {
  const preAborted = new AbortController()
  preAborted.abort(new Error('cancel before TCS'))
  let calls = 0
  await assert.rejects(tcs.run({ signal: preAborted.signal, fetch: async () => { calls += 1; throw Error('must not fetch') } }), /cancel before TCS/)
  assert.equal(calls, 0)
  const controller = new AbortController()
  const transport = publicFetch({ beforeResponse: async () => controller.abort(new Error('cancel during TCS')) })
  await assert.rejects(tcs.createTcsScraper().run({ signal: controller.signal, fetch: transport.fetch }), /cancel during TCS/)
  assert.equal(transport.requests.length, 1)
})
