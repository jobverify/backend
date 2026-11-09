import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { createDarwinboxScraper } from '../../scraper/darwinbox/script.js'
import { classifyScraperError } from '../utils/failureClassification.js'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'darwinbox',
)

const readJsonFixture = (name) =>
  JSON.parse(readFileSync(path.join(fixturesDir, name), 'utf8'))

const clone = (value) => JSON.parse(JSON.stringify(value))

const scraper = createDarwinboxScraper()
const customHostedScraper = createDarwinboxScraper({
  companyName: 'Example Hosted Company',
  source: 'examplehostedcompany',
  origin: 'https://smileshrms.darwinbox.com',
})

test('buildListingApiUrl and buildJobDetailUrl keep Darwinbox links on the public candidate routes', () => {
  assert.equal(
    scraper.buildListingApiUrl(),
    'https://dbx.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main',
  )
  assert.equal(
    scraper.buildJobDetailUrl('a6a3a53d1e7f39'),
    'https://dbx.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a3a53d1e7f39',
  )
})

test('createDarwinboxScraper supports customer-hosted Darwinbox origins without changing the job payload contract', () => {
  assert.equal(
    customHostedScraper.buildCareersPageUrl(),
    'https://smileshrms.darwinbox.com/ms/candidatev2/main/careers/allJobs',
  )
  assert.equal(
    customHostedScraper.buildListingApiUrl(),
    'https://smileshrms.darwinbox.com/ms/candidateapi/job/alljobs?companyId=main',
  )
  assert.equal(
    customHostedScraper.buildJobDetailUrl('a68875230db751'),
    'https://smileshrms.darwinbox.com/ms/candidatev2/main/careers/jobDetails/a68875230db751',
  )

  const jobs = customHostedScraper.extractSearchResults({
    data: [
      {
        id: 'a68875230db751',
        title: 'Module Lead',
        department_name: 'MICROSOFT',
        locations: 'Pune, Maharashtra\r, India',
        country: 'India',
        emp_type_name: 'PERMANENT',
        experience: '5 - 7 Years',
        posted_on: '28-Jul-2025',
        jd: '<p>Back end developer with some experience in front end development</p>',
      },
    ],
  })

  assert.deepEqual(jobs, [
    {
      title: 'Module Lead',
      company: 'Example Hosted Company',
      department: 'MICROSOFT',
      location: 'Pune, Maharashtra , India',
      city: 'Pune',
      jobId: 'a68875230db751',
      requisitionId: null,
      sourceUrl: 'https://smileshrms.darwinbox.com/ms/candidatev2/main/careers/jobDetails/a68875230db751',
      applyUrl: 'https://smileshrms.darwinbox.com/ms/candidatev2/main/careers/jobDetails/a68875230db751',
      employmentType: 'PERMANENT',
      experienceRequired: '5 - 7 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '28-Jul-2025',
      closingDate: null,
      jobDescription: '<p>Back end developer with some experience in front end development</p>',
    },
  ])
})

test('extractSearchResults keeps India jobs from the Darwinbox listings payload and builds stable detail links', () => {
  const payload = readJsonFixture('darwinbox-alljobs-response-body.json')
  const jobs = scraper.extractSearchResults(payload)

  assert.equal(jobs.length, 9)
  assert.deepEqual(jobs[0], {
    title: 'Sr. Specialist/Manager - Revenue Operations - Customer Success Operations',
    company: 'Darwinbox',
    department: 'Finance and Legal',
    location: 'Hyderabad, Telangana , India',
    city: 'Hyderabad',
    jobId: 'a6a3a53d1e7f39',
    requisitionId: null,
    sourceUrl: 'https://dbx.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a3a53d1e7f39',
    applyUrl: 'https://dbx.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a3a53d1e7f39',
    employmentType: 'Full-time',
    experienceRequired: '2 - 6 Years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '23-Jun-2026',
    closingDate: null,
    jobDescription: jobs[0].jobDescription,
  })
  assert.match(jobs[0].jobDescription, /<p/i)
})

