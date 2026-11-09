import assert from 'node:assert/strict'
import test from 'node:test'

const loadVedantuModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Vedantu scraper module at ./script.js')
  }
}

const officialCareersHtml = `
  <main>
    <h1>Find Your Role</h1>
    <a href="https://courses.vedantu.com/acads-career-page/" target="_blank">Academic roles</a>
    <a href="https://www.linkedin.com/jobs/search/?currentJobId=4399637113&amp;f_C=3139796&amp;geoId=92000000&amp;origin=COMPANY_PAGE_JOBS_CLUSTER_EXPANSION&amp;originToLandingJobPostings=4399637113%2C4394757689%2C4400750377%2C4392857261%2C4389532762%2C4389534337%2C4388933368%2C4389567642%2C4397271687" target="_blank">Corporate jobs</a>
  </main>
`

const searchResultsHtml = `
  <section class="two-pane-serp-page__results-list">
    <ul class="jobs-search__results-list">
      <li>
        <div class="base-card base-search-card job-search-card" data-entity-urn="urn:li:jobPosting:4432977336">
          <a class="base-card__full-link absolute top-0 right-0 bottom-0 left-0 p-0 z-[2] outline-offset-[4px]" href="https://in.linkedin.com/jobs/view/academic-counselor-at-vedantu-4432977336?position=1&amp;pageNum=0"></a>
          <div class="base-search-card__info">
            <h3 class="base-search-card__title">Academic Counselor</h3>
            <h4 class="base-search-card__subtitle">
              <a class="hidden-nested-link" href="https://www.linkedin.com/company/vedantu">Vedantu</a>
            </h4>
            <div class="base-search-card__metadata">
              <span class="job-search-card__location">Bengaluru, Karnataka, India</span>
              <time class="job-search-card__listdate" datetime="2026-06-26">2 weeks ago</time>
            </div>
          </div>
        </div>
      </li>
      <li>
        <div class="base-card base-search-card job-search-card" data-entity-urn="urn:li:jobPosting:9999999999">
          <a class="base-card__full-link absolute top-0 right-0 bottom-0 left-0 p-0 z-[2] outline-offset-[4px]" href="https://in.linkedin.com/jobs/view/non-india-role-at-vedantu-9999999999?position=2&amp;pageNum=0"></a>
          <div class="base-search-card__info">
            <h3 class="base-search-card__title">Global Expansion Lead</h3>
            <h4 class="base-search-card__subtitle">
              <a class="hidden-nested-link" href="https://www.linkedin.com/company/vedantu">Vedantu</a>
            </h4>
            <div class="base-search-card__metadata">
              <span class="job-search-card__location">Dubai, United Arab Emirates</span>
              <time class="job-search-card__listdate" datetime="2026-06-20">2 weeks ago</time>
            </div>
          </div>
        </div>
      </li>
    </ul>
  </section>
`

const currentSearchResultsHtml = `
  <section class="two-pane-serp-page__results-list">
    <ul class="jobs-search__results-list">
      <li>
        <div class="base-card relative w-full hover:no-underline focus:no-underline base-card--link base-search-card base-search-card--link job-search-card" data-entity-urn="urn:li:jobPosting:4453582344">
          <a class="base-card__full-link absolute top-0 right-0 bottom-0 left-0 p-0 z-[2] outline-offset-[4px]" href="https://in.linkedin.com/jobs/view/data-analyst-at-vedantu-4453582344?position=2&amp;pageNum=0&amp;refId=current-shape&amp;trackingId=current-shape"></a>
          <div class="base-search-card__info">
            <h3 class="base-search-card__title">
              Data Analyst
            </h3>
            <h4 class="base-search-card__subtitle">
              <a class="hidden-nested-link" href="https://in.linkedin.com/company/vedantu?trk=public_jobs_jserp-result_job-search-card-subtitle">Vedantu</a>
            </h4>
            <div class="base-search-card__metadata">
              <span class="job-search-card__location">
                Bengaluru, Karnataka, India
              </span>
              <div class="job-posting-benefits text-sm">
                <span class="job-posting-benefits__text">Actively Hiring</span>
              </div>
              <time class="job-search-card__listdate--new" datetime="2026-08-20">
                13 hours ago
              </time>
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
      <title>Vedantu hiring Academic Counselor in Bengaluru, Karnataka, India | LinkedIn</title>
      <script type="application/ld+json">
        {
          "@context": "http://schema.org",
          "@type": "JobPosting",
          "datePosted": "2026-06-26T09:35:58.000Z",
          "employmentType": "FULL_TIME",
          "description": "&lt;p&gt;We are seeking an experienced and highly motivated &lt;strong&gt;Academic Counselor&lt;/strong&gt; to join our team at Vedantu.&lt;/p&gt;",
          "title": "Academic Counselor",
          "hiringOrganization": {
            "@type": "Organization",
            "name": "Vedantu"
          },
          "jobLocation": {
            "@type": "Place",
            "address": {
              "@type": "PostalAddress",
              "addressLocality": "Bengaluru",
              "addressRegion": "Karnataka",
              "addressCountry": "IN"
            }
          }
        }
      </script>
    </head>
    <body></body>
  </html>
`

