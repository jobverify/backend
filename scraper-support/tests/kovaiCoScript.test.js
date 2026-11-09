import assert from 'node:assert/strict'
import test from 'node:test'

const loadKovaiCoModule = async () => {
  try {
    return await import('../../scraper/kovaico/script.js')
  } catch {
    assert.fail('Expected Kovai.co scraper module at ../../scraper/kovaico/script.js')
  }
}

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <meta property="og:site_name" content="Manatal" />
    <title>Careers at Kovai.co</title>
  </head>
  <body>
    <script id="header-script" data-domain_slug="kovaico" src="https://d3neddlj774jsy.cloudfront.net/themes/creative/v1/assets/js/header.js"></script>
    <section id="company-banner">
      <h3 class="banner-heading text-center">Careers at Kovai.co</h3>
    </section>
    <main id="page-content">
      <div class="inner-container-wrapper-3">
        <h4 class="text-h4 text-center mb-0">Jobs at Kovai.co</h4>
        <p class="search-header-right mt-3 mb-0">8 Open Positions</p>
        <div id="job-list">
          <article class="mb-3 job-card">
            <div class="title-wrap me-2">
              <a
                href="/jobs/1e9f89e4-985a-45bc-8f06-d5e06f96ec78"
                class="job-title-link d-flex gap-2"
                data-job-id="1e9f89e4-985a-45bc-8f06-d5e06f96ec78"
                data-job-title="Lead Growth Marketer"
                data-job-city="Chennai"
                data-job-country="India"
              >
                <h6 class="text-brand-blue job-title">Lead Growth Marketer</h6>
              </a>
            </div>
            <a
              class="btn btn-primary"
              href="jobs/1e9f89e4-985a-45bc-8f06-d5e06f96ec78/apply"
              data-type="apply"
            >Apply now</a>
            <ul class="text-quarterary list-unstyled mt-2 mb-0" aria-label="Job details">
              <li class="mb-1 d-flex align-items-center">
                <span>Chennai, Tamil Nadu, India</span>
              </li>
            </ul>
          </article>

          <article class="mb-3 job-card">
            <div class="title-wrap me-2">
              <a
                href="/jobs/b6022b6b-6f1f-4991-97fe-2e3494782079"
                class="job-title-link d-flex gap-2"
                data-job-id="b6022b6b-6f1f-4991-97fe-2e3494782079"
                data-job-title=" Join our Talent Community "
                data-job-city="Coimbatore"
                data-job-country="India"
              >
                <h6 class="text-brand-blue job-title"> Join our Talent Community </h6>
              </a>
            </div>
            <a
              class="btn btn-primary"
              href="jobs/b6022b6b-6f1f-4991-97fe-2e3494782079/apply"
              data-type="apply"
            >Apply now</a>
            <ul class="text-quarterary list-unstyled mt-2 mb-0" aria-label="Job details">
              <li class="mb-1 d-flex align-items-center">
                <span>Coimbatore, Tamil Nadu, India</span>
              </li>
            </ul>
          </article>

          <article class="mb-3 job-card">
            <div class="title-wrap me-2">
              <a
                href="/jobs/b0f9b4d8-3b84-4a93-97ea-0d1351bd73b7"
                class="job-title-link d-flex gap-2"
                data-job-id="b0f9b4d8-3b84-4a93-97ea-0d1351bd73b7"
                data-job-title="Manager - Legal and Contracts"
                data-job-city="Coimbatore"
                data-job-country="India"
              >
                <h6 class="text-brand-blue job-title">Manager - Legal and Contracts</h6>
              </a>
            </div>
            <a
              class="btn btn-primary"
              href="jobs/b0f9b4d8-3b84-4a93-97ea-0d1351bd73b7/apply"
              data-type="apply"
            >Apply now</a>
            <ul class="text-quarterary list-unstyled mt-2 mb-0" aria-label="Job details">
              <li class="mb-1 d-flex align-items-center">
                <span>Coimbatore, Tamil Nadu, India</span>
              </li>
            </ul>
          </article>
        </div>
      </div>
    </main>
  </body>
