import assert from 'node:assert/strict'
import test from 'node:test'

const loadLixilModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected LIXIL scraper module at ./script.js')
  }
}

const officialCareersHtml = `
  <main>
    <h1>Careers</h1>
    <p>Apply directly on LinkedIn or on our dedicated regional career websites.</p>
    <a href="https://www.linkedin.com/company/lixil-global/jobs/">LinkedIn</a>
    <a href="https://www.lixil.co.jp/corporate/recruit/">Japan</a>
    <a href="https://careers.lixilamericas.com/">Americas</a>
  </main>
`

const currentCareersHtml = `
  <html>
    <head>
      <title>Careers | LIXIL</title>
    </head>
    <body>
      <main>
        <h1>Careers</h1>
        <h2>A HOME FOR EVERYONE</h2>
        <p>Your career can help shape that future and create sustainable value.</p>
        <a href="https://www.linkedin.com/company/lixil-global/jobs/">LinkedIn</a>
        <a href="https://www.lixil.co.jp/corporate/recruit/">Japan</a>
        <a href="https://careers.lixilamericas.com/">Americas</a>
      </main>
    </body>
  </html>
`

const searchResultsHtml = `
  <section class="two-pane-serp-page__results-list">
    <ul class="jobs-search__results-list">
      <li>
        <div class="base-card base-search-card job-search-card" data-entity-urn="urn:li:jobPosting:4477001001">
          <a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/senior-data-engineer-at-lixil-4477001001?position=1&amp;pageNum=0"></a>
          <div class="base-search-card__info">
            <h3 class="base-search-card__title">Senior Data Engineer</h3>
            <h4 class="base-search-card__subtitle">
              <a class="hidden-nested-link" href="https://www.linkedin.com/company/lixil-global/">LIXIL</a>
            </h4>
            <div class="base-search-card__metadata">
              <span class="job-search-card__location">Bengaluru, Karnataka, India</span>
              <time class="job-search-card__listdate" datetime="2026-07-09">1 day ago</time>
            </div>
          </div>
        </div>
      </li>
      <li>
        <div class="base-card base-search-card job-search-card" data-entity-urn="urn:li:jobPosting:4477001002">
          <a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/regional-specification-manager-at-lixil-4477001002?position=2&amp;pageNum=0"></a>
          <div class="base-search-card__info">
            <h3 class="base-search-card__title">Regional Specification Manager</h3>
            <h4 class="base-search-card__subtitle">
              <a class="hidden-nested-link" href="https://www.linkedin.com/company/lixil-global/">LIXIL</a>
            </h4>
            <div class="base-search-card__metadata">
              <span class="job-search-card__location">London Area, United Kingdom</span>
              <time class="job-search-card__listdate" datetime="2026-07-10">5 hours ago</time>
            </div>
          </div>
        </div>
      </li>
    </ul>
  </section>
`

const currentSearchResultsHtml = `
  <section>
    <ul>
      <li>
        <div class="base-main-card job-search-card" data-entity-urn="urn:li:jobPosting:4448101669">
          <a class="base-card__full-link" href="https://in.linkedin.com/jobs/view/area-sales-manager-at-lixil-4448101669?refId=test&amp;trackingId=test"></a>
          <div class="base-main-card__info">
            <h3 class="base-main-card__title">Area Sales Manager</h3>
            <h4 class="base-main-card__subtitle">
              <a class="hidden-nested-link" href="https://jp.linkedin.com/company/lixil-global">LIXIL</a>
            </h4>
            <div class="base-main-card__metadata">
              <span class="main-job-card__location">Gurugram, Haryana, India</span>
              <time class="main-job-card__listdate--new" datetime="2026-08-02">4 hours ago</time>
            </div>
          </div>
        </div>
      </li>
      <li>
        <div class="base-main-card job-search-card" data-entity-urn="urn:li:jobPosting:4448103656">
          <a class="base-card__full-link" href="https://pt.linkedin.com/jobs/view/activation-manager-portugal-at-lixil-4448103656?refId=test&amp;trackingId=test"></a>
          <div class="base-main-card__info">
            <h3 class="base-main-card__title">Activation Manager Portugal</h3>
            <h4 class="base-main-card__subtitle">
              <a class="hidden-nested-link" href="https://jp.linkedin.com/company/lixil-global">LIXIL</a>
            </h4>
            <div class="base-main-card__metadata">
              <span class="main-job-card__location">Albergaria-A-Velha, Aveiro, Portugal</span>
              <time class="main-job-card__listdate--new" datetime="2026-08-02">4 hours ago</time>
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
      <title>LIXIL hiring Senior Data Engineer in Bengaluru, Karnataka, India | LinkedIn</title>
      <script type="application/ld+json">
        {
          "@context": "http://schema.org",
          "@type": "JobPosting",
          "datePosted": "2026-07-09T05:45:00.000Z",
          "employmentType": "FULL_TIME",
          "description": "&lt;p&gt;Build analytics pipelines and platform tooling for digital teams.&lt;/p&gt;",
          "title": "Senior Data Engineer",
          "hiringOrganization": {
            "@type": "Organization",
            "name": "LIXIL"
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

const currentDetailHtml = `
  <html>
    <head>
      <title>LIXIL hiring Area Sales Manager in Gurugram, Haryana, India | LinkedIn</title>
      <script type="application/ld+json">
        {
          "@context": "http://schema.org",
          "@type": "JobPosting",
          "datePosted": "2026-08-02T05:45:00.000Z",
          "employmentType": "FULL_TIME",
          "description": "&lt;p&gt;Drive distribution sales initiatives across North Kerala markets.&lt;/p&gt;",
          "title": "Area Sales Manager",
          "hiringOrganization": {
            "@type": "Organization",
            "name": "LIXIL"
          },
          "jobLocation": {
            "@type": "Place",
            "address": {
              "@type": "PostalAddress",
              "addressLocality": "Gurugram",
              "addressCountry": "IN"
            }
          }
        }
      </script>
    </head>
    <body></body>
  </html>
