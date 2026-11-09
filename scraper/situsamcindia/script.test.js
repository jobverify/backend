import assert from 'node:assert/strict'
import test from 'node:test'

const loadSitusAmcModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const jobSearchHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Search open jobs at SitusAMC and apply today!</title>
  </head>
  <body>
    <main>
      <h1>Work at SitusAMC</h1>
      <p>Search open jobs at SitusAMC and apply today!</p>
      <section>
        <h2>How You'll Work</h2>
        <h2>Career Areas</h2>
        <p>Commercial Residential Technology Corporate</p>
      </section>
      <section>
        <h2>Locations</h2>
        <p>Giving Back</p>
      </section>
      <a href="/job-search">Search Jobs</a>
    </main>
  </body>
</html>
`

const corporateJobsHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Corporate Jobs | SitusAMC Careers</title>
  </head>
  <body>
    <main>
      <h1>Corporate Current Job Opportunities</h1>
      <p>Showing 1-2 of 2 results</p>
      <a href="https://careers.situsamc.com/job-detail/assistant-manager-human-resources-business-partner-jr02278-1">
        Assistant Manager, Human Resources Business Partner IN - Haryana - Gurgaon JR02278 Onsite
      </a>
      <a href="https://careers.situsamc.com/job-detail/team-leader-facilities-jr02762-1">
        Team Leader, Facilities IN - Telangana - Hyderabad JR02762 Onsite
      </a>
    </main>
  </body>
</html>
`

const residentialJobsHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Residential Real Estate Jobs | SitusAMC Careers</title>
  </head>
  <body>
    <main>
      <h1>Residential Real Estate Current Job Opportunities</h1>
      <p>Showing 1-1 of 1 results</p>
      <a href="https://careers.situsamc.com/job-detail/underwriter-shared-services-jr02568-1">
        Underwriter, Shared Services IN - Maharashtra - Navi Mumbai JR02568 Onsite
      </a>
    </main>
  </body>
</html>
`

const assistantManagerDetailHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Assistant Manager, Human Resources Business Partner | SitusAMC Careers</title>
  </head>
  <body>
    <main>
      <h1>Assistant Manager, Human Resources Business Partner</h1>
      <p>Req ID</p>
      <p>JR02278</p>
      <p>Job Category</p>
      <p>Human Resources</p>
      <p>Job Type</p>
      <p>Full time</p>
      <p>Job Location</p>
      <p>IN - Haryana - Gurgaon</p>
      <p>Type</p>
      <p>Onsite</p>
      <h2>Overview</h2>
      <p>Act as the primary HR contact for employees and managers within assigned business units throughout the employee lifecycle.</p>
      <h2>Essential Job Functions:</h2>
      <p>Partner with assigned business unit leaders and provide HR guidance on employee relations, performance, and development.</p>
      <a href="https://situsamc.wd1.myworkdayjobs.com/SitusAMC/job/Gurugram/Assistant-Manager--Human-Resources-Business-Partner_JR02278/apply?SOURCE=DirectTraffic">Apply Now</a>
    </main>
  </body>
</html>
`

const underwriterDetailHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Underwriter, Shared Services | SitusAMC Careers</title>
  </head>
  <body>
    <main>
      <h1>Underwriter, Shared Services</h1>
      <p>Req ID</p>
      <p>JR02568</p>
      <p>Job Category</p>
      <p>Residential</p>
      <p>Job Type</p>
      <p>Full time</p>
      <p>Job Location</p>
      <p>IN - Maharashtra - Navi Mumbai</p>
      <p>Type</p>
      <p>Onsite</p>
      <h2>Overview</h2>
      <p>Support residential valuation and underwriting workflows for SitusAMC clients.</p>
      <h2>Essential Job Functions:</h2>
      <p>Review files, coordinate shared services operations, and maintain turnaround quality.</p>
      <a href="https://situsamc.wd1.myworkdayjobs.com/SitusAMC/job/Navi-Mumbai/Underwriter--Shared-Services_JR02568/apply?SOURCE=DirectTraffic">Apply Now</a>
    </main>
  </body>