test('extractSearchResults marks Darwinbox API descriptions as checked when experience is absent', () => {
  const jobs = customHostedScraper.extractSearchResults({
    data: [
      {
        id: 'a68875230db751',
        title: 'Module Lead',
        department_name: 'MICROSOFT',
        locations: 'Pune, Maharashtra\r, India',
        country: 'India',
        emp_type_name: 'PERMANENT',
        experience: '',
        posted_on: '28-Jul-2025',
        jd: '<p>Back end developer with some experience in front end development</p>',
      },
    ],
  })

  assert.equal(jobs[0].experienceRequired, null)
  assert.equal(jobs[0].publicExperienceChecked, true)
})

test('run paginates Darwinbox listing pages through an injected page fetcher and filters non-India jobs', async () => {
  const livePayload = readJsonFixture('darwinbox-alljobs-response-body.json')
  const indiaJob = clone(livePayload.data[0])
  const secondIndiaJob = clone(livePayload.data[1])
  const usJob = {
    ...clone(livePayload.data[0]),
    id: 'darwinbox-us-1',
    title: 'Senior Specialist - Revenue Operations - United States',
    locations: 'Dallas, Texas, United States',
    country: 'United States',
    posted_on: '21-Jun-2026',
  }

  const firstPage = {
    status: 'success',
    data: [indiaJob, usJob],
    job_counts: 11,
  }
  const secondPage = {
    status: 'success',
    data: [secondIndiaJob],
    job_counts: 11,
  }

  const requestedPages = []
  const jobs = await scraper.run({
    fetchListingPage: async ({ page }) => {
      requestedPages.push(page)
      if (page === 1) return firstPage
      if (page === 2) return secondPage
      throw new Error(`Unexpected Darwinbox page request: ${page}`)
    },
  })

  assert.deepEqual(requestedPages, [1, 2])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].jobId, indiaJob.id)
  assert.equal(jobs[1].jobId, secondIndiaJob.id)
  assert.equal(
    jobs[1].sourceUrl,
    `https://dbx.darwinbox.in/ms/candidatev2/main/careers/jobDetails/${secondIndiaJob.id}`,
  )
})

test('run seeds the Darwinbox candidate API with the public all-jobs cookie before posting listings', async () => {
  const requests = []
  const seededCookie = '__cf_bm=seeded-cloudflare-cookie'
  const apiOnlyScraper = createDarwinboxScraper({
    fetchImpl: async (url, options = {}) => {
      requests.push({ url, options })

      if ((options.method || 'GET') === 'GET') {
        assert.equal(url, 'https://dbx.darwinbox.in/ms/candidatev2/main/careers/allJobs')
        return {
          ok: true,
          status: 200,
          headers: {
            get: (name) => (String(name).toLowerCase() === 'content-type' ? 'text/html' : null),
            getSetCookie: () => [`${seededCookie}; Path=/; Domain=darwinbox.in; HttpOnly`],
          },
          text: async () => '<!doctype html><html><body>Darwinbox - </body></html>',
        }
      }

      assert.equal(url, 'https://dbx.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main')
      assert.equal(options.method, 'POST')
      assert.equal(options.headers.cookie, seededCookie)

      return {
        ok: true,
        status: 200,
        headers: {
          get: (name) => (String(name).toLowerCase() === 'content-type' ? 'application/json' : null),
          getSetCookie: () => [],
        },
        json: async () => ({
          status: 'success',
          job_counts: 1,
          data: [
            {
              id: 'dbx-cookie-001',
              title: 'Platform Engineer',
              department_name: 'Engineering',
              locations: 'Hyderabad, Telangana, India',
              country: 'India',
              emp_type_name: 'Full-time',
              experience: '3 - 5 Years',
              posted_on: '08-Aug-2026',
              jd: '<p>Build the platform.</p>',
            },
          ],
        }),
      }
    },
  })

  const jobs = await apiOnlyScraper.run({ maxPages: 1 })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, 'dbx-cookie-001')
  assert.deepEqual(
    requests.map(({ url, options = {} }) => ({
      method: options.method || 'GET',
      url,
    })),
    [
      {
        method: 'GET',
        url: 'https://dbx.darwinbox.in/ms/candidatev2/main/careers/allJobs',
      },
      {
        method: 'POST',
        url: 'https://dbx.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main',
      },
    ],
  )
})

