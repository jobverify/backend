import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-08-14T00:00:00.000Z'

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at FPL</title>
    <meta property="og:url" content="https://www.getonecard.app/careers/">
  </head>
  <body>
    <h1>
      <div id="_Careers">
        <span>Join Team OneCard</span>
      </div>
    </h1>
    <p>
      At OneCard, we are redefining the credit card and payments experience and want to
      be a part of the fintech revolution in India.
    </p>
    <div class="button_work_with_us">
      <a href="https://www.fplabs.tech/careers/">Work With Us</a>
    </div>
    <script>
      fetch(
        "https://ibffpublic6f2461135ffd1b6a80db296ec15abf.onrender.com/hr/jobs",
        {
          method: "get",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": "hr-read-only"
          }
        }
      )
    </script>
    <a href="mailto:careers@getonecard.app" class="btn btn-main-md">Apply Now</a>
  </body>
</html>
`

const verifiedHandoffGateHtml = `
<html>
  <title>You are being redirected...</title>
  <noscript>Javascript is required. Please enable javascript before you are allowed to see this page.</noscript>
  <script>
    var sucuri_cloudproxy_js = '';
  </script>
</html>
`

const verifiedBrokenJobsApiText = JSON.stringify({
  success: false,
  error: 'invalid json response body at https://paa.fplabs.tech/proxy/CRUD/api/test-jobs?populate=* reason: Unexpected token \'<\', "<!DOCTYPE "... is not valid JSON',
})

const jobsPayload = {
  success: true,
  data: {
    data: [
      {
        id: 17,
        attributes: {
          title: 'Product Analyst',
          location: null,
          experience: '2-4 years',
          description: '<p>Build credit insights.</p>',
          publishedAt: '2026-08-10T11:52:00.000Z',
        },
      },
      {
        id: 18,
        attributes: {
          title: 'Senior Backend Engineer',
          location: 'Bengaluru',
          experience: null,
          description: null,
          publishedAt: '2026-08-12T08:00:00.000Z',
        },
      },
    ],
    meta: {
      pagination: {
        page: 1,
        pageSize: 25,
        pageCount: 1,
        total: 2,
      },
    },
  },
}

const loadOneCardModule = async () => {
  try {
    return await import('../../scraper/onecard/script.js')
  } catch {
    assert.fail('Expected OneCard scraper module at ../../scraper/onecard/script.js')
  }
}

const replaceJobsApiKey = (html, replacement) =>
  html.replace(/hr-read-only/g, replacement)

test('OneCard scraper pins the verified Friday, August 14, 2026 careers page, FPL handoff gate, and broken public jobs API contract', async () => {
  const {
    COMPANY,
    OFFICIAL_APPLY_URL,
    OFFICIAL_CAREERS_HANDOFF_URL,
    OFFICIAL_CAREERS_URL,
    OFFICIAL_JOBS_API_KEY,
    OFFICIAL_JOBS_API_URL,
    SOURCE,
    VERIFIED_AT,
    extractOfficialJobsApiConfig,
    hasOfficialOneCardCareersSignals,
    hasVerifiedFplHandoffGateSignal,
    hasVerifiedBrokenPublicJobsApiError,
  } = await loadOneCardModule()

  assert.equal(COMPANY, 'OneCard')
  assert.equal(SOURCE, 'onecard')
  assert.equal(VERIFIED_AT, '2026-08-14')
  assert.equal(OFFICIAL_CAREERS_URL, 'https://www.getonecard.app/careers/')
  assert.equal(OFFICIAL_CAREERS_HANDOFF_URL, 'https://www.fplabs.tech/careers/')
  assert.equal(
    OFFICIAL_JOBS_API_URL,
    'https://ibffpublic6f2461135ffd1b6a80db296ec15abf.onrender.com/hr/jobs',
  )
  assert.equal(OFFICIAL_JOBS_API_KEY, 'hr-read-only')
  assert.equal(OFFICIAL_APPLY_URL, 'mailto:careers@getonecard.app')
  assert.deepEqual(extractOfficialJobsApiConfig(officialCareersHtml), {
    jobsApiUrl: OFFICIAL_JOBS_API_URL,
    jobsApiKey: OFFICIAL_JOBS_API_KEY,
  })
  assert.equal(hasOfficialOneCardCareersSignals(officialCareersHtml), true)
  assert.equal(hasOfficialOneCardCareersSignals(replaceJobsApiKey(officialCareersHtml, 'wrong-key')), false)
  assert.equal(hasVerifiedFplHandoffGateSignal(verifiedHandoffGateHtml), true)
  assert.equal(hasVerifiedFplHandoffGateSignal('<html><title>Jobs</title></html>'), false)
  assert.equal(hasVerifiedBrokenPublicJobsApiError(500, verifiedBrokenJobsApiText), true)
  assert.equal(hasVerifiedBrokenPublicJobsApiError(500, JSON.stringify({ success: false, error: 'unexpected' })), false)
})

test('OneCard returns an honest empty list while the verified FPL handoff remains gated and the embedded public jobs API keeps returning the same broken 500 contract', async () => {
  const { createOneCardScraper, OFFICIAL_CAREERS_URL, OFFICIAL_CAREERS_HANDOFF_URL, OFFICIAL_JOBS_API_URL } = await loadOneCardModule()
  const scraper = createOneCardScraper({
    now: () => FIXED_SCRAPED_AT,
  })
  const requestedUrls = []
  const requestedOptions = []

  const jobs = await scraper.run({
    fetchPage: async (url, options = {}) => {
      requestedUrls.push(url)
      requestedOptions.push(options)

      if (url === OFFICIAL_CAREERS_URL) {
        return {
          status: 200,
          url,
          finalUrl: url,
          body: officialCareersHtml,
          errorKind: null,
        }
      }

      if (url === OFFICIAL_CAREERS_HANDOFF_URL) {
        return {
          status: 307,
          url,
          finalUrl: url,
          body: verifiedHandoffGateHtml,
          errorKind: null,
        }
      }

      if (url === OFFICIAL_JOBS_API_URL) {
        return {
          status: 500,
          url,
          finalUrl: url,
          body: verifiedBrokenJobsApiText,
          errorKind: null,
        }
      }

      assert.fail(`Unexpected URL requested: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    OFFICIAL_CAREERS_URL,
    OFFICIAL_CAREERS_HANDOFF_URL,
    OFFICIAL_JOBS_API_URL,
  ])
  assert.equal(requestedOptions[2].headers['x-api-key'], 'hr-read-only')
  assert.equal(requestedOptions[2].headers['Content-Type'], 'application/json')
  assert.match(requestedOptions[2].accept, /application\/json/i)
  assert.deepEqual(jobs, [])
})

