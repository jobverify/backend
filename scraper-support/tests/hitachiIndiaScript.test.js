import assert from 'node:assert/strict'
import test from 'node:test'

const SEARCH_PAGE_URL = 'https://careers.hitachi.com/search/hitachi-india-pvt-ltd/jobs/in/country/india'
const DETAIL_URL = 'https://careers.hitachi.com/jobs/17948031-marketing-communications-specialist-hitachi-high-tech-india-pvt-ltd'
const PUBLIC_APPLY_URL = `${DETAIL_URL}/apply?tm_src=0`
const FINAL_APPLY_URL = 'https://hitachi.wd1.myworkdayjobs.com/hitachi/job/Gurgaon-Haryana-India/Marketing-Communications-Specialist---Hitachi-High-Tech-India-Pvt-Ltd_R0134902/apply'
const challengeHtml = `
  <!doctype html>
  <html>
    <head>
      <title>Just a moment...</title>
    </head>
    <body>
      <h1>Just a moment...</h1>
      <p>Enable JavaScript and cookies to continue</p>
      <script src="https://challenges.cloudflare.com/turnstile/v0/api.js"></script>
    </body>
  </html>
`

const listingHtml = `
  <main>
    <div class="jobs-section__item page-section-1">
      <div class="row">
        <div class="large-5 columns">
          <a href="/jobs/17948031-marketing-communications-specialist-hitachi-high-tech-india-pvt-ltd">
            Marketing Communications Specialist - Hitachi High-Tech India Pvt. Ltd.
          </a>
        </div>
        <div class="large-4 columns">
          <span class="hide">Location: </span>
          Gurgaon,
          Haryana,
          India
        </div>
        <div class="large-3 columns">
          <span class="hide-for-large">Company: </span>HITACHI INDIA PVT. LTD
        </div>
      </div>
    </div>

    <div class="jobs-section__item page-section-1">
      <div class="row">
        <div class="large-5 columns">
          <a href="/jobs/17948888-global-role">
            Grid Automation Engineer
          </a>
        </div>
        <div class="large-4 columns">
          <span class="hide">Location: </span>
          Chennai,
          Tamil Nadu,
          India
        </div>
        <div class="large-3 columns">
          <span class="hide-for-large">Company: </span>HITACHI ENERGY INDIA LTD
        </div>
      </div>
    </div>
  </main>
`

const detailHtml = `
  <main>
    <h1>Marketing Communications Specialist - Hitachi High-Tech India Pvt. Ltd.</h1>
    <div>Location: Gurgaon, Haryana, India</div>
    <div>Job ID: R0134902</div>
    <div>Date Posted: Jul 7, 2026</div>
    <div>Company Name: HITACHI INDIA PVT. LTD</div>
    <div>Profession (Job Category): Other</div>
    <div>Job Type (Experience Level): Experienced</div>
    <div>Job Schedule: Full time</div>
    <a href="${PUBLIC_APPLY_URL}">Apply Now</a>

    <section>
      <h2>Job Description:</h2>
      <p>To establish and develop the local marketing communication function in India.</p>

      <h3>Skills Required:</h3>
      <ul>
        <li>Content development</li>
        <li>Digital marketing</li>
        <li>Salesforce / CRM</li>
      </ul>

      <h3>Experience:</h3>
      <p>5 - 8 years experience in B2B marketing.</p>
    </section>
  </main>
`

const loadHitachiIndiaModule = async () => {
  try {
    return await import('../../scraper/hitachiindia/script.js')
  } catch {
    assert.fail('Expected Hitachi India scraper module at ../../scraper/hitachiindia/script.js')
  }
}

test('buildSearchPageUrl keeps Hitachi India on the official company-filtered public search page', async () => {
  const {
    SEARCH_PAGE_URL: exportedSearchPageUrl,
    buildSearchPageUrl,
  } = await loadHitachiIndiaModule()

  assert.equal(exportedSearchPageUrl, SEARCH_PAGE_URL)
  assert.equal(buildSearchPageUrl(), SEARCH_PAGE_URL)
})

test('extractListings reads Hitachi India jobs from the official filtered results page and ignores sibling Hitachi brands', async () => {
  const { extractListings } = await loadHitachiIndiaModule()
  const jobs = extractListings(listingHtml)

  assert.deepEqual(jobs, [
    {
      title: 'Marketing Communications Specialist - Hitachi High-Tech India Pvt. Ltd.',
      location: 'Gurgaon, Haryana, India',
      city: 'Gurgaon',
      state: 'Haryana',
      country: 'India',
      sourceUrl: DETAIL_URL,
    },
  ])
})

test('extractJobDetail reads official Hitachi India detail fields and keeps the public apply redirect before handoff resolution', async () => {
  const { extractJobDetail } = await loadHitachiIndiaModule()
  const detail = extractJobDetail(detailHtml, {
    title: 'Marketing Communications Specialist - Hitachi High-Tech India Pvt. Ltd.',
    location: 'Gurgaon, Haryana, India',
    city: 'Gurgaon',
    state: 'Haryana',
    country: 'India',
    sourceUrl: DETAIL_URL,
  })

  assert.deepEqual(detail, {
    title: 'Marketing Communications Specialist - Hitachi High-Tech India Pvt. Ltd.',
    location: 'Gurgaon, Haryana, India',
    city: 'Gurgaon',
    state: 'Haryana',
    country: 'India',
    jobId: '17948031',
    requisitionId: 'R0134902',
    sourceUrl: DETAIL_URL,
    applyUrl: PUBLIC_APPLY_URL,
    department: 'Other',
    employmentType: 'Full-time',
    experienceRequired: 'Experienced',
    postingDate: '2026-07-07',
    closingDate: null,
    jobDescription: 'To establish and develop the local marketing communication function in India.',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'content development',
      'digital marketing',
      'salesforce / crm',
    ],
  })
})

