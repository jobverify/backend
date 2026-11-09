import assert from 'node:assert/strict'
import test from 'node:test'

const loadConvinAiModule = async () => {
  try {
    return await import('../../scraper/convinai/script.js')
  } catch {
    assert.fail('Expected Convin scraper module at ../../scraper/convinai/script.js')
  }
}

const officialSiteHtml = `
  <main>
    <div class="footer-links new">
      <a href="/about-us" class="footer-links is-white">About Us</a>
      <a href="https://www.linkedin.com/company/convin/jobs/" class="footer-links is-white">Careers</a>
      <a href="/news" class="footer-links is-white">Press</a>
    </div>
  </main>
`

const searchResultsHtml = `
  <section class="two-pane-serp-page__results-list">
    <ul class="jobs-search__results-list">
      <li>
        <div class="base-card base-search-card job-search-card" data-entity-urn="urn:li:jobPosting:4433642899">
          <a class="base-card__full-link" href="https://in.linkedin.com/jobs/view/project-manager-at-convin-4433642899?position=1&amp;pageNum=0&amp;refId=test-ref&amp;trackingId=test-track"></a>
          <div class="base-search-card__info">
            <h3 class="base-search-card__title">Project Manager</h3>
            <h4 class="base-search-card__subtitle">
              <a class="hidden-nested-link" href="https://in.linkedin.com/company/convin?trk=public_jobs_jserp-result_job-search-card-subtitle">Convin</a>
            </h4>
            <div class="base-search-card__metadata">
              <span class="job-search-card__location">Delhi, India</span>
              <time class="job-search-card__listdate" datetime="2026-06-29">1 week ago</time>
            </div>
          </div>
        </div>
      </li>
      <li>
        <div class="base-card base-search-card job-search-card" data-entity-urn="urn:li:jobPosting:4433000000">
          <a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/customer-success-manager-at-convin-4433000000"></a>
          <div class="base-search-card__info">
            <h3 class="base-search-card__title">Customer Success Manager</h3>
            <h4 class="base-search-card__subtitle">
              <a class="hidden-nested-link" href="https://in.linkedin.com/company/convin?trk=public_jobs_jserp-result_job-search-card-subtitle">Convin</a>
            </h4>
            <div class="base-search-card__metadata">
              <span class="job-search-card__location">Dubai, Dubai, United Arab Emirates</span>
              <time class="job-search-card__listdate" datetime="2026-06-25">1 week ago</time>
            </div>
          </div>
        </div>
      </li>
    </ul>
  </section>
`

const detailHtml = `
  <html>
    <head>
      <script type="application/ld+json">
        {
          "@context": "http://schema.org",
          "@type": "JobPosting",
          "datePosted": "2026-06-29T06:43:10.000Z",
          "employmentType": "FULL_TIME",
          "description": "&lt;p&gt;&lt;strong&gt;Job Title:&lt;/strong&gt; Project Manager&lt;/p&gt;&lt;p&gt;Drive BFSI voice bot campaigns for Convin customers.&lt;/p&gt;",
          "hiringOrganization": {
            "@type": "Organization",
            "name": "Convin"
          },
          "jobLocation": {
            "@type": "Place",
            "address": {
              "@type": "PostalAddress",
              "addressLocality": "Delhi",
              "addressRegion": null,
              "addressCountry": "IN"
            }
          }
        }
      </script>
    </head>
  </html>
`

test('detects the official Convin careers handoff and keeps only India listings', async () => {
  const convin = await loadConvinAiModule()

  assert.equal(convin.CAREER_PAGE_URL, 'https://convin.ai/')
  assert.equal(convin.LINKEDIN_COMPANY_JOBS_URL, 'https://www.linkedin.com/company/convin/jobs/')
  assert.equal(convin.LINKEDIN_INDIA_JOBS_URL, 'https://www.linkedin.com/jobs/search/?f_C=30241839&geoId=102713980')
  assert.equal(convin.pageIndicatesLinkedinJobs(officialSiteHtml), true)

  assert.deepEqual(convin.extractSearchResults(searchResultsHtml), [{
    title: 'Project Manager',
    company: 'Convin',
    department: null,
    location: 'Delhi, India',
    city: 'Delhi',
    country: 'India',
    jobId: '4433642899',
    requisitionId: '4433642899',
    sourceUrl: 'https://in.linkedin.com/jobs/view/project-manager-at-convin-4433642899?position=1&pageNum=0&refId=test-ref&trackingId=test-track',
    applyUrl: 'https://in.linkedin.com/jobs/view/project-manager-at-convin-4433642899?position=1&pageNum=0&refId=test-ref&trackingId=test-track',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-06-29',
    closingDate: null,
    jobDescription: null,
  }])
})

test('extracts Convin LinkedIn JobPosting JSON-LD detail fields', async () => {
  const convin = await loadConvinAiModule()

  assert.deepEqual(convin.extractJobDetail(detailHtml), {
    company: 'Convin',
    location: 'Delhi, India',
    city: 'Delhi',
    country: 'India',
    employmentType: 'Full-time',
    postingDate: '2026-06-29',
    jobDescription: 'Job Title: Project Manager Drive BFSI voice bot campaigns for Convin customers.',
  })
})

test('run follows the official Convin site to LinkedIn and decorates scraped jobs', async () => {
  const convin = await loadConvinAiModule()
  const requestedUrls = []
  const scraper = convin.createConvinAiScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === convin.CAREER_PAGE_URL) return officialSiteHtml
      if (url === convin.LINKEDIN_INDIA_JOBS_URL) return searchResultsHtml
      if (url.startsWith('https://in.linkedin.com/jobs/view/project-manager-at-convin-4433642899')) {
        return detailHtml
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    convin.CAREER_PAGE_URL,
    convin.LINKEDIN_INDIA_JOBS_URL,
    'https://in.linkedin.com/jobs/view/project-manager-at-convin-4433642899?position=1&pageNum=0&refId=test-ref&trackingId=test-track',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'convinai')
  assert.equal(jobs[0].link, 'https://in.linkedin.com/jobs/view/project-manager-at-convin-4433642899?position=1&pageNum=0&refId=test-ref&trackingId=test-track')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