</html>
`

const leadGrowthMarketerDetailHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main id="page-content">
      <div class="single-job-content">
        <div class="single-job-header-row mb-0">
          <h4 class="single-job-title">Lead Growth Marketer</h4>
        </div>
        <div class="job-location mt-4">
          <ul class="text-quarterary list-unstyled">
            <li class="d-flex gap-1">Chennai, Tamil Nadu, India</li>
            <li class="d-flex gap-1">Full-Time</li>
            <li class="d-flex gap-1">On-Site</li>
          </ul>
          <a class="btn btn-primary d-block" href="../../scraper/jobs/1e9f89e4-985a-45bc-8f06-d5e06f96ec78/apply">Apply now</a>
        </div>
        <div>
          <h5 class="job-title-h5 mt-4 mb-0">Job Description:</h5>
          <div class="text-heading-color mt-4 font-paragraph job-post-description">
            <p>Lead Kovai.co growth programs across paid, owned, and lifecycle channels.</p>
            <p><strong>Role Summary</strong></p>
            <p>Own experimentation and revenue-oriented campaigns.</p>
            <p><strong>Qualifications and Experience</strong></p>
            <ul><li>5+ years in B2B SaaS growth marketing.</li></ul>
          </div>
        </div>
      </div>
    </main>
  </body>
</html>
`

const legalDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Manager - Legal and Contracts | Kovai.co</title>
  </head>
  <body>
    <main id="page-content">
      <div class="single-job-content">
        <div class="single-job-header-row mb-0">
          <h4 class="single-job-title">Manager - Legal and Contracts</h4>
        </div>
        <div class="job-location mt-4">
          <ul class="text-quarterary list-unstyled">
            <li class="d-flex gap-1">Coimbatore, Tamil Nadu, India</li>
            <li class="d-flex gap-1">Full-Time</li>
            <li class="d-flex gap-1">On-Site</li>
          </ul>
          <a class="btn btn-primary d-block" href="../../scraper/jobs/b0f9b4d8-3b84-4a93-97ea-0d1351bd73b7/apply">Apply now</a>
        </div>
        <div>
          <h5 class="job-title-h5 mt-4 mb-0">Job Description:</h5>
          <div class="text-heading-color mt-4 font-paragraph job-post-description">
            <p>Kovai.co is a global B2B SaaS product company building enterprise software from India for businesses worldwide.</p>
            <p><strong>Role Summary</strong></p>
            <p>The Legal Manager will serve as the primary legal point of contact across the Kovai group and its businesses.</p>
            <p><strong>Key Responsibilities</strong></p>
            <ul><li>Draft, review and negotiate a broad range of commercial agreements.</li></ul>
            <p><strong>Qualifications and Experience</strong></p>
            <ul><li>Qualified lawyer with at least 10 years of post-qualification experience.</li></ul>
          </div>
        </div>
      </div>
    </main>
  </body>
