import assert from 'node:assert/strict'
import test from 'node:test'

const loadSereneModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Serene scraper module at ./script.js')
  }
}

const careersHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Careers - Serene Info Solutions</title>
  </head>
  <body>
    <main>
      <h1>Shape your Future with a Career at Serene</h1>
      <p>Excellent Opportunity to Explore Your Passions.</p>
      <p>At Serene Info Solutions, we are committed to helping you realize your professional ambitions.</p>
      <a href="https://www.sereneinfosolutions.in/jobs/">Jobs</a>
      <a href="https://www.sereneinfosolutions.in/join-us/">Submit CV</a>
    </main>
  </body>
</html>
`

const jobsHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Job Listing - Serene Info Solutions</title>
  </head>
  <body>
    <main>
      <div class="elementor elementor-3996 e-loop-item e-loop-item-4038 post-4038 job type-job status-publish hentry">
        <h1 class="elementor-heading-title elementor-size-default">Bench Sales Recruiter</h1>
        <a class="elementor-button elementor-button-link elementor-size-sm" href="https://www.sereneinfosolutions.in/job/bench-sales-recruiter/">
          <span class="elementor-button-text">View Job</span>
        </a>
      </div>
      <div class="elementor elementor-3996 e-loop-item e-loop-item-4039 post-4039 job type-job status-publish hentry">
        <h1 class="elementor-heading-title elementor-size-default">Talent Acquisition Associate</h1>
        <a class="elementor-button elementor-button-link elementor-size-sm" href="https://www.sereneinfosolutions.in/job/talent-acquisition-associate/">
          <span class="elementor-button-text">View Job</span>
        </a>
      </div>
      <div class="elementor elementor-3996 e-loop-item e-loop-item-4035 post-4035 job type-job status-publish hentry">
        <h1 class="elementor-heading-title elementor-size-default">Resource Executive</h1>
        <a class="elementor-button elementor-button-link elementor-size-sm" href="https://www.sereneinfosolutions.in/job/resource-executive/">
          <span class="elementor-button-text">View Job</span>
        </a>
      </div>
      <div class="elementor elementor-3996 e-loop-item e-loop-item-4034 post-4034 job type-job status-publish hentry">
        <h1 class="elementor-heading-title elementor-size-default">US IT Recruiter</h1>
        <a class="elementor-button elementor-button-link elementor-size-sm" href="https://www.sereneinfosolutions.in/job/us-it-recruiter/">
          <span class="elementor-button-text">View Job</span>
        </a>
      </div>
    </main>
  </body>
</html>
`

const joinUsHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Join Us - Serene Info Solutions</title>
  </head>
  <body>
    <main>
      <h1>Join Us</h1>
      <label>Upload CV</label>
      <label>Interested jobs</label>
      <button>Submit Form</button>
    </main>
  </body>
</html>
`

const benchSalesDetailHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Bench Sales Recruiter - Serene Info Solutions</title>
    <link rel="canonical" href="https://www.sereneinfosolutions.in/job/bench-sales-recruiter/" />
  </head>
  <body>
    <main>
      <h1 class="elementor-heading-title elementor-size-default">Bench Sales Recruiter</h1>
      <p>Kolkata (Sector-V) Full-time, Contract</p>
      <section>
        <h2>Overview</h2>
        <p>Responsibilities Full life cycle recruiting. Sourcing, Screening, Interviewing IT professionals.</p>
        <p>Qualifications Must have US IT Recruitment experience.</p>
      </section>
      <a href="https://www.sereneinfosolutions.in/join-us/">Apply Now</a>
    </main>
  </body>
</html>
`

