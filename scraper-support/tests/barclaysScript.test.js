import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { normalizeScrapedJob } from '../utils/normalizeScrapedJob.js'

const loadBarclaysModule = async () => {
  try {
    return await import('../../scraper/barclays/script.js')
  } catch {
    return null
  }
}

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'barclays',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const DETAIL_WITH_EXPERIENCE_HTML = `
<html>
  <head>
    <meta name="search-job-apply-url" content="https://barclays.wd3.myworkdayjobs.com/External_Career_Site_Barclays/job/Bengaluru/Assistant-Vice-President---Applied-AI-Engineer_JR-0000125361/apply" />
    <script type="application/ld+json">{
      "@context":"http://schema.org",
      "@type":"JobPosting",
      "datePosted":"2026-07-30",
      "description":"<p>Join Barclays as an Assistant Vice President - Applied AI Engineer role.</p><ul><li><p>8+ years software engineering experience with at least 3 years building AI/ML systems, scalable ML infrastructure, or model serving platforms at enterprise scale</p></li></ul>",
      "employmentType":"Permanent",
      "identifier":"JR-0000125361",
      "industry":"Chief Technology Office",
      "title":"Assistant Vice President - Applied AI Engineer",
      "url":"https://search.jobs.barclays/job/bengaluru/assistant-vice-president-applied-ai-engineer/13015/98506870816",
      "workHours":"Full time",
      "hiringOrganization":{"@type":"Organization","name":"Barclays"},
      "jobLocation":[{"@type":"Place","address":{"@type":"PostalAddress","addressLocality":"Bengaluru","addressCountry":"India"}}]
    }</script>
  </head>
  <body>
    <section>
      <h1 class="job-details--title">Assistant Vice President - Applied AI Engineer</h1>
      <p class="job-details--location">Bengaluru, India</p>
      <div data-selector-name="jobdetails" data-job-id="98506870816"></div>
      <div class="ats-description pt-1 pl-m-4 pr-m-4">
        <p>Join Barclays as an Assistant Vice President - Applied AI Engineer role.</p>
        <ul>
          <li><p>8+ years software engineering experience with at least 3 years building AI/ML systems, scalable ML infrastructure, or model serving platforms at enterprise scale</p></li>
        </ul>
      </div>
    </section>
  </body>
</html>
`

const DETAIL_WITH_GENERIC_EXPERIENCE_HTML = `
<html>
  <head>
    <meta name="search-job-apply-url" content="https://barclays.wd3.myworkdayjobs.com/External_Career_Site_Barclays/job/Mumbai/PB-India-Banking-Product-Manager-AVP_JR-0000129999/apply" />
    <script type="application/ld+json">{
      "@context":"http://schema.org",
      "@type":"JobPosting",
      "datePosted":"2026-07-30",
      "description":"<p>Join us as PB India Banking Product Manager - AVP.</p><p>Essential Skills / Basic Qualifications:</p><ul><li><p>Graduate degree.</p></li><li><p>Strong understanding of Indian regulatory frameworks.</p></li><li><p>Experience with governance processes such as ALCO, audit, and risk committees.</p></li><li><p>Commercial acumen with a client-focused mindset.</p></li></ul>",
      "employmentType":"Permanent",
      "identifier":"JR-0000129999",
      "industry":"Private Banking",
      "title":"PB India Banking Product Manager - AVP",
      "url":"https://search.jobs.barclays/job/mumbai/pb-india-banking-product-manager-avp/13015/97553105744",
      "workHours":"Full time",
      "hiringOrganization":{"@type":"Organization","name":"Barclays"},
      "jobLocation":[{"@type":"Place","address":{"@type":"PostalAddress","addressLocality":"Mumbai","addressCountry":"India"}}]
    }</script>
  </head>
  <body>
    <section>
      <h1 class="job-details--title">PB India Banking Product Manager - AVP</h1>
      <p class="job-details--location">Mumbai, India</p>
      <div data-selector-name="jobdetails" data-job-id="97553105744"></div>
      <div class="ats-description pt-1 pl-m-4 pr-m-4">
        <p>Join us as PB India Banking Product Manager - AVP.</p>
        <p>Essential Skills / Basic Qualifications:</p>
        <ul>
          <li><p>Graduate degree.</p></li>
          <li><p>Strong understanding of Indian regulatory frameworks.</p></li>
          <li><p>Experience with governance processes such as ALCO, audit, and risk committees.</p></li>
          <li><p>Commercial acumen with a client-focused mindset.</p></li>
        </ul>
      </div>
    </section>
  </body>
</html>
`

