import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ALTERNATE_CAREERS_URL,
  CAREERS_URL,
  COMPANY,
  DARWINBOX_ORIGIN,
  OFFICIAL_CAREERS_HANDOFF_URL,
  PUBLIC_ALL_JOBS_URL,
  createMobiKwikScraper,
  extractDarwinboxHandoffUrl,
  hasExternalJobsHandoffSignal,
  hasCollapsedHomepageShellSignal,
  hasOfficialCareersSignal,
} from '../../scraper/mobikwik/script.js'

const FIXED_SCRAPED_AT = '2026-08-01T00:00:00.000Z'

const officialCareersSurface = {
  title: 'MobiKwik Careers: Join Our Team',
  text: `
    Want to empower millions of Indians with financial Independence?
    View Job Openings
    About Us
    We are a publicly listed fintech company and the home to India's largest digital wallet.
    There's a lot to love at MobiKwik.
  `,
  anchors: [
    { href: OFFICIAL_CAREERS_HANDOFF_URL, text: 'View Job Openings' },
    { href: 'https://www.linkedin.com/company/mobikwik', text: '' },
  ],
}

const collapsedHomepageShellSurface = {
  title: 'Online Mobile & DTH Recharge, Bill Payments, Easy Recharge',
  text: `
    Online Mobile & DTH Recharge, Bill Payments, Easy Recharge
    MobiKwik
    This website requires JavaScript.
  `,
  anchors: [
    { href: 'https://www.mobikwik.com/app/', text: 'Get App' },
  ],
}

test('MobiKwik validates the rendered careers surface and Darwinbox handoff before scraping jobs', async () => {
  const requestedUrls = []
  const delegatedJobs = [
    {
      title: 'DBA I',
      company: COMPANY,
      location: 'Gurgaon, Haryana , India',
      source: 'mobikwik',
      link: 'https://mobikwik.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a68c3faf671c7d',
    },
  ]
  const runCalls = []

  assert.equal(DARWINBOX_ORIGIN, 'https://mobikwik.darwinbox.in')
  assert.equal(PUBLIC_ALL_JOBS_URL, 'https://mobikwik.darwinbox.in/ms/candidatev2/main/careers/allJobs')
  assert.equal(hasOfficialCareersSignal(officialCareersSurface), true)
  assert.equal(hasExternalJobsHandoffSignal(officialCareersSurface), true)
  assert.equal(extractDarwinboxHandoffUrl(officialCareersSurface), OFFICIAL_CAREERS_HANDOFF_URL)
  assert.equal(hasCollapsedHomepageShellSignal(officialCareersSurface), false)

  const jobs = await createMobiKwikScraper({
    now: () => FIXED_SCRAPED_AT,
    darwinboxScraper: {
      run: async (options) => {
        runCalls.push(options)
        return delegatedJobs
      },
    },
  }).run({
    maxPages: 1,
    maxJobs: 1,
    loadRenderedCareersSurface: async (url) => {
      requestedUrls.push(url)
      return officialCareersSurface
    },
  })

  assert.deepEqual(requestedUrls, [CAREERS_URL])
  assert.deepEqual(runCalls, [{ maxPages: 1, maxJobs: 1 }])
  assert.deepEqual(jobs, [
    {
      ...delegatedJobs[0],
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})

test('MobiKwik returns [] while multiple career-like routes collapse to the verified generic homepage shell', async () => {
  const requestedUrls = []
  const runCalls = []

  assert.equal(hasCollapsedHomepageShellSignal(collapsedHomepageShellSurface), true)

  const jobs = await createMobiKwikScraper({
    darwinboxScraper: {
      run: async (options) => {
        runCalls.push(options)
        return []
      },
    },
  }).run({
    loadRenderedCareersSurface: async (url) => {
      requestedUrls.push(url)
      return collapsedHomepageShellSurface
    },
  })

  assert.deepEqual(requestedUrls, [CAREERS_URL, ALTERNATE_CAREERS_URL])
  assert.deepEqual(runCalls, [])
  assert.deepEqual(jobs, [])
})

test('MobiKwik fails closed when the rendered careers surface changes', async () => {
  await assert.rejects(
    createMobiKwikScraper().run({
      loadRenderedCareersSurface: async () => ({
        title: 'Unexpected',
        text: 'No career details here.',
        anchors: [],
      }),
    }),
    /MobiKwik official careers surface changed/i,
  )

  await assert.rejects(
    createMobiKwikScraper().run({
      loadRenderedCareersSurface: async () => ({
        ...officialCareersSurface,
        anchors: [{ href: 'https://example.com/jobs', text: 'View Job Openings' }],
      }),
    }),
    /MobiKwik careers handoff changed/i,
  )
})

test('MobiKwik rejects the original catch-all listing-shaped native detail', async () => {
  const requests = []
  const fetchImpl = async (url, options = {}) => {
    requests.push({ url, options })

    if (url === CAREERS_URL) {
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'text/html' },
        text: async () => `
          <html><head><title>MobiKwik Careers: Join Our Team</title></head><body>
            <p>Want to empower millions of Indians with financial Independence?</p>
            <p>We are a publicly listed fintech company</p>
            <p>There's a lot to love at MobiKwik</p>
            <a href="${OFFICIAL_CAREERS_HANDOFF_URL}">View Job Openings</a>
          </body></html>
        `,
      }
    }

    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({
        status: 'success',
        job_counts: 1,
        data: [{
          id: 'mobikwik-api-001',
          title: 'Backend Engineer',
          locations: 'Gurgaon, Haryana, India',
          country: 'India',
        }],
      }),
    }
  }

  const notReturned = Symbol('unavailable'), unchanged = notReturned
  let jobs = unchanged
  await assert.rejects(async () => {
    jobs = await createMobiKwikScraper({ fetchImpl }).run({ maxPages: 1 })
  }, error => {
    assert.equal(error.name, 'DarwinboxDetailContractError')
    assert.equal(error.abortRetries, true)
    assert.equal(error.failureKind, 'parser_or_contract_error')
    assert.match(error.message, /malformed for mobikwik-api-001/)
    return true
  })
  assert.strictEqual(jobs, notReturned, 'invalid detail cannot become a successful empty or partial return')
  assert.deepEqual(requests.map(({ url }) => url), [
    CAREERS_URL,
    PUBLIC_ALL_JOBS_URL,
    'https://mobikwik.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main',
    PUBLIC_ALL_JOBS_URL,
    'https://mobikwik.darwinbox.in/ms/candidateapi/job/mobikwik-api-001?companyId=main',
  ])
  assert.equal(requests[2].options.method, 'POST')
  assert.equal(requests[4].options.method, 'GET')
})