</html>
`

test('SitusAMC India recognizes the current verified search, corporate, and residential surfaces', async () => {
  const situs = await loadSitusAmcModule()
  assert.ok(situs, 'Expected SitusAMC India scraper module at ./script.js')

  assert.equal(situs.SOURCE, 'situsamcindia')
  assert.equal(situs.COMPANY_NAME, 'SitusAMC India')
  assert.equal(situs.JOB_SEARCH_URL, 'https://careers.situsamc.com/job-search')
  assert.equal(situs.CORPORATE_JOBS_URL, 'https://careers.situsamc.com/work-at-situsamc/corporate-careers/job-opportunities')
  assert.equal(situs.RESIDENTIAL_JOBS_URL, 'https://careers.situsamc.com/work-at-situsamc/residential-real-estate-careers/job-opportunities')
  assert.equal(situs.hasOfficialJobSearchSignal(jobSearchHtml), true)
  assert.equal(situs.hasCorporateJobsPageSignal(corporateJobsHtml), true)
  assert.equal(situs.hasResidentialJobsPageSignal(residentialJobsHtml), true)
  assert.deepEqual(situs.extractIndiaJobCardsFromAreaPage(residentialJobsHtml), [
    {
      title: 'Underwriter, Shared Services',
      locationCode: 'IN - Maharashtra - Navi Mumbai',
      reqId: 'JR02568',
      remoteStatus: 'Onsite',
      detailUrl: 'https://careers.situsamc.com/job-detail/underwriter-shared-services-jr02568-1',
    },
  ])
})

test('SitusAMC India extracts public job details from current corporate and residential pages', async () => {
  const situs = await loadSitusAmcModule()
  assert.ok(situs, 'Expected SitusAMC India scraper module at ./script.js')

  const job = situs.extractJobFromDetailHtml(
    assistantManagerDetailHtml,
    {
      title: 'Assistant Manager, Human Resources Business Partner',
      locationCode: 'IN - Haryana - Gurgaon',
      reqId: 'JR02278',
      remoteStatus: 'Onsite',
      detailUrl: 'https://careers.situsamc.com/job-detail/assistant-manager-human-resources-business-partner-jr02278-1',
    },
    { scrapedAt: '2026-07-27T00:00:00.000Z' },
  )

  assert.equal(job.title, 'Assistant Manager, Human Resources Business Partner')
  assert.equal(job.location, 'Gurgaon, Haryana, India')
  assert.equal(job.department, 'Human Resources')
  assert.equal(job.employmentType, 'Full time')
  assert.equal(job.remoteStatus, 'On-site')
  assert.match(job.jobDescription, /primary HR contact/i)
})

test('SitusAMC India run accepts the current verified search copy and residential sample job id', async () => {
  const situs = await loadSitusAmcModule()
  assert.ok(situs, 'Expected SitusAMC India scraper module at ./script.js')

  const pagesByUrl = new Map([
    [situs.JOB_SEARCH_URL, jobSearchHtml],
    [situs.CORPORATE_JOBS_URL, corporateJobsHtml],
    [situs.RESIDENTIAL_JOBS_URL, residentialJobsHtml],
    ['https://careers.situsamc.com/job-detail/assistant-manager-human-resources-business-partner-jr02278-1', assistantManagerDetailHtml],
    ['https://careers.situsamc.com/job-detail/team-leader-facilities-jr02762-1', assistantManagerDetailHtml.replace(/Assistant Manager, Human Resources Business Partner/g, 'Team Leader, Facilities').replace(/JR02278/g, 'JR02762').replace(/Human Resources/g, 'Facilities').replace(/Haryana - Gurgaon/g, 'Telangana - Hyderabad')],
    ['https://careers.situsamc.com/job-detail/underwriter-shared-services-jr02568-1', underwriterDetailHtml],
  ])

  const jobs = await situs.createSitusAmcIndiaScraper().run({
    fetchText: async (url) => {
      const html = pagesByUrl.get(url)
      if (!html) {
        throw new Error(`Unexpected URL: ${url}`)
      }
      return html
    },
  })

  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      location: job.location,
      jobId: job.jobId,
    })),
    [
      {
        title: 'Assistant Manager, Human Resources Business Partner',
        location: 'Gurgaon, Haryana, India',
        jobId: 'JR02278',
      },
      {
        title: 'Team Leader, Facilities',
        location: 'Hyderabad, Telangana, India',
        jobId: 'JR02762',
      },
      {
        title: 'Underwriter, Shared Services',
        location: 'Navi Mumbai, Maharashtra, India',
        jobId: 'JR02568',
      },
    ],
  )
})