test('buildSearchUrl keeps Barclays listings on the India TalentBrew pages', async () => {
  const barclays = await loadBarclaysModule()
  assert.ok(barclays)

  assert.equal(
    barclays.buildSearchUrl(),
    'https://search.jobs.barclays/search-jobs/india',
  )
  assert.equal(
    barclays.buildSearchUrl({ page: 2 }),
    'https://search.jobs.barclays/search-jobs/india&p=2',
  )
})

test('extractSearchResults keeps India Barclays cards and drops non-India spillover cards', async () => {
  const barclays = await loadBarclaysModule()
  assert.ok(barclays)

  const jobs = barclays.extractSearchResults(readFixture('search-results-page-1.html'))

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Macro and Credit BCO - India',
    company: 'Barclays',
    department: null,
    location: 'Mumbai, India',
    city: 'Mumbai',
    country: 'India',
    jobId: '92127468928',
    requisitionId: '92127468928',
    sourceUrl: 'https://search.jobs.barclays/job/mumbai/macro-and-credit-bco-india/13015/92127468928',
    applyUrl: 'https://search.jobs.barclays/job/mumbai/macro-and-credit-bco-india/13015/92127468928',
    employmentType: 'Full-time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
  })

  assert.equal(jobs[1].jobId, '95050011296')
  assert.equal(jobs[1].city, 'Pune')
})

test('extractPaginationSummary reads Barclays India paging links', async () => {
  const barclays = await loadBarclaysModule()
  assert.ok(barclays)

  assert.deepEqual(
    barclays.extractPaginationSummary(readFixture('search-results-page-1.html')),
    {
      nextUrl: 'https://search.jobs.barclays/search-jobs/india&p=2',
    },
  )
})

test('extractJobDetail reads Barclays detail metadata, JSON-LD, and Workday apply links', async () => {
  const barclays = await loadBarclaysModule()
  assert.ok(barclays)

  const detail = barclays.extractJobDetail(readFixture('job-detail-macro-and-credit-bco-india.html'), {
    title: 'Macro and Credit BCO - India',
    company: 'Barclays',
    department: null,
    location: 'Mumbai, India',
    city: 'Mumbai',
    country: 'India',
    jobId: '92127468928',
    requisitionId: '92127468928',
    sourceUrl: 'https://search.jobs.barclays/job/mumbai/macro-and-credit-bco-india/13015/92127468928',
    applyUrl: 'https://search.jobs.barclays/job/mumbai/macro-and-credit-bco-india/13015/92127468928',
  })

  assert.equal(detail.title, 'Macro and Credit BCO - India')
  assert.equal(detail.company, 'Barclays')
  assert.equal(detail.department, 'Control')
  assert.equal(detail.location, 'Mumbai, India')
  assert.equal(detail.city, 'Mumbai')
  assert.equal(detail.country, 'India')
  assert.equal(detail.jobId, '92127468928')
  assert.equal(detail.requisitionId, 'JR-0000090657')
  assert.equal(detail.employmentType, 'Full-time')
  assert.equal(detail.experienceRequired, null)
  assert.equal(detail.minimumQualification, null)
  assert.equal(detail.preferredQualification, null)
  assert.equal(detail.postingDate, '2026-05-06')
  assert.equal(detail.closingDate, null)
  assert.ok(detail.requiredSkills.includes('Strong understanding of Markets Trading & Sales business through Front Office experience or direct support functions (Business Management/COO, Business Controls, Product Control, Operational Risk, Compliance, Audit, etc.).'))
  assert.ok(detail.requiredSkills.includes('Knowledge of the India Financial Services regulatory environment and associated mandates.'))
  assert.match(detail.jobDescription, /Join us as Macro and Credit BCO - India where you will:/i)
  assert.equal(
    detail.applyUrl,
    'https://barclays.wd3.myworkdayjobs.com/External_Career_Site_Barclays/job/Mumbai-Altimus/Macro-and-Credit-BCO---India_JR-0000090657-7/apply',
  )
  assert.equal(
    detail.sourceUrl,
    'https://search.jobs.barclays/job/mumbai/macro-and-credit-bco-india/13015/92127468928',
  )
})

