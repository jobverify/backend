import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-08-04T00:00:00.000Z'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Serene Info Solutions</title>
  </head>
  <body>
    <main>
      <h1>Shape your Future with a Career at Serene</h1>
      <p>Join a vibrant, innovative team to make an impact and reach your goals.</p>
      <h2>Excellent Opportunity to Explore Your Passions.</h2>
      <p>At Serene Info Solutions, we are committed to helping you realize your professional ambitions.</p>
      <a href="https://www.sereneinfosolutions.in/jobs/">Jobs</a>
      <a href="https://www.sereneinfosolutions.in/join-us/">Submit CV</a>
    </main>
  </body>
</html>
`

const jobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Job Listing - Serene Info Solutions</title>
  </head>
  <body>
    <main>
      <section class="job-card">
        <h1 class="elementor-heading-title elementor-size-default">Bench Sales Recruiter</h1>
        <a href="https://www.sereneinfosolutions.in/job/bench-sales-recruiter/">View Job</a>
      </section>
      <section class="job-card">
        <h1 class="elementor-heading-title elementor-size-default">Talent Acquisition Associate</h1>
        <a href="https://www.sereneinfosolutions.in/job/talent-acquisition-associate/">View Job</a>
      </section>
      <section class="job-card">
        <h1 class="elementor-heading-title elementor-size-default">Resource Executive</h1>
        <a href="https://www.sereneinfosolutions.in/job/resource-executive/">View Job</a>
      </section>
      <section class="job-card">
        <h1 class="elementor-heading-title elementor-size-default">US IT Recruiter</h1>
        <a href="https://www.sereneinfosolutions.in/job/us-it-recruiter/">View Job</a>
      </section>
    </main>
  </body>
</html>
`

const joinUsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Join Us - Serene Info Solutions</title>
  </head>
  <body>
    <main>
      <h1>Join Us</h1>
      <p>We are looking for highly motivated, talented people to join our team.</p>
      <form id="job-application">
        <label>First name</label>
        <label>Last name</label>
        <label>Upload CV</label>
        <label>Interested jobs</label>
        <button>Submit Form</button>
      </form>
    </main>
  </body>
</html>
`

const makeDetailHtml = ({
  title,
  slug,
  locationSummary,
  description,
}) => `
<!doctype html>
<html lang="en">
  <head>
    <title>${title} - Serene Info Solutions</title>
    <link rel="canonical" href="https://www.sereneinfosolutions.in/job/${slug}/">
  </head>
  <body>
    <main>
      <h1 class="elementor-heading-title elementor-size-default">${title}</h1>
      <p>${locationSummary}</p>
      <h2>Overview</h2>
      <p>${description}</p>
      <a href="https://www.sereneinfosolutions.in/join-us/">Apply Now</a>
    </main>
  </body>
