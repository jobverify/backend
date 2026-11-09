import assert from 'node:assert/strict'
import test from 'node:test'

const loadIqviaModule = async () => {
  try {
    return await import('../../scraper/iqvia/script.js')
  } catch (error) {
    assert.fail(`Expected IQVIA scraper module at ../../scraper/iqvia/script.js: ${error.message}`)
  }
}

const listingPageOneHtml = `
  <main>
    <h1>Job Listing</h1>
    <p class="results-count">Showing 1-2 of 3 jobs</p>
    <article class="job-card">
      <a class="job-title" href="/en/jobs/R1552506-0">Senior Data Analyst</a>
      <p class="job-location">Bengaluru, Karnataka, India</p>
      <p class="job-workplace">Hybrid</p>
    </article>
    <article class="job-card">
      <a class="job-title" href="/en/jobs/R1552507-0">Clinical Data Manager</a>
      <p class="job-location">Boston, Massachusetts, United States</p>
      <p class="job-workplace">Remote</p>
    </article>
  </main>
`

const listingPageTwoHtml = `
  <main>
    <h1>Job Listing</h1>
    <p class="results-count">Showing 3-3 of 3 jobs</p>
    <article class="job-card">
      <a class="job-title" href="/en/jobs/R1552600-0">Safety Associate</a>
      <p class="job-location">Pune, Maharashtra, India</p>
      <p class="job-workplace">On-site</p>
    </article>
  </main>
`

const seniorDataAnalystDetailHtml = `
  <main>
    <h1>Senior Data Analyst</h1>
    <dl>
      <dt>Job ID</dt>
      <dd>R1552506-0</dd>
      <dt>Location</dt>
      <dd>Bengaluru, Karnataka, India</dd>
      <dt>Workplace</dt>
      <dd>Hybrid</dd>
      <dt>Date Posted</dt>
      <dd>2026-07-01</dd>
    </dl>
    <section class="job-description">
      <p>Build real-world evidence dashboards for sponsor teams.</p>
      <ul>
        <li>SQL</li>
        <li>Python</li>
      </ul>
    </section>
    <a class="apply-now" href="/en/jobs/R1552506-0/apply">Apply Now</a>
  </main>
`

const safetyAssociateDetailHtml = `
  <main>
    <h1>Safety Associate</h1>
    <dl>
      <dt>Job ID</dt>
      <dd>R1552600-0</dd>
      <dt>Location</dt>
      <dd>Pune, Maharashtra, India</dd>
      <dt>Workplace</dt>
      <dd>On-site</dd>
      <dt>Date Posted</dt>
      <dd>2026-07-02</dd>
    </dl>
    <section class="job-description">
      <p>Support pharmacovigilance operations across India.</p>
    </section>
    <a class="apply-now" href="/en/jobs/R1552600-0/apply">Apply Now</a>
  </main>
`

