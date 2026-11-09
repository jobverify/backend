import assert from 'node:assert/strict'
import test from 'node:test'

const SEARCH_PAGE_URL =
  'https://careers.hitachi.com/search/hitachi-vantara-india-private-limited/jobs'
const DETAIL_URL =
  'https://careers.hitachi.com/jobs/17870993-software-development-expert'
const REMOTE_DETAIL_URL =
  'https://careers.hitachi.com/jobs/17910000-senior-technical-writer'
const PUBLIC_APPLY_URL = `${DETAIL_URL}/apply?tm_src=0`
const FINAL_APPLY_URL =
  'https://hitachi.wd1.myworkdayjobs.com/hitachi/job/Bengaluru-Karnataka-India/Software-Development-Expert_R0133334/apply'
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
    <h1>Search Jobs</h1>
    <div>India 19</div>
    <div>HITACHI VANTARA INDIA PRIVATE LIMITED 19</div>
    <div>No 18</div>
    <div>Yes 1</div>

    <div class="jobs-section__item page-section-1">
      <div class="row">
        <div class="large-5 columns">
          <a href="/jobs/17870993-software-development-expert">
            Software Development Expert
          </a>
        </div>
        <div class="large-4 columns">
          <span class="hide">Location: </span>
          Bengaluru,
          Karnataka,
          India
        </div>
        <div class="large-3 columns">
          <span class="hide-for-large">Company: </span>HITACHI VANTARA INDIA PRIVATE LIMITED
        </div>
      </div>
    </div>

    <div class="jobs-section__item page-section-1">
      <div class="row">
        <div class="large-5 columns">
          <a href="/jobs/17910000-senior-technical-writer">
            Senior Technical Writer
          </a>
        </div>
        <div class="large-4 columns">
          <span class="hide">Location: </span>
          Remote
        </div>
        <div class="large-3 columns">
          <span class="hide-for-large">Company: </span>HITACHI VANTARA INDIA PRIVATE LIMITED
        </div>
      </div>
    </div>

    <div class="jobs-section__item page-section-1">
      <div class="row">
        <div class="large-5 columns">
          <a href="/jobs/17948888-grid-automation-engineer">
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
    <h1>Software Development Expert</h1>
    <div>Location: Bengaluru, Karnataka, India</div>
    <div>Job ID: R0133334</div>
    <div>Date Posted: Jun 15, 2026</div>
    <div>Company Name: HITACHI VANTARA INDIA PRIVATE LIMITED</div>
    <div>Profession (Job Category): IT, Telecom & Internet</div>
    <div>Job Type (Experience Level): Experienced</div>
    <div>Job Schedule: Full time</div>
    <div>Remote: No</div>
    <a href="${PUBLIC_APPLY_URL}">Apply Now</a>

    <section>
      <h2>Job Description:</h2>
      <p>Design and build enterprise storage software for global customers.</p>

      <h3>Skills Required:</h3>
      <ul>
        <li>Java</li>
        <li>Distributed systems</li>
        <li>Storage platforms</li>
      </ul>

      <h3>Minimum Qualification:</h3>
      <p>Bachelor's degree in Computer Science or a related discipline.</p>

      <h3>Preferred Qualification:</h3>
      <p>Experience with cloud-native platforms.</p>
    </section>
  </main>