test('Serene scraper recognizes the current public hiring flow and loop-item jobs page', async () => {
  const serene = await loadSereneModule()

  assert.equal(serene.SOURCE, 'serene')
  assert.equal(serene.COMPANY_NAME, 'Serene')
  assert.equal(serene.CAREERS_URL, 'https://www.sereneinfosolutions.in/careers/')
  assert.equal(serene.VERIFIED_ON, '2026-08-04')
  assert.equal(serene.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(serene.hasOfficialJobsSignal(jobsHtml), true)
  assert.equal(serene.hasOfficialApplicationFormSignal(joinUsHtml), true)
  assert.equal(serene.hasOfficialJobDetailSignal(benchSalesDetailHtml), true)
  assert.deepEqual(serene.extractJobListings(jobsHtml), [
    {
      slug: 'bench-sales-recruiter',
      title: 'Bench Sales Recruiter',
      detailUrl: 'https://www.sereneinfosolutions.in/job/bench-sales-recruiter/',
    },
    {
      slug: 'talent-acquisition-associate',
      title: 'Talent Acquisition Associate',
      detailUrl: 'https://www.sereneinfosolutions.in/job/talent-acquisition-associate/',
    },
    {
      slug: 'resource-executive',
      title: 'Resource Executive',
      detailUrl: 'https://www.sereneinfosolutions.in/job/resource-executive/',
    },
    {
      slug: 'us-it-recruiter',
      title: 'US IT Recruiter',
      detailUrl: 'https://www.sereneinfosolutions.in/job/us-it-recruiter/',
    },
  ])
})

test('Serene scraper extracts normalized job detail records from the public detail pages', async () => {
  const serene = await loadSereneModule()

  assert.deepEqual(
    serene.extractJobDetail(benchSalesDetailHtml, {
      slug: 'bench-sales-recruiter',
      title: 'Bench Sales Recruiter',
      detailUrl: 'https://www.sereneinfosolutions.in/job/bench-sales-recruiter/',
    }),
    {
      slug: 'bench-sales-recruiter',
      title: 'Bench Sales Recruiter',
      sourceUrl: 'https://www.sereneinfosolutions.in/job/bench-sales-recruiter/',
      applyUrl: 'https://www.sereneinfosolutions.in/join-us/',
      experienceRequired: null,
      jobDescription: 'Kolkata (Sector-V) Full-time, Contract Overview Responsibilities Full life cycle recruiting. Sourcing, Screening, Interviewing IT professionals. Qualifications Must have US IT Recruitment experience.',
      locationSummary: 'Kolkata (Sector-V) Full-time, Contract',
    },
  )
})

test('Serene scraper returns current public jobs from the jobs list, detail pages, and shared join-us form', async () => {
  const serene = await loadSereneModule()
  const requestedUrls = []

  const jobs = await serene.createSereneScraper({
    now: () => '2026-08-04T00:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === serene.CAREERS_URL) return careersHtml
      if (url === serene.JOBS_URL) return jobsHtml
      if (url === serene.APPLICATION_URL) return joinUsHtml
      if (url === 'https://www.sereneinfosolutions.in/job/bench-sales-recruiter/') return benchSalesDetailHtml
      if (url === 'https://www.sereneinfosolutions.in/job/talent-acquisition-associate/') {
        return benchSalesDetailHtml
          .replace(/Bench Sales Recruiter/g, 'Talent Acquisition Associate')
          .replace(/bench-sales-recruiter/g, 'talent-acquisition-associate')
          .replace(/Kolkata \(Sector-V\) Full-time, Contract/g, 'Hyderabad Full-time')
      }
      if (url === 'https://www.sereneinfosolutions.in/job/resource-executive/') {
        return benchSalesDetailHtml
          .replace(/Bench Sales Recruiter/g, 'Resource Executive')
          .replace(/bench-sales-recruiter/g, 'resource-executive')
          .replace(/Kolkata \(Sector-V\) Full-time, Contract/g, 'Chennai Full-time')
      }
      if (url === 'https://www.sereneinfosolutions.in/job/us-it-recruiter/') {
        return benchSalesDetailHtml
          .replace(/Bench Sales Recruiter/g, 'US IT Recruiter')
          .replace(/bench-sales-recruiter/g, 'us-it-recruiter')
          .replace(/Kolkata \(Sector-V\) Full-time, Contract/g, 'Remote, India Contract')
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    serene.CAREERS_URL,
    serene.JOBS_URL,
    serene.APPLICATION_URL,
    'https://www.sereneinfosolutions.in/job/bench-sales-recruiter/',
    'https://www.sereneinfosolutions.in/job/talent-acquisition-associate/',
    'https://www.sereneinfosolutions.in/job/resource-executive/',
    'https://www.sereneinfosolutions.in/job/us-it-recruiter/',
  ])
  assert.equal(jobs.length, 4)
  assert.equal(jobs[0].title, 'Bench Sales Recruiter')
  assert.equal(jobs[0].applyUrl, 'https://www.sereneinfosolutions.in/join-us/')
  assert.equal(jobs[0].location, 'Kolkata (Sector-V) Full-time, Contract')
  assert.equal(jobs[0].sourceUrl, 'https://www.sereneinfosolutions.in/job/bench-sales-recruiter/')
})