test('extractJobDetail derives Barclays experience from official detail descriptions when numeric years are present', async () => {
  const barclays = await loadBarclaysModule()
  assert.ok(barclays)

  const detail = barclays.extractJobDetail(DETAIL_WITH_EXPERIENCE_HTML, {
    title: 'Assistant Vice President - Applied AI Engineer',
    company: 'Barclays',
    department: null,
    location: 'Bengaluru, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: '98506870816',
    requisitionId: '98506870816',
    sourceUrl: 'https://search.jobs.barclays/job/bengaluru/assistant-vice-president-applied-ai-engineer/13015/98506870816',
    applyUrl: 'https://search.jobs.barclays/job/bengaluru/assistant-vice-president-applied-ai-engineer/13015/98506870816',
  })

  assert.equal(detail.experienceRequired, '8+ years')
  assert.match(detail.jobDescription, /8\+ years software engineering experience/i)
})

test('extractJobDetail keeps Barclays experience null when the detail page only has generic experience wording', async () => {
  const barclays = await loadBarclaysModule()
  assert.ok(barclays)

  const detail = barclays.extractJobDetail(DETAIL_WITH_GENERIC_EXPERIENCE_HTML, {
    title: 'PB India Banking Product Manager - AVP',
    company: 'Barclays',
    department: null,
    location: 'Mumbai, India',
    city: 'Mumbai',
    country: 'India',
    jobId: '97553105744',
    requisitionId: '97553105744',
    sourceUrl: 'https://search.jobs.barclays/job/mumbai/pb-india-banking-product-manager-avp/13015/97553105744',
    applyUrl: 'https://search.jobs.barclays/job/mumbai/pb-india-banking-product-manager-avp/13015/97553105744',
  })

  assert.equal(detail.experienceRequired, null)
})

test('normalizeScrapedJob does not turn Barclays graduate-degree requirements into fresher roles', async () => {
  const barclays = await loadBarclaysModule()
  assert.ok(barclays)

  const detail = barclays.extractJobDetail(DETAIL_WITH_GENERIC_EXPERIENCE_HTML, {
    title: 'PB India Banking Product Manager - AVP',
    company: 'Barclays',
    department: null,
    location: 'Mumbai, India',
    city: 'Mumbai',
    country: 'India',
    jobId: '97553105744',
    requisitionId: '97553105744',
    sourceUrl: 'https://search.jobs.barclays/job/mumbai/pb-india-banking-product-manager-avp/13015/97553105744',
    applyUrl: 'https://search.jobs.barclays/job/mumbai/pb-india-banking-product-manager-avp/13015/97553105744',
  })

  const normalized = normalizeScrapedJob(detail, {
    source: 'barclays',
    companyName: 'Barclays',
    companyCareerPage: 'https://search.jobs.barclays/search-jobs/india',
    atsPlatform: 'talentbrew-radancy',
  })

  assert.equal(normalized.experienceRequired, null)
  assert.equal(normalized.experienceProfile?.evidence ?? null, null)
  assert.equal(normalized.experienceLevel, 'Senior Level')
  assert.equal(normalized.jobType, 'Full-time Experienced')
  assert.equal(normalized.seniority, 'Manager')
})