</html>
`

const detailPages = {
  'https://www.sereneinfosolutions.in/job/bench-sales-recruiter/': makeDetailHtml({
    title: 'Bench Sales Recruiter',
    slug: 'bench-sales-recruiter',
    locationSummary: 'Bengaluru, India',
    description: 'Grow our staffing pipeline for US technology accounts.',
  }),
  'https://www.sereneinfosolutions.in/job/talent-acquisition-associate/': makeDetailHtml({
    title: 'Talent Acquisition Associate',
    slug: 'talent-acquisition-associate',
    locationSummary: 'Hyderabad, India',
    description: 'Support hiring coordination and candidate engagement across client mandates.',
  }),
  'https://www.sereneinfosolutions.in/job/resource-executive/': makeDetailHtml({
    title: 'Resource Executive',
    slug: 'resource-executive',
    locationSummary: 'Chennai, India',
    description: 'Advanced knowledge of Microsoft Office and strong communication skills.',
  }),
  'https://www.sereneinfosolutions.in/job/us-it-recruiter/': makeDetailHtml({
    title: 'US IT Recruiter',
    slug: 'us-it-recruiter',
    locationSummary: 'Noida, India',
    description: 'We are looking for a driven and detail-oriented US Recruiter with 3-6 years of experience in recruitment for the US market.',
  }),
}

const loadModule = async () => {
  try {
    return await import('../../scraper/serene/script.js')
  } catch {
    assert.fail('Expected Serene scraper module at ../../scraper/serene/script.js')
  }
}

test('Serene helpers stay pinned to the verified careers page, jobs page, same-domain detail pages, and shared application form', async () => {
  const serene = await loadModule()

  assert.equal(serene.SOURCE, 'serene')
  assert.equal(serene.COMPANY_NAME, 'Serene')
  assert.equal(serene.OFFICIAL_BRAND_NAME, 'Serene Info Solutions Pvt. Ltd.')
  assert.equal(serene.VERIFIED_ON, '2026-08-04')
  assert.equal(serene.CAREERS_URL, 'https://www.sereneinfosolutions.in/careers/')
  assert.equal(serene.JOBS_URL, 'https://www.sereneinfosolutions.in/jobs/')
  assert.equal(serene.APPLICATION_URL, 'https://www.sereneinfosolutions.in/join-us/')
  assert.equal(serene.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(serene.hasOfficialJobsSignal(jobsHtml), true)
  assert.equal(serene.hasOfficialApplicationFormSignal(joinUsHtml), true)
  assert.equal(
    serene.hasOfficialJobsSignal(jobsHtml.replace('Bench Sales Recruiter', 'Bench Recruiter')),
    false,
  )

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

  assert.equal(serene.hasOfficialJobDetailSignal(detailPages['https://www.sereneinfosolutions.in/job/bench-sales-recruiter/']), true)
  assert.deepEqual(
    serene.extractJobDetail(
      detailPages['https://www.sereneinfosolutions.in/job/us-it-recruiter/'],
      {
        slug: 'us-it-recruiter',
        title: 'US IT Recruiter',
        detailUrl: 'https://www.sereneinfosolutions.in/job/us-it-recruiter/',
      },
    ),
    {
      slug: 'us-it-recruiter',
      title: 'US IT Recruiter',
      sourceUrl: 'https://www.sereneinfosolutions.in/job/us-it-recruiter/',
      applyUrl: 'https://www.sereneinfosolutions.in/join-us/',
      experienceRequired: '3-6 years',
      jobDescription: 'Noida, India Overview We are looking for a driven and detail-oriented US Recruiter with 3-6 years of experience in recruitment for the US market.',
      locationSummary: 'Noida, India',
    },
  )
})

test('Serene run validates the official careers flow before returning visible job listings', async () => {
  const serene = await loadModule()
  const requestedUrls = []

  const jobs = await serene.createSereneScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === serene.CAREERS_URL) return careersHtml
      if (url === serene.JOBS_URL) return jobsHtml
      if (url === serene.APPLICATION_URL) return joinUsHtml
      if (detailPages[url]) return detailPages[url]
      throw new Error(`Unexpected Serene URL: ${url}`)
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
  assert.deepEqual(jobs[0], {
    title: 'Bench Sales Recruiter',
    company: 'Serene',
    department: null,
    location: 'Bengaluru, India',
    city: null,
    country: 'India',
    jobId: 'bench-sales-recruiter',
    requisitionId: null,
    sourceUrl: 'https://www.sereneinfosolutions.in/job/bench-sales-recruiter/',
    applyUrl: 'https://www.sereneinfosolutions.in/join-us/',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Bengaluru, India Overview Grow our staffing pipeline for US technology accounts.',
    source: 'serene',
    link: 'https://www.sereneinfosolutions.in/join-us/',
    scrapedAt: FIXED_SCRAPED_AT,
  })
  assert.equal(jobs[3].title, 'US IT Recruiter')
  assert.equal(jobs[3].experienceRequired, '3-6 years')
})

test('Serene fails closed when the verified careers page, jobs page, or application form drifts materially', async () => {
  const serene = await loadModule()

  await assert.rejects(
    serene.createSereneScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified serene careers page/i,
  )

  await assert.rejects(
    serene.createSereneScraper().run({
      fetchText: async (url) => {
        if (url === serene.CAREERS_URL) return careersHtml
        if (url === serene.JOBS_URL) return jobsHtml.replace('US IT Recruiter', 'US Recruiter')
        return joinUsHtml
      },
    }),
    /verified serene jobs page/i,
  )

  await assert.rejects(
    serene.createSereneScraper().run({
      fetchText: async (url) => {
        if (url === serene.CAREERS_URL) return careersHtml
        if (url === serene.JOBS_URL) return jobsHtml
        return joinUsHtml.replace('Interested jobs', 'Preferred role')
      },
    }),
    /verified serene application form/i,
  )
})