test('run seeds the public all-jobs shell before posting to the Darwinbox candidate API when no page fetcher is injected', async () => {
  const requests = []
  const apiOnlyScraper = createDarwinboxScraper({
    fetchImpl: async (url, options = {}) => {
      requests.push({ url, options })

      if ((options.method || 'GET') === 'GET') {
        return {
          ok: true,
          status: 200,
          headers: {
            get: (name) => (String(name).toLowerCase() === 'content-type' ? 'text/html' : null),
            getSetCookie: () => [],
          },
          text: async () => '<!doctype html><html><body>Darwinbox - </body></html>',
        }
      }

      return {
        ok: true,
        status: 200,
        headers: {
          get: () => 'application/json',
          getSetCookie: () => [],
        },
        json: async () => ({
          status: 'success',
          job_counts: 1,
          data: [
            {
              id: 'dbx-api-001',
              title: 'Platform Engineer',
              department_name: 'Engineering',
              locations: 'Hyderabad, Telangana, India',
              country: 'India',
              emp_type_name: 'Full-time',
              experience: '3 - 5 Years',
              posted_on: '08-Aug-2026',
              jd: '<p>Build the platform.</p>',
            },
          ],
        }),
      }
    },
  })

  const jobs = await apiOnlyScraper.run({ maxPages: 1 })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, 'dbx-api-001')
  assert.equal(requests.length, 2)
  assert.equal(
    requests[0].url,
    'https://dbx.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  )
  assert.equal(requests[0].options.method, 'GET')
  assert.equal(
    requests[1].url,
    'https://dbx.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main',
  )
  assert.equal(requests[1].options.method, 'POST')
  assert.deepEqual(JSON.parse(requests[1].options.body), {
    companyId: 'main',
    sort_option: 'new',
    limit: 10,
    page: 1,
  })
  assert.deepEqual(
    Object.keys(requests[1].options.headers),
    ['User-Agent', 'Accept', 'Content-Type', 'Origin', 'Referer'],
  )
  assert.equal(requests[1].options.headers.Origin, 'https://dbx.darwinbox.in')
  assert.equal(
    requests[1].options.headers.Referer,
    'https://dbx.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  )
})

test('run uses the current global fetch binding when the native fetch implementation is injected', async () => {
  const originalFetch = globalThis.fetch
  const requests = []

  try {
    globalThis.fetch = async function mockedGlobalFetch(url, options = {}) {
      assert.equal(this, globalThis)
      requests.push({ url, options })

      if ((options.method || 'GET') === 'GET') {
        return {
          ok: true,
          status: 200,
          headers: {
            get: (name) => (String(name).toLowerCase() === 'content-type' ? 'text/html' : null),
            getSetCookie: () => ['__cf_bm=global-fetch-cookie; Path=/; Domain=darwinbox.in; HttpOnly'],
          },
          text: async () => '<!doctype html><html><body>Darwinbox - </body></html>',
        }
      }

      assert.equal(options.headers.cookie, '__cf_bm=global-fetch-cookie')

      return {
        ok: true,
        status: 200,
        headers: {
          get: (name) => (String(name).toLowerCase() === 'content-type' ? 'application/json' : null),
          getSetCookie: () => [],
        },
        json: async () => ({
          status: 'success',
          job_counts: 1,
          data: [
            {
              id: 'dbx-global-fetch-001',
              title: 'Platform Engineer',
              department_name: 'Engineering',
              locations: 'Hyderabad, Telangana, India',
              country: 'India',
              emp_type_name: 'Full-time',
              experience: '3 - 5 Years',
              posted_on: '08-Aug-2026',
              jd: '<p>Build the platform.</p>',
            },
          ],
        }),
      }
    }

    const apiOnlyScraper = createDarwinboxScraper({
      fetchImpl: globalThis.fetch,
    })

    const jobs = await apiOnlyScraper.run({ maxPages: 1 })

    assert.equal(jobs.length, 1)
    assert.equal(jobs[0].jobId, 'dbx-global-fetch-001')
    assert.equal(requests.length, 2)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('run refreshes the public all-jobs cookie before each Darwinbox listings page request', async () => {
  const requests = []
  let seedCount = 0
  const apiOnlyScraper = createDarwinboxScraper({
    fetchImpl: async (url, options = {}) => {
      requests.push({ url, options })

      if ((options.method || 'GET') === 'GET') {
        seedCount += 1
        return {
          ok: true,
          status: 200,
          headers: {
            get: (name) => (String(name).toLowerCase() === 'content-type' ? 'text/html' : null),
            getSetCookie: () => [`__cf_bm=page-cookie-${seedCount}; Path=/; Domain=darwinbox.in; HttpOnly`],
          },
          text: async () => '<!doctype html><html><body>Darwinbox - </body></html>',
        }
      }

      const payload = JSON.parse(options.body)
      assert.equal(
        options.headers.cookie,
        `__cf_bm=page-cookie-${payload.page}`,
      )

      return {
        ok: true,
        status: 200,
        headers: {
          get: (name) => (String(name).toLowerCase() === 'content-type' ? 'application/json' : null),
          getSetCookie: () => [],
        },
        json: async () => ({
          status: 'success',
          job_counts: 11,
          data: payload.page === 1
            ? [
                {
                  id: 'dbx-page-001',
                  title: 'Platform Engineer',
                  department_name: 'Engineering',
                  locations: 'Hyderabad, Telangana, India',
                  country: 'India',
                  emp_type_name: 'Full-time',
                  experience: '3 - 5 Years',
                  posted_on: '08-Aug-2026',
                  jd: '<p>Build the platform.</p>',
                },
              ]
            : [
                {
                  id: 'dbx-page-002',
                  title: 'Site Reliability Engineer',
                  department_name: 'Engineering',
                  locations: 'Pune, Maharashtra, India',
                  country: 'India',
                  emp_type_name: 'Full-time',
                  experience: '4 - 6 Years',
                  posted_on: '09-Aug-2026',
                  jd: '<p>Keep the platform healthy.</p>',
                },
              ],
        }),
      }
    },
  })

  const jobs = await apiOnlyScraper.run({ maxPages: 2 })

  assert.equal(jobs.length, 2)
  assert.deepEqual(
    requests.map(({ url, options = {} }) => ({
      method: options.method || 'GET',
      url,
    })),
    [
      {
        method: 'GET',
        url: 'https://dbx.darwinbox.in/ms/candidatev2/main/careers/allJobs',
      },
      {
        method: 'POST',
        url: 'https://dbx.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main',
      },
      {
        method: 'GET',
        url: 'https://dbx.darwinbox.in/ms/candidatev2/main/careers/allJobs',
      },
      {
        method: 'POST',
        url: 'https://dbx.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main',
      },
    ],
  )
})

test('run retries a Darwinbox listings page once with a fresh public cookie after a transient 403', async () => {
  const requests = []
  let seedCount = 0
  let postCount = 0
  const apiOnlyScraper = createDarwinboxScraper({
    fetchImpl: async (url, options = {}) => {
      requests.push({ url, options })

      if ((options.method || 'GET') === 'GET') {
        seedCount += 1
        return {
          ok: true,
          status: 200,
          headers: {
            get: (name) => (String(name).toLowerCase() === 'content-type' ? 'text/html' : null),
            getSetCookie: () => [`__cf_bm=retry-cookie-${seedCount}; Path=/; Domain=darwinbox.in; HttpOnly`],
          },
          text: async () => '<!doctype html><html><body>Darwinbox - </body></html>',
        }
      }

      postCount += 1
      assert.equal(options.headers.cookie, `__cf_bm=retry-cookie-${postCount}`)

      if (postCount === 1) {
        return {
          ok: false,
          status: 403,
          headers: {
            get: (name) => (String(name).toLowerCase() === 'content-type' ? 'text/html' : null),
            getSetCookie: () => [],
          },
          text: async () => '<html><title>Forbidden</title></html>',
        }
      }

      return {
        ok: true,
        status: 200,
        headers: {
          get: (name) => (String(name).toLowerCase() === 'content-type' ? 'application/json' : null),
          getSetCookie: () => [],
        },
        json: async () => ({
          status: 'success',
          job_counts: 1,
          data: [
            {
              id: 'dbx-retry-001',
              title: 'Platform Engineer',
              department_name: 'Engineering',
              locations: 'Hyderabad, Telangana, India',
              country: 'India',
              emp_type_name: 'Full-time',
              experience: '3 - 5 Years',
              posted_on: '09-Aug-2026',
              jd: '<p>Build the platform.</p>',
            },
          ],
        }),
      }
    },
  })

  const jobs = await apiOnlyScraper.run({ maxPages: 1 })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, 'dbx-retry-001')
  assert.deepEqual(
    requests.map(({ url, options = {} }) => ({
      method: options.method || 'GET',
      url,
    })),
    [
      {
        method: 'GET',
        url: 'https://dbx.darwinbox.in/ms/candidatev2/main/careers/allJobs',
      },
      {
        method: 'POST',
        url: 'https://dbx.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main',
      },
      {
        method: 'GET',
        url: 'https://dbx.darwinbox.in/ms/candidatev2/main/careers/allJobs',
      },
      {
        method: 'POST',
        url: 'https://dbx.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main',
      },
    ],
  )
})

test('run reports typed upstream failure when page 1 stays 403-blocked despite a reachable public Darwinbox shell', async () => {
  const requests = []
  let seedCount = 0
  const apiOnlyScraper = createDarwinboxScraper({
    companyName: 'Rockman Industries',
    source: 'rockmanindustries',
    origin: 'https://rockman.darwinbox.in',
    fetchImpl: async (url, options = {}) => {
      requests.push({ url, options })

      if ((options.method || 'GET') === 'GET') {
        seedCount += 1
        return {
          ok: true,
          status: 200,
          headers: {
            get: (name) => (String(name).toLowerCase() === 'content-type' ? 'text/html' : null),
            getSetCookie: () => [`__cf_bm=blocked-cookie-${seedCount}; Path=/; Domain=darwinbox.in; HttpOnly`],
          },
          text: async () => '<!doctype html><html><body>Rockman - </body></html>',
        }
      }

      return {
        ok: false,
        status: 403,
        headers: {
          get: (name) => (String(name).toLowerCase() === 'content-type' ? 'text/html' : null),
          getSetCookie: () => [],
        },
        text: async () => '<html><title>Attention Required! | Cloudflare</title></html>',
      }
    },
  })

  await assert.rejects(apiOnlyScraper.run({ maxPages: 1 }), (error) => {
    assert.equal(error.name, 'DarwinboxUpstreamUnavailableError')
    assert.equal(error.httpStatus, 403)
    assert.equal(error.abortRetries, true)
    const classification = classifyScraperError(error)
    assert.equal(classification.upstreamOutage, true)
    assert.equal(classification.failureKind, 'blocked_or_access_denied')
    return true
  })
  assert.deepEqual(
    requests.map(({ url, options = {} }) => ({
      method: options.method || 'GET',
      url,
    })),
    [
      {
        method: 'GET',
        url: 'https://rockman.darwinbox.in/ms/candidatev2/main/careers/allJobs',
      },
      {
        method: 'POST',
        url: 'https://rockman.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main',
      },
      {
        method: 'GET',
        url: 'https://rockman.darwinbox.in/ms/candidatev2/main/careers/allJobs',
      },
      {
        method: 'POST',
        url: 'https://rockman.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main',
      },
    ],
  )
})

test('run still throws the Darwinbox listings error when page 1 is 403-blocked and the public shell was not reachable', async () => {
  const apiOnlyScraper = createDarwinboxScraper({
    companyName: 'Rapido',
    source: 'rapido',
    origin: 'https://rapido.darwinbox.in',
    fetchImpl: async (url, options = {}) => {
      if ((options.method || 'GET') === 'GET') {
        throw new Error(`connect ETIMEDOUT for ${url}`)
      }

      return {
        ok: false,
        status: 403,
        headers: {
          get: (name) => (String(name).toLowerCase() === 'content-type' ? 'text/html' : null),
          getSetCookie: () => [],
        },
        text: async () => '<html><title>Attention Required! | Cloudflare</title></html>',
      }
    },
  })

  await assert.rejects(
    apiOnlyScraper.run({ maxPages: 1 }),
    /HTTP 403 for https:\/\/rapido\.darwinbox\.in\/ms\/candidateapi\/job\/alljobs\?companyId=main/i,
  )
})


test('run rejects malformed Darwinbox payloads instead of returning successful empty jobs', async () => {
  for (const payload of [{ error: 'Forbidden' }, { data: [] , job_counts: 2 }, { data: [], job_counts: 'unavailable' }]) {
    await assert.rejects(
      createDarwinboxScraper().run({ fetchListingPage: async () => payload }),
      (error) => error.name === 'DarwinboxListingContractError' && error.abortRetries === true,
    )
  }
  assert.deepEqual(await createDarwinboxScraper().run({
    fetchListingPage: async () => ({ status: 'success', data: [], job_counts: 0 }),
  }), [])
})

test('run rejects a pre-aborted Darwinbox source before any request', async () => {
  const reason = new Error('source stopped')
  let calls = 0
  const scraper = createDarwinboxScraper({ fetchImpl: async () => {
    calls += 1
    return new Response(JSON.stringify({ data: [], job_counts: 0 }), { headers: { 'content-type': 'application/json' } })
  } })
  await assert.rejects(scraper.run({ signal: AbortSignal.abort(reason) }), (error) => error === reason)
  assert.equal(calls, 0)
})

test('run propagates cancellation during Darwinbox cookie seeding without starting a listing request', async () => {
  const controller = new AbortController()
  const reason = new Error('cancel during seed')
  const methods = []
  const scraper = createDarwinboxScraper({ fetchImpl: async (_url, options = {}) => {
    methods.push(options.method || 'GET')
    if ((options.method || 'GET') === 'GET') {
      controller.abort(reason)
      return new Response('<html>Darwinbox</html>')
    }
    return new Response(JSON.stringify({ data: [], job_counts: 0 }), { headers: { 'content-type': 'application/json' } })
  } })
  await assert.rejects(scraper.run({ signal: controller.signal }), (error) => error === reason)
  assert.deepEqual(methods, ['GET'])
})

test('run propagates cancellation from the Darwinbox listing transport without refreshing cookies or returning jobs', async () => {
  const controller = new AbortController()
  const reason = new Error('cancel during listing')
  const methods = []
  let listingSignal
  const scraper = createDarwinboxScraper({ fetchImpl: async (_url, options = {}) => {
    methods.push(options.method || 'GET')
    if ((options.method || 'GET') === 'GET') return new Response('<html>Darwinbox</html>')
    listingSignal = options.signal
    controller.abort(reason)
    return new Response(JSON.stringify({ data: [], job_counts: 0 }), { headers: { 'content-type': 'application/json' } })
  } })
  await assert.rejects(scraper.run({ signal: controller.signal }), (error) => error === reason)
  assert.deepEqual(methods, ['GET', 'POST'])
  assert.equal(listingSignal.aborted, true)
})