test('run parses the public IQVIA HTML listings, keeps only India jobs, and decorates runner fields', async () => {
  const iqvia = await loadIqviaModule()

  assert.equal(iqvia.CAREERS_URL, 'https://jobs.iqvia.com/en')
  assert.equal(iqvia.JOBS_URL, 'https://jobs.iqvia.com/en/jobs')
  assert.equal(iqvia.buildListingUrl(), 'https://jobs.iqvia.com/en/jobs')
  assert.equal(iqvia.buildListingUrl(2), 'https://jobs.iqvia.com/en/jobs?page=2')
  assert.equal(iqvia.extractResultCount(listingPageOneHtml), 3)

  const listings = iqvia.extractSearchResults(listingPageOneHtml)
  assert.equal(listings.length, 1)
  assert.deepEqual(listings[0], {
    title: 'Senior Data Analyst',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    country: 'India',
    workplaceType: 'Hybrid',
    jobId: 'R1552506-0',
    requisitionId: 'R1552506-0',
    sourceUrl: 'https://jobs.iqvia.com/en/jobs/R1552506-0',
  })

  const detail = iqvia.extractJobDetail(seniorDataAnalystDetailHtml, listings[0])
  assert.deepEqual(detail, {
    title: 'Senior Data Analyst',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    country: 'India',
    workplaceType: 'Hybrid',
    jobId: 'R1552506-0',
    requisitionId: 'R1552506-0',
    sourceUrl: 'https://jobs.iqvia.com/en/jobs/R1552506-0',
    applyUrl: 'https://jobs.iqvia.com/en/jobs/R1552506-0/apply',
    postingDate: '2026-07-01',
    jobDescription: 'Build real-world evidence dashboards for sponsor teams. SQL Python',
    requiredSkills: ['SQL', 'Python'],
  })

  const requests = []
  const jobs = await iqvia.createIqviaScraper().run({
    maxPages: 2,
    fetchText: async (url) => {
      requests.push(url)

      if (url === iqvia.buildListingUrl()) return listingPageOneHtml
      if (url === iqvia.buildListingUrl(2)) return listingPageTwoHtml
      if (url === 'https://jobs.iqvia.com/en/jobs/R1552506-0') return seniorDataAnalystDetailHtml
      if (url === 'https://jobs.iqvia.com/en/jobs/R1552600-0') return safetyAssociateDetailHtml

      throw new Error(`Unexpected IQVIA URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [
    'https://jobs.iqvia.com/en/jobs',
    'https://jobs.iqvia.com/en/jobs?page=2',
    'https://jobs.iqvia.com/en/jobs/R1552506-0',
    'https://jobs.iqvia.com/en/jobs/R1552600-0',
    'https://jobs.iqvia.com/en/jobs/R1552506-0',
    'https://jobs.iqvia.com/en/jobs/R1552600-0',
    'https://jobs.iqvia.com/en/jobs',
    'https://jobs.iqvia.com/en/jobs?page=2',
  ])
  assert.equal(jobs.length, 2)

  const { scrapedAt: firstScrapedAt, sourceDetailComplete, nativeDetailProjection, sourcePostedDateRaw, firstEverPostedAt, ...firstJob } = jobs[0]
  assert.match(firstScrapedAt, /^\d{4}-\d{2}-\d{2}T/)
  assert.equal(sourceDetailComplete, true)
  assert.deepEqual(nativeDetailProjection, { ...detail, nativeTitle: 'Senior Data Analyst',
    nativeLocation: 'Bengaluru, Karnataka, India', nativeRequisitionId: 'R1552506-0' })
  assert.equal(sourcePostedDateRaw, '2026-07-01')
  assert.equal(firstEverPostedAt, null)
  assert.deepEqual(firstJob, {
    title: 'Senior Data Analyst',
    company: 'IQVIA',
    department: null,
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    country: 'India',
    workplaceType: 'Hybrid',
    jobId: 'R1552506-0',
    requisitionId: 'R1552506-0',
    sourceUrl: 'https://jobs.iqvia.com/en/jobs/R1552506-0',
    applyUrl: 'https://jobs.iqvia.com/en/jobs/R1552506-0/apply',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: ['SQL', 'Python'],
    postingDate: '2026-07-01',
    closingDate: null,
    jobDescription: 'Build real-world evidence dashboards for sponsor teams. SQL Python',
    source: 'iqvia',
    link: 'https://jobs.iqvia.com/en/jobs/R1552506-0/apply',
    sourceScopeComplete: false,
    sourceListingComplete: false,
    lifecycleCleanupAllowed: false,
  })

  assert.equal(jobs[1].title, 'Safety Associate')
  assert.equal(jobs[1].location, 'Pune, Maharashtra, India')
  assert.equal(jobs[1].workplaceType, 'On-site')
  assert.equal(jobs[1].source, 'iqvia')
  assert.equal(jobs[1].link, 'https://jobs.iqvia.com/en/jobs/R1552600-0/apply')
})