`

const loadHitachiVantaraIndiaModule = async () => {
  try {
    return await import('../../scraper/hitachivantaraindia/script.js')
  } catch {
    assert.fail('Expected Hitachi Vantara India scraper module at ../../scraper/hitachivantaraindia/script.js')
  }
}

test('Hitachi Vantara India stays pinned to the verified public company-filtered Hitachi careers page', async () => {
  const hitachiVantaraIndia = await loadHitachiVantaraIndiaModule()

  assert.equal(hitachiVantaraIndia.SOURCE, 'hitachivantaraindia')
  assert.equal(hitachiVantaraIndia.COMPANY, 'Hitachi Vantara India')
  assert.equal(
    hitachiVantaraIndia.OFFICIAL_COMPANY_LABEL,
    'HITACHI VANTARA INDIA PRIVATE LIMITED',
  )
  assert.equal(hitachiVantaraIndia.SEARCH_PAGE_URL, SEARCH_PAGE_URL)
  assert.equal(hitachiVantaraIndia.VERIFIED_ON, '2026-10-03')
  assert.equal(hitachiVantaraIndia.buildSearchPageUrl(), SEARCH_PAGE_URL)
  assert.equal(hitachiVantaraIndia.hasOfficialSearchPageSignal(listingHtml), true)
})

test('Hitachi Vantara India extracts public listings from the verified company page, including the India remote role', async () => {
  const { extractListings } = await loadHitachiVantaraIndiaModule()
  const jobs = extractListings(listingHtml)

  assert.deepEqual(jobs, [
    {
      title: 'Software Development Expert',
      location: 'Bengaluru, Karnataka, India',
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'India',
      sourceUrl: DETAIL_URL,
    },
    {
      title: 'Senior Technical Writer',
      location: 'Remote',
      city: null,
      state: null,
      country: 'India',
      sourceUrl: REMOTE_DETAIL_URL,
    },
  ])
})

test('Hitachi Vantara India extracts detail fields and preserves the public apply redirect before handoff resolution', async () => {
  const { extractJobDetail } = await loadHitachiVantaraIndiaModule()
  const detail = extractJobDetail(detailHtml, {
    title: 'Software Development Expert',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    state: 'Karnataka',
    country: 'India',
    sourceUrl: DETAIL_URL,
  })

  assert.deepEqual(detail, {
    title: 'Software Development Expert',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    state: 'Karnataka',
    country: 'India',
    jobId: '17870993',
    requisitionId: 'R0133334',
    sourceUrl: DETAIL_URL,
    applyUrl: PUBLIC_APPLY_URL,
    department: 'IT, Telecom & Internet',
    employmentType: 'Full-time',
    experienceRequired: 'Experienced',
    postingDate: '2026-06-15',
    closingDate: null,
    jobDescription: 'Design and build enterprise storage software for global customers.',
    minimumQualification: "Bachelor's degree in Computer Science or a related discipline.",
    preferredQualification: 'Experience with cloud-native platforms.',
    requiredSkills: [
      'java',
      'distributed systems',
      'storage platforms',
    ],
    remoteStatus: 'On-site',
  })
})

test('Hitachi Vantara India run verifies the search shell, enriches detail pages, and resolves the final Workday apply URL', async () => {
  const { createHitachiVantaraIndiaScraper, resolveApplyUrl } =
    await loadHitachiVantaraIndiaModule()
  const requestedTextUrls = []
  const requestedApplyUrls = []

  const applyUrl = await resolveApplyUrl(PUBLIC_APPLY_URL, {
    fetchImpl: async () => ({
      ok: true,
      url: `${FINAL_APPLY_URL}?source=jobsite&tm_job=17870993#apply`,
    }),
  })

  assert.equal(applyUrl, FINAL_APPLY_URL)

  const jobs = await createHitachiVantaraIndiaScraper().run({
    useLegacySearchPage: true,
    maxJobs: 1,
    fetchText: async (url) => {
      requestedTextUrls.push(url)
      if (url === SEARCH_PAGE_URL) return listingHtml
      if (url === DETAIL_URL) return detailHtml
      throw new Error(`Unexpected Hitachi Vantara India text fixture URL: ${url}`)
    },
    fetchImpl: async (url) => {
      requestedApplyUrls.push(url)
      if (url === PUBLIC_APPLY_URL) {
        return {
          ok: true,
          url: `${FINAL_APPLY_URL}?source=jobsite&tm_job=17870993`,
        }
      }
      throw new Error(`Unexpected Hitachi Vantara India apply fixture URL: ${url}`)
    },
    now: () => '2026-07-16T12:00:00.000Z',
  })

  assert.deepEqual(requestedTextUrls, [SEARCH_PAGE_URL, DETAIL_URL])
  assert.deepEqual(requestedApplyUrls, [PUBLIC_APPLY_URL])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'Hitachi Vantara India')
  assert.equal(jobs[0].source, 'hitachivantaraindia')
  assert.equal(jobs[0].applyUrl, FINAL_APPLY_URL)
  assert.equal(jobs[0].link, FINAL_APPLY_URL)
  assert.equal(jobs[0].scrapedAt, '2026-07-16T12:00:00.000Z')
})

test('Hitachi Vantara India resolves the final Workday apply URL through the browser when the public redirect is blocked', async () => {
  const { resolveApplyUrl } = await loadHitachiVantaraIndiaModule()

  const applyUrl = await resolveApplyUrl(PUBLIC_APPLY_URL, {
    fetchImpl: async () => ({
      ok: false,
      status: 403,
    }),
    fetchBrowserFinalUrl: async () => `${FINAL_APPLY_URL}?source=jobsite&tm_job=17870993#apply`,
  })

  assert.equal(applyUrl, FINAL_APPLY_URL)
})

test('Hitachi Vantara India treats the verified Cloudflare challenge shell as an honest empty state', async () => {
  const { createHitachiVantaraIndiaScraper, hasVerifiedCloudflareChallengeSignal } =
    await loadHitachiVantaraIndiaModule()
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

  const jobs = await createHitachiVantaraIndiaScraper().run({
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
    fetchText: async () => assert.fail('Hitachi Vantara India must stop after the verified listing challenge shell'),
    fetchImpl: async () => assert.fail('Hitachi Vantara India must not resolve apply URLs when the listing page is challenge-gated'),
  })

  assert.deepEqual(requestedUrls, [SEARCH_PAGE_URL])
  assert.deepEqual(jobs, [])
})

test('Hitachi Vantara India falls back to browser-readable HTML when direct text fetch is blocked', async () => {
  const { createHitachiVantaraIndiaScraper } = await loadHitachiVantaraIndiaModule()
  const requestedTextUrls = []
  const requestedBrowserUrls = []

  const jobs = await createHitachiVantaraIndiaScraper().run({
    useLegacySearchPage: true,
    maxJobs: 1,
    fetchText: async (url) => {
      requestedTextUrls.push(url)
      throw new Error(`HTTP 403 for ${url}`)
    },
    fetchBrowserText: async (url) => {
      requestedBrowserUrls.push(url)
      if (url === SEARCH_PAGE_URL) return listingHtml
      if (url === DETAIL_URL) return detailHtml
      throw new Error(`Unexpected Hitachi Vantara India browser fixture URL: ${url}`)
    },
    fetchImpl: async (url) => {
      if (url === PUBLIC_APPLY_URL) {
        return {
          ok: true,
          url: `${FINAL_APPLY_URL}?source=jobsite&tm_job=17870993`,
        }
      }
      throw new Error(`Unexpected Hitachi Vantara India apply fixture URL: ${url}`)
    },
    now: () => '2026-07-16T12:00:00.000Z',
  })

  assert.deepEqual(requestedTextUrls, [SEARCH_PAGE_URL, DETAIL_URL])
  assert.deepEqual(requestedBrowserUrls, [SEARCH_PAGE_URL, DETAIL_URL])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].applyUrl, FINAL_APPLY_URL)
})