`

test('LIXIL scraper validates the official careers handoff and keeps only India jobs from LinkedIn', async () => {
  const lixil = await loadLixilModule()

  assert.equal(lixil.pageIndicatesOfficialCareersHandoff(officialCareersHtml), true)
  assert.equal(lixil.pageIndicatesOfficialCareersHandoff(currentCareersHtml), true)

  const jobs = lixil.extractSearchResults(searchResultsHtml)
  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Senior Data Engineer',
    company: 'LIXIL',
    department: null,
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: '4477001001',
    requisitionId: '4477001001',
    sourceUrl: 'https://www.linkedin.com/jobs/view/senior-data-engineer-at-lixil-4477001001?position=1&pageNum=0',
    applyUrl: 'https://www.linkedin.com/jobs/view/senior-data-engineer-at-lixil-4477001001?position=1&pageNum=0',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-09',
    closingDate: null,
    jobDescription: null,
  })

  const currentJobs = lixil.extractSearchResults(currentSearchResultsHtml)
  assert.equal(currentJobs.length, 1)
  assert.deepEqual(currentJobs[0], {
    title: 'Area Sales Manager',
    company: 'LIXIL',
    department: null,
    location: 'Gurugram, Haryana, India',
    city: 'Gurugram',
    country: 'India',
    jobId: '4448101669',
    requisitionId: '4448101669',
    sourceUrl: 'https://in.linkedin.com/jobs/view/area-sales-manager-at-lixil-4448101669?refId=test&trackingId=test',
    applyUrl: 'https://in.linkedin.com/jobs/view/area-sales-manager-at-lixil-4448101669?refId=test&trackingId=test',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-08-02',
    closingDate: null,
    jobDescription: null,
  })
})

test('LIXIL scraper enriches a LinkedIn job detail page via JobPosting JSON-LD', async () => {
  const lixil = await loadLixilModule()

  const detail = lixil.extractJobDetail(detailHtml)
  assert.deepEqual(detail, {
    company: 'LIXIL',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    country: 'India',
    employmentType: 'Full-time',
    postingDate: '2026-07-09',
    jobDescription: 'Build analytics pipelines and platform tooling for digital teams.',
  })

  const currentDetail = lixil.extractJobDetail(currentDetailHtml)
  assert.deepEqual(currentDetail, {
    company: 'LIXIL',
    location: 'Gurugram, India',
    city: 'Gurugram',
    country: 'India',
    employmentType: 'Full-time',
    postingDate: '2026-08-02',
    jobDescription: 'Drive distribution sales initiatives across North Kerala markets.',
  })
})

test('LIXIL scraper follows the official careers page to LinkedIn and decorates India jobs', async () => {
  const lixil = await loadLixilModule()
  const requestedUrls = []

  const jobs = await lixil.createLixilScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === lixil.CAREER_PAGE_URL) return currentCareersHtml
      if (url === lixil.LINKEDIN_COMPANY_JOBS_URL) return currentSearchResultsHtml
      if (url.startsWith('https://in.linkedin.com/jobs/view/area-sales-manager-at-lixil-4448101669')) {
        return currentDetailHtml
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    lixil.CAREER_PAGE_URL,
    lixil.LINKEDIN_COMPANY_JOBS_URL,
    'https://in.linkedin.com/jobs/view/area-sales-manager-at-lixil-4448101669?refId=test&trackingId=test',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'lixil')
  assert.equal(jobs[0].company, 'LIXIL')
  assert.equal(jobs[0].employmentType, 'Full-time')
  assert.equal(jobs[0].title, 'Area Sales Manager')
  assert.equal(jobs[0].location, 'Gurugram, Haryana, India')
  assert.equal(jobs[0].link, 'https://in.linkedin.com/jobs/view/area-sales-manager-at-lixil-4448101669?refId=test&trackingId=test')
})