test('MobiKwik controlled detail envelope reuses original listing facts and keeps missing JD unqualified', async () => {
  const requests = []
  const fetchImpl = async (url, options = {}) => {
    requests.push({ url, options })

    if (url === CAREERS_URL) {
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'text/html' },
        text: async () => `
          <html><head><title>MobiKwik Careers: Join Our Team</title></head><body>
            <p>Want to empower millions of Indians with financial Independence?</p>
            <p>We are a publicly listed fintech company</p>
            <p>There's a lot to love at MobiKwik</p>
            <a href="${OFFICIAL_CAREERS_HANDOFF_URL}">View Job Openings</a>
          </body></html>
        `,
      }
    }

    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({
        status: 'success',
        job_counts: 1,
        data: [{
          id: 'mobikwik-api-001',
          title: 'Backend Engineer',
          locations: 'Gurgaon, Haryana, India',
          country: 'India',
        }],
      }),
    }
  }

  const detailEnvelopes = []
  const controlledFetch = async (url, options) => {
    const response = await fetchImpl(url, options)
    if (url !== 'https://mobikwik.darwinbox.in/ms/candidateapi/job/mobikwik-api-001?companyId=main') return response
    const original = await response.json(), row = original.data[0]
    const envelope = { status: original.status, message: { job: [{
      id: row.id, title: row.title, officelocation_show_arr: row.locations, country: row.country,
    }] } }
    detailEnvelopes.push(envelope)
    return { ...response, json: async () => envelope }
  }
  const jobs = await createMobiKwikScraper({ fetchImpl: controlledFetch, now: () => FIXED_SCRAPED_AT }).run({ maxPages: 1 })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, 'mobikwik-api-001')
  assert.equal(jobs[0].title, 'Backend Engineer')
  assert.equal(jobs[0].location, 'Gurgaon, Haryana, India')
  assert.equal(detailEnvelopes[0].message.job[0].country, 'India')
  assert.equal(Object.hasOwn(jobs[0], 'country'), false, 'do not invent a country field absent from this existing DTO')
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].sourceDetailFailureKind, 'missing-content')
  assert.ok(jobs[0].jobDescription == null || jobs[0].jobDescription === '')
  assert.ok(jobs[0].postingDate == null, 'missing native posting date stays unknown')
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
  assert.deepEqual(requests.map(({ url }) => url), [
    CAREERS_URL,
    PUBLIC_ALL_JOBS_URL,
    'https://mobikwik.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main',
    PUBLIC_ALL_JOBS_URL,
    'https://mobikwik.darwinbox.in/ms/candidateapi/job/mobikwik-api-001?companyId=main',
  ])
  assert.equal(requests[2].options.method, 'POST')
  assert.equal(requests[4].options.method, 'GET')
})