test('normalizeScrapedJob composes Barclays India roles from the public detail pages', async () => {
  const barclays = await loadBarclaysModule()
  assert.ok(barclays)

  const detail = barclays.extractJobDetail(readFixture('job-detail-macro-and-credit-bco-india.html'), {
    title: 'Macro and Credit BCO - India',
    company: 'Barclays',
    department: null,
    location: 'Mumbai, India',
    city: 'Mumbai',
    country: 'India',
    jobId: '92127468928',
    requisitionId: '92127468928',
    sourceUrl: 'https://search.jobs.barclays/job/mumbai/macro-and-credit-bco-india/13015/92127468928',
    applyUrl: 'https://search.jobs.barclays/job/mumbai/macro-and-credit-bco-india/13015/92127468928',
  })

  const normalized = normalizeScrapedJob(detail, {
    source: 'barclays',
    companyName: 'Barclays',
    companyCareerPage: 'https://search.jobs.barclays/search-jobs/india',
    atsPlatform: 'talentbrew-radancy',
  })

  assert.equal(normalized.employmentType, 'Full-time')
  assert.equal(normalized.jobType, 'Unspecified')
})

test('run paginates Barclays India pages, enriches detail pages, and decorates shared runner fields', async () => {
  const barclays = await loadBarclaysModule()
  assert.ok(barclays)

  const requests = []
  const scraper = barclays.createBarclaysScraper({ maxPages: 1, maxJobs: 1, includeDetails: true })

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requests.push(url)
      if (url === barclays.buildSearchUrl()) {
        return readFixture('search-results-page-1.html')
      }
      if (url === 'https://search.jobs.barclays/job/mumbai/macro-and-credit-bco-india/13015/92127468928') {
        return readFixture('job-detail-macro-and-credit-bco-india.html')
      }
      throw new Error(`Unexpected Barclays URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [
    barclays.buildSearchUrl(),
    'https://search.jobs.barclays/job/mumbai/macro-and-credit-bco-india/13015/92127468928',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'barclays')
  assert.equal(jobs[0].company, 'Barclays')
  assert.equal(jobs[0].jobId, '92127468928')
  assert.equal(jobs[0].requisitionId, 'JR-0000090657')
  assert.equal(
    jobs[0].applyUrl,
    'https://barclays.wd3.myworkdayjobs.com/External_Career_Site_Barclays/job/Mumbai-Altimus/Macro-and-Credit-BCO---India_JR-0000090657-7/apply',
  )
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})

test('run stops when Barclays TalentBrew repeats the next-page URL', async () => {
  const barclays = await loadBarclaysModule()
  assert.ok(barclays)

  const repeatedNextUrl = 'https://search.jobs.barclays/search-jobs/india&p=2'
  const requests = []
  const jobs = await barclays.createBarclaysScraper({ maxPages: 10, includeDetails: false }).run({
    fetchText: async (url) => {
      requests.push(url)
      if (url === barclays.buildSearchUrl() || url === repeatedNextUrl) {
        return readFixture('search-results-page-1.html')
      }
      throw new Error(`Unexpected Barclays URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [barclays.buildSearchUrl(), repeatedNextUrl])
  assert.equal(jobs.length, 2)
})

test('run bounds default Barclays fetches with abort signals', async () => {
  const barclays = await loadBarclaysModule()
  assert.ok(barclays)

  const originalFetch = globalThis.fetch
  const requests = []
  globalThis.fetch = async (url, init = {}) => {
    requests.push({ url: String(url), signal: init.signal })

    if (url === barclays.buildSearchUrl()) {
      return { ok: true, status: 200, text: async () => readFixture('search-results-page-1.html') }
    }
    if (url === 'https://search.jobs.barclays/job/mumbai/macro-and-credit-bco-india/13015/92127468928') {
      return { ok: true, status: 200, text: async () => DETAIL_WITH_EXPERIENCE_HTML }
    }

    assert.fail(`Unexpected Barclays URL: ${url}`)
  }

  try {
    const jobs = await barclays.createBarclaysScraper({ maxPages: 1, maxJobs: 1 }).run()

    assert.equal(jobs.length, 1)
    assert.equal(
      requests.map((request) => request.url).includes('https://search.jobs.barclays/job/mumbai/macro-and-credit-bco-india/13015/92127468928'),
      true,
    )
    assert.equal(jobs[0].experienceRequired, '8+ years')
    assert.ok(requests.every((request) => request.signal), 'each fetch should include an abort signal')
    assert.ok(requests.every((request) => typeof request.signal.aborted === 'boolean'))
  } finally {
    globalThis.fetch = originalFetch
  }
})