test('OneCard still extracts jobs if the verified embedded public jobs API recovers and returns a healthy payload again', async () => {
  const { createOneCardScraper, OFFICIAL_CAREERS_URL, OFFICIAL_CAREERS_HANDOFF_URL, OFFICIAL_JOBS_API_URL } = await loadOneCardModule()
  const scraper = createOneCardScraper({
    now: () => FIXED_SCRAPED_AT,
  })

  const jobs = await scraper.run({
    fetchPage: async (url) => {
      if (url === OFFICIAL_CAREERS_URL) {
        return {
          status: 200,
          url,
          finalUrl: url,
          body: officialCareersHtml,
          errorKind: null,
        }
      }

      if (url === OFFICIAL_CAREERS_HANDOFF_URL) {
        return {
          status: 307,
          url,
          finalUrl: url,
          body: verifiedHandoffGateHtml,
          errorKind: null,
        }
      }

      if (url === OFFICIAL_JOBS_API_URL) {
        return {
          status: 200,
          url,
          finalUrl: url,
          body: JSON.stringify(jobsPayload),
          errorKind: null,
        }
      }

      assert.fail(`Unexpected URL requested: ${url}`)
    },
  })

  assert.deepEqual(jobs, [
    {
      title: 'Product Analyst',
      company: 'OneCard',
      department: null,
      location: 'Pune',
      city: 'Pune',
      country: 'India',
      jobId: '17',
      requisitionId: '17',
      sourceUrl: 'https://www.getonecard.app/careers/',
      applyUrl: 'mailto:careers@getonecard.app',
      employmentType: null,
      experienceRequired: '2-4 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-08-10',
      closingDate: null,
      jobDescription: 'Build credit insights.',
      source: 'onecard',
      link: 'https://www.getonecard.app/careers/',
      scrapedAt: FIXED_SCRAPED_AT,
    },
    {
      title: 'Senior Backend Engineer',
      company: 'OneCard',
      department: null,
      location: 'Bengaluru',
      city: 'Bengaluru',
      country: 'India',
      jobId: '18',
      requisitionId: '18',
      sourceUrl: 'https://www.getonecard.app/careers/',
      applyUrl: 'mailto:careers@getonecard.app',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-08-12',
      closingDate: null,
      jobDescription: null,
      source: 'onecard',
      link: 'https://www.getonecard.app/careers/',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})

test('OneCard fails closed when the verified careers, handoff, or API surfaces drift materially', async () => {
  const { createOneCardScraper, OFFICIAL_CAREERS_URL, OFFICIAL_CAREERS_HANDOFF_URL, OFFICIAL_JOBS_API_URL } = await loadOneCardModule()
  const scraper = createOneCardScraper({
    now: () => FIXED_SCRAPED_AT,
  })

  await assert.rejects(
    scraper.run({
      fetchPage: async (url) => {
        if (url === OFFICIAL_CAREERS_URL) {
          return {
            status: 200,
            url,
            finalUrl: url,
            body: replaceJobsApiKey(officialCareersHtml, 'wrong-key'),
            errorKind: null,
          }
        }

        return {
          status: 307,
          url,
          finalUrl: url,
          body: verifiedHandoffGateHtml,
          errorKind: null,
        }
      },
    }),
    /verified onecard careers surfaces changed materially/i,
  )

  await assert.rejects(
    scraper.run({
      fetchPage: async (url) => {
        if (url === OFFICIAL_CAREERS_URL) {
          return {
            status: 200,
            url,
            finalUrl: url,
            body: officialCareersHtml,
            errorKind: null,
          }
        }

        if (url === OFFICIAL_CAREERS_HANDOFF_URL) {
          return {
            status: 200,
            url,
            finalUrl: url,
            body: '<html><title>Careers</title><body>Open positions</body></html>',
            errorKind: null,
          }
        }

        if (url === OFFICIAL_JOBS_API_URL) {
          return {
            status: 500,
            url,
            finalUrl: url,
            body: verifiedBrokenJobsApiText,
            errorKind: null,
          }
        }

        assert.fail(`Unexpected URL requested: ${url}`)
      },
    }),
    /verified onecard careers surfaces changed materially/i,
  )

  await assert.rejects(
    scraper.run({
      fetchPage: async (url) => {
        if (url === OFFICIAL_CAREERS_URL) {
          return {
            status: 200,
            url,
            finalUrl: url,
            body: officialCareersHtml,
            errorKind: null,
          }
        }

        if (url === OFFICIAL_CAREERS_HANDOFF_URL) {
          return {
            status: 307,
            url,
            finalUrl: url,
            body: verifiedHandoffGateHtml,
            errorKind: null,
          }
        }

        if (url === OFFICIAL_JOBS_API_URL) {
          return {
            status: 500,
            url,
            finalUrl: url,
            body: '{"success":false,"error":"unexpected"}',
            errorKind: null,
          }
        }

        assert.fail(`Unexpected URL requested: ${url}`)
      },
    }),
    /verified onecard careers surfaces changed materially/i,
  )
})