</html>
`

test('hasOfficialCareersSignal validates the verified Kovai.co careers board', async () => {
  const kovaico = await loadKovaiCoModule()

  assert.equal(kovaico.CAREERS_URL, 'https://careers.kovai.co/')
  assert.equal(kovaico.hasOfficialCareersSignal(careersPageHtml), true)
})

test('extractListings keeps only real Kovai.co job openings and excludes the Talent Community card', async () => {
  const kovaico = await loadKovaiCoModule()

  assert.deepEqual(kovaico.extractListings(careersPageHtml), [
    {
      title: 'Lead Growth Marketer',
      company: 'Kovai.co',
      department: null,
      location: 'Chennai, Tamil Nadu, India',
      city: 'Chennai',
      country: 'India',
      jobId: '1e9f89e4-985a-45bc-8f06-d5e06f96ec78',
      requisitionId: '1e9f89e4-985a-45bc-8f06-d5e06f96ec78',
      sourceUrl: 'https://careers.kovai.co/jobs/1e9f89e4-985a-45bc-8f06-d5e06f96ec78',
      applyUrl: 'https://careers.kovai.co/jobs/1e9f89e4-985a-45bc-8f06-d5e06f96ec78/apply',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: null,
    },
    {
      title: 'Manager - Legal and Contracts',
      company: 'Kovai.co',
      department: null,
      location: 'Coimbatore, Tamil Nadu, India',
      city: 'Coimbatore',
      country: 'India',
      jobId: 'b0f9b4d8-3b84-4a93-97ea-0d1351bd73b7',
      requisitionId: 'b0f9b4d8-3b84-4a93-97ea-0d1351bd73b7',
      sourceUrl: 'https://careers.kovai.co/jobs/b0f9b4d8-3b84-4a93-97ea-0d1351bd73b7',
      applyUrl: 'https://careers.kovai.co/jobs/b0f9b4d8-3b84-4a93-97ea-0d1351bd73b7/apply',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: null,
    },
  ])
})

test('extractJobDetail maps Kovai.co detail metadata and preserves the public apply route', async () => {
  const kovaico = await loadKovaiCoModule()
  const listing = {
    title: 'Manager - Legal and Contracts',
    company: 'Kovai.co',
    location: 'Coimbatore, Tamil Nadu, India',
    city: 'Coimbatore',
    country: 'India',
    jobId: 'b0f9b4d8-3b84-4a93-97ea-0d1351bd73b7',
    requisitionId: 'b0f9b4d8-3b84-4a93-97ea-0d1351bd73b7',
    sourceUrl: 'https://careers.kovai.co/jobs/b0f9b4d8-3b84-4a93-97ea-0d1351bd73b7',
    applyUrl: 'https://careers.kovai.co/jobs/b0f9b4d8-3b84-4a93-97ea-0d1351bd73b7/apply',
  }

  const job = kovaico.extractJobDetail(legalDetailHtml, listing)

  assert.equal(job.title, 'Manager - Legal and Contracts')
  assert.equal(job.location, 'Coimbatore, Tamil Nadu, India')
  assert.equal(job.city, 'Coimbatore')
  assert.equal(job.country, 'India')
  assert.equal(job.employmentType, 'Full-time')
  assert.equal(job.remoteStatus, 'On-site')
  assert.equal(job.applyUrl, 'https://careers.kovai.co/jobs/b0f9b4d8-3b84-4a93-97ea-0d1351bd73b7/apply')
  assert.match(job.jobDescription, /Role Summary/i)
  assert.match(job.jobDescription, /Key Responsibilities/i)
  assert.match(job.jobDescription, /Qualifications and Experience/i)
})

test('run fetches the Kovai.co board and detail pages, then decorates final jobs', async () => {
  const kovaico = await loadKovaiCoModule()
  const requestedUrls = []

  const jobs = await kovaico.createKovaiCoScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === kovaico.CAREERS_URL) return careersPageHtml
      if (url === 'https://careers.kovai.co/jobs/1e9f89e4-985a-45bc-8f06-d5e06f96ec78') {
        return leadGrowthMarketerDetailHtml
      }
      if (url === 'https://careers.kovai.co/jobs/b0f9b4d8-3b84-4a93-97ea-0d1351bd73b7') {
        return legalDetailHtml
      }
      throw new Error(`Unexpected Kovai.co fixture URL: ${url}`)
    },
    now: () => '2026-07-10T12:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    kovaico.CAREERS_URL,
    'https://careers.kovai.co/jobs/1e9f89e4-985a-45bc-8f06-d5e06f96ec78',
    'https://careers.kovai.co/jobs/b0f9b4d8-3b84-4a93-97ea-0d1351bd73b7',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'kovaico')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].scrapedAt, '2026-07-10T12:00:00.000Z')
  assert.equal(jobs[1].source, 'kovaico')
})

test('run fails closed when the verified Kovai.co careers signal disappears', async () => {
  const kovaico = await loadKovaiCoModule()

  await assert.rejects(
    kovaico.createKovaiCoScraper().run({
      fetchText: async () => '<html><body>No verified public board here</body></html>',
    }),
    /verified Kovai\.co careers surface/i,
  )
})