test('resolveApplyUrl follows the Hitachi India public apply redirect to Workday and strips transient query params', async () => {
  const { resolveApplyUrl } = await loadHitachiIndiaModule()

  const applyUrl = await resolveApplyUrl(PUBLIC_APPLY_URL, {
    fetchImpl: async () => ({
      ok: true,
      url: `${FINAL_APPLY_URL}?source=jobsite&tm_job=17948031#apply`,
    }),
  })

  assert.equal(applyUrl, FINAL_APPLY_URL)
})

test('resolveApplyUrl falls back to the browser-readable final URL when the public Hitachi India apply redirect is blocked', async () => {
  const { resolveApplyUrl } = await loadHitachiIndiaModule()

  const applyUrl = await resolveApplyUrl(PUBLIC_APPLY_URL, {
    fetchImpl: async () => ({
      ok: false,
      status: 403,
    }),
    fetchBrowserFinalUrl: async () => `${FINAL_APPLY_URL}?source=jobsite&tm_job=17948031#apply`,
  })

  assert.equal(applyUrl, FINAL_APPLY_URL)
})

test('Hitachi India treats the verified Cloudflare challenge shell as an honest empty state', async () => {
  const { createHitachiIndiaScraper, hasVerifiedCloudflareChallengeSignal } = await loadHitachiIndiaModule()
  const requestedUrls = []

  assert.equal(hasVerifiedCloudflareChallengeSignal({
    status: 403,
    url: SEARCH_PAGE_URL,
    headers: {
      server: 'cloudflare',
      'cf-ray': '92ab1234abcd1234-BOM',
      'cf-mitigated': 'challenge',
    },
    html: challengeHtml,
  }), true)

  const jobs = await createHitachiIndiaScraper().run({
    useLegacySearchPage: true,
    fetchPage: async (url) => {
      requestedUrls.push(url)
      return {
        status: 403,
        url,
        headers: {
          server: 'cloudflare',
          'cf-ray': '92ab1234abcd1234-BOM',
          'cf-mitigated': 'challenge',
        },
        html: challengeHtml,
      }
    },
    fetchText: async () => assert.fail('Hitachi India must stop after the verified listing challenge shell'),
    fetchImpl: async () => assert.fail('Hitachi India must not resolve apply URLs when the listing page is challenge-gated'),
  })

  assert.deepEqual(requestedUrls, [SEARCH_PAGE_URL])
  assert.deepEqual(jobs, [])
})

test('run keeps Hitachi India on the filtered listing page, enriches detail pages, and stores the final Workday apply URL', async () => {
  const { createHitachiIndiaScraper } = await loadHitachiIndiaModule()
  const requestedTextUrls = []
  const requestedApplyUrls = []

  const jobs = await createHitachiIndiaScraper().run({
    useLegacySearchPage: true,
    maxJobs: 1,
    fetchText: async (url) => {
      requestedTextUrls.push(url)
      if (url === SEARCH_PAGE_URL) return listingHtml
      if (url === DETAIL_URL) return detailHtml
      throw new Error(`Unexpected Hitachi India text fixture URL: ${url}`)
    },
    fetchImpl: async (url) => {
      requestedApplyUrls.push(url)
      if (url === PUBLIC_APPLY_URL) {
        return {
          ok: true,
          url: `${FINAL_APPLY_URL}?source=jobsite&tm_job=17948031`,
        }
      }
      throw new Error(`Unexpected Hitachi India apply fixture URL: ${url}`)
    },
    now: () => '2026-07-09T12:00:00.000Z',
  })

  assert.deepEqual(requestedTextUrls, [
    SEARCH_PAGE_URL,
    DETAIL_URL,
  ])
  assert.deepEqual(requestedApplyUrls, [PUBLIC_APPLY_URL])
  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Marketing Communications Specialist - Hitachi High-Tech India Pvt. Ltd.',
    location: 'Gurgaon, Haryana, India',
    city: 'Gurgaon',
    state: 'Haryana',
    country: 'India',
    jobId: '17948031',
    requisitionId: 'R0134902',
    sourceUrl: DETAIL_URL,
    applyUrl: FINAL_APPLY_URL,
    department: 'Other',
    employmentType: 'Full-time',
    experienceRequired: 'Experienced',
    postingDate: '2026-07-07',
    closingDate: null,
    jobDescription: 'To establish and develop the local marketing communication function in India.',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'content development',
      'digital marketing',
      'salesforce / crm',
    ],
    company: 'HITACHI INDIA PVT. LTD',
    link: FINAL_APPLY_URL,
    source: 'hitachiindia',
    scrapedAt: '2026-07-09T12:00:00.000Z',
  })
})