test('Vedantu scraper validates the official careers handoff and keeps only India jobs from public LinkedIn search', async () => {
  const vedantu = await loadVedantuModule()
  const jobs = vedantu.extractSearchResults(searchResultsHtml)

  assert.equal(vedantu.SOURCE, 'vedantu')
  assert.equal(vedantu.COMPANY, 'Vedantu')
  assert.equal(vedantu.CAREERS_URL, 'https://www.vedantu.com/careers')
  assert.equal(vedantu.LINKEDIN_COMPANY_URL, 'https://in.linkedin.com/company/vedantu')
  assert.equal(
    vedantu.LINKEDIN_JOBS_URL,
    'https://www.linkedin.com/jobs/search/?currentJobId=4399637113&f_C=3139796&geoId=92000000&origin=COMPANY_PAGE_JOBS_CLUSTER_EXPANSION&originToLandingJobPostings=4399637113%2C4394757689%2C4400750377%2C4392857261%2C4389532762%2C4389534337%2C4388933368%2C4389567642%2C4397271687',
  )
  assert.equal(vedantu.pageIndicatesOfficialLinkedinHandoff(officialCareersHtml), true)
  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Academic Counselor',
    company: 'Vedantu',
    department: null,
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: '4432977336',
    requisitionId: '4432977336',
    sourceUrl: 'https://in.linkedin.com/jobs/view/academic-counselor-at-vedantu-4432977336?position=1&pageNum=0',
    applyUrl: 'https://in.linkedin.com/jobs/view/academic-counselor-at-vedantu-4432977336?position=1&pageNum=0',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-06-26',
    closingDate: null,
    jobDescription: null,
  })
})

test('Vedantu scraper accepts the current LinkedIn jobs card markup with the new listdate class', async () => {
  const vedantu = await loadVedantuModule()
  const jobs = vedantu.extractSearchResults(currentSearchResultsHtml)

  assert.deepEqual(jobs, [{
    title: 'Data Analyst',
    company: 'Vedantu',
    department: null,
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: '4453582344',
    requisitionId: '4453582344',
    sourceUrl: 'https://in.linkedin.com/jobs/view/data-analyst-at-vedantu-4453582344?position=2&pageNum=0&refId=current-shape&trackingId=current-shape',
    applyUrl: 'https://in.linkedin.com/jobs/view/data-analyst-at-vedantu-4453582344?position=2&pageNum=0&refId=current-shape&trackingId=current-shape',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-08-20',
    closingDate: null,
    jobDescription: null,
  }])
})

test('Vedantu scraper enriches a public LinkedIn detail page via JobPosting JSON-LD', async () => {
  const vedantu = await loadVedantuModule()
  const detail = vedantu.extractJobDetail(detailHtml)

  assert.deepEqual(detail, {
    company: 'Vedantu',
    location: 'Bengaluru, Karnataka, IN',
    city: 'Bengaluru',
    country: 'India',
    employmentType: 'Full-time',
    postingDate: '2026-06-26',
    jobDescription: 'We are seeking an experienced and highly motivated Academic Counselor to join our team at Vedantu.',
  })
})

test('Vedantu scraper follows the official careers page to LinkedIn and decorates India jobs', async () => {
  const vedantu = await loadVedantuModule()
  const requestedUrls = []
  const scraper = vedantu.createVedantuScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === vedantu.CAREERS_URL) return officialCareersHtml
      if (url === vedantu.LINKEDIN_COMPANY_URL) {
        return '<title>Vedantu | LinkedIn</title><link rel="canonical" href="https://in.linkedin.com/company/vedantu"><code id="flagshipOrganizationTracking">{"organization":{"objectUrn":"urn:li:organization:3139796"}}</code>'
      }
      if (url === vedantu.LINKEDIN_JOBS_URL) return searchResultsHtml
      if (url.startsWith('https://in.linkedin.com/jobs/view/academic-counselor-at-vedantu-4432977336')) return detailHtml

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    vedantu.CAREERS_URL,
    vedantu.LINKEDIN_COMPANY_URL,
    vedantu.LINKEDIN_JOBS_URL,
    'https://in.linkedin.com/jobs/view/academic-counselor-at-vedantu-4432977336?position=1&pageNum=0',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'vedantu')
  assert.equal(jobs[0].employmentType, 'Full-time')
  assert.equal(jobs[0].link, 'https://in.linkedin.com/jobs/view/academic-counselor-at-vedantu-4432977336?position=1&pageNum=0')
})

test('Vedantu scraper fails closed when the official careers page no longer exposes the verified LinkedIn handoff', async () => {
  const vedantu = await loadVedantuModule()

  await assert.rejects(
    vedantu.createVedantuScraper().run({
      fetchText: async (url) => {
        if (url === vedantu.CAREERS_URL) return '<main><h1>Find Your Role</h1><p>No public jobs link.</p></main>'
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /linkedin handoff/i,
  )
})
