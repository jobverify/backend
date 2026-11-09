import assert from 'node:assert/strict'
import test from 'node:test'

const trellModule = await import('../../scraper/trell/script.js').catch(() => ({}))

const {
  COMPANY,
  DISPOSITION,
  LINKEDIN_COMPANY_PAGE_URL,
  LINKEDIN_INDIA_JOBS_URL,
  SOURCE,
  VERIFIED_SURFACE_SUMMARY,
  createTrellScraper,
  extractSearchResults,
  hasVerifiedLinkedInJobsPageSignal,
  pageIndicatesTrellLinkedInCompany,
  run,
} = trellModule

const VERIFIED_LINKEDIN_COMPANY_HTML = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Trell | LinkedIn</title>
    </head>
    <body>
      <code id="flagshipOrganizationTracking"><!--{"organization":{"objectUrn":"urn:li:organization:10796691"}}--></code>
      <p>India's largest lifestyle social commerce platform.</p>
      <p>Bangalore, Karnataka</p>
      <a href="https://trell.co/">Website</a>
    </body>
  </html>
`

const VERIFIED_NO_MATCH_SEARCH_HTML = `
  <!doctype html>
  <html lang="en">
    <body>
      <h1>LinkedIn</h1>
      <p>Trell</p>
      <p>We couldn't find a match</p>
      <p>0 jobs jobs in India</p>
    </body>
  </html>
`

const VERIFIED_INDIA_JOBS_HTML = `
  <section class="two-pane-serp-page__results-list">
    <ul class="jobs-search__results-list">
      <li>
        <div class="base-card base-search-card job-search-card" data-entity-urn="urn:li:jobPosting:765001">
          <a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/community-manager-at-trell-765001"></a>
          <div class="base-search-card__info">
            <h3 class="base-search-card__title">Community Manager</h3>
            <h4 class="base-search-card__subtitle">
              <a class="hidden-nested-link" href="https://www.linkedin.com/company/trell/">Trell</a>
            </h4>
            <div class="base-search-card__metadata">
              <span class="job-search-card__location">Bengaluru, Karnataka, India</span>
              <time class="job-search-card__listdate" datetime="2026-08-01">1 week ago</time>
            </div>
          </div>
        </div>
      </li>
    </ul>
  </section>
`

test('Trell validates the verified public LinkedIn company page and zero-results India jobs search', async () => {
  const requestedUrls = []

  const jobs = await run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === LINKEDIN_COMPANY_PAGE_URL) return VERIFIED_LINKEDIN_COMPANY_HTML
      if (url === LINKEDIN_INDIA_JOBS_URL) return VERIFIED_NO_MATCH_SEARCH_HTML
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [LINKEDIN_COMPANY_PAGE_URL, LINKEDIN_INDIA_JOBS_URL])
  assert.deepEqual(jobs, [])
  assert.equal(SOURCE, 'trell')
  assert.equal(COMPANY, 'Trell')
  assert.equal(DISPOSITION, 'verified-linkedin-company-page-plus-public-india-jobs-search')
  assert.match(VERIFIED_SURFACE_SUMMARY, /Sunday, August 2, 2026/)
  assert.equal(typeof createTrellScraper, 'function')
  assert.equal(pageIndicatesTrellLinkedInCompany(VERIFIED_LINKEDIN_COMPANY_HTML), true)
  assert.equal(hasVerifiedLinkedInJobsPageSignal(VERIFIED_NO_MATCH_SEARCH_HTML), true)
})

test('Trell extracts India jobs when the verified public LinkedIn search exposes them', () => {
  assert.deepEqual(extractSearchResults(VERIFIED_INDIA_JOBS_HTML), [
    {
      title: 'Community Manager',
      company: 'Trell',
      department: null,
      location: 'Bengaluru, Karnataka, India',
      city: 'Bengaluru',
      country: 'India',
      jobId: '765001',
      requisitionId: '765001',
      sourceUrl: 'https://www.linkedin.com/jobs/view/community-manager-at-trell-765001',
      applyUrl: 'https://www.linkedin.com/jobs/view/community-manager-at-trell-765001',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-08-01',
      closingDate: null,
      jobDescription: null,
    },
  ])
})

test('Trell rejects when the verified LinkedIn company surface disappears', async () => {
  await assert.rejects(
    run({
      fetchText: async (url) => {
        if (url === LINKEDIN_COMPANY_PAGE_URL) {
          return `
            <html>
              <head><title>About Example | LinkedIn</title></head>
              <body><h1>Example</h1></body>
            </html>
          `
        }

        return VERIFIED_NO_MATCH_SEARCH_HTML
      },
    }),
    /LinkedIn company page no longer matches the verified public organization surface/i,
  )
})

test('Trell rejects when the verified LinkedIn India jobs search shell disappears', async () => {
  await assert.rejects(
    run({
      fetchText: async (url) => {
        if (url === LINKEDIN_COMPANY_PAGE_URL) return VERIFIED_LINKEDIN_COMPANY_HTML
        return '<html><body><h1>Search</h1><p>No public LinkedIn jobs shell markers.</p></body></html>'
      },
    }),
    /LinkedIn India jobs search page no longer matches the verified public search shell/i,
  )
})
