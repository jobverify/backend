import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-17T00:00:00.000Z'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Shiprocket Careers - Apply for a Job at Shiprocket</title>
  </head>
  <body>
    <main>
      <h1>Career That Takes You Miles!</h1>
      <p>Bring ideas to life by starting your career at Shiprocket.</p>
      <h2>Join The Family, We&#8217;re Hiring!</h2>
      <div class="job">
        <div class="content">
          <h5>GoLang Developer</h5>
          <div class="meta">
            <small>Gurugram</small>
          </div>
        </div>
        <a href="https://careers.shiprocket.in/jobs/golang-developer/">View Job</a>
      </div>
      <div class="job">
        <div class="content">
          <h5>Central Analytics Lead</h5>
          <div class="meta">
            <small>4+ years</small>
            <small>Gurugram, Haryana</small>
          </div>
        </div>
        <a href="https://careers.shiprocket.in/jobs/central-analytics-lead/">View Job</a>
      </div>
      <div class="job">
        <div class="content">
          <h5>Sr. Manager- Supply (FTL & PTL)</h5>
          <div class="meta">
            <small>6-8 yrs</small>
            <small>Gurgaon</small>
          </div>
        </div>
        <a href="https://careers.shiprocket.in/jobs/sr-manager-supply-ftl-ptl/">View Job</a>
      </div>
      <section>
        <h3>Job Application Form</h3>
        <p>Resume*</p>
      </section>
    </main>
  </body>
</html>
`

const golangDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>GoLang Developer - Shiprocket Careers</title>
  </head>
  <body>
    <main>
      <h1>GoLang Developer</h1>
      <p>Gurugram</p>
      <p>Department Engineering</p>
      <p>Job posted on August 19, 2025</p>
      <p>Employee Type permanent</p>
      <p>Experience range 2-4 years</p>
      <a href="#apply">Apply for this job</a>
      <h2>About the Role</h2>
      <p>We are looking for a passionate and skilled GoLang Developer with 2-4 years of hands-on experience in backend development.</p>
      <h2>Required Skills & Qualifications</h2>
      <ul>
        <li>Strong proficiency in Golang</li>
        <li>Hands-on experience with RESTful APIs</li>
        <li>Microservices Architecture</li>
      </ul>
      <section>
        <h3>Job Application Form</h3>
        <p>Resume*</p>
      </section>
    </main>
  </body>
</html>
`

const centralAnalyticsDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Central Analytics Lead - Shiprocket Careers</title>
  </head>
  <body>
    <main>
      <h1>Central Analytics Lead</h1>
      <p>Gurugram, Haryana</p>
      <p>Department Growth & Marketing</p>
      <p>Job posted on July 4, 2025</p>
      <p>Employee Type permanent</p>
      <p>Experience range 4+ years</p>
      <a href="#apply">Apply for this job</a>
      <h2>About the Role</h2>
      <p>We are looking for a highly analytical and data-driven professional to join our team as the Central Analytics Lead.</p>
      <h2>Qualifications</h2>
      <ul>
        <li>Exceptional SQL skills</li>
        <li>Tableau</li>
        <li>Power BI</li>
        <li>Looker</li>
      </ul>
      <section>
        <h3>Job Application Form</h3>
        <p>Resume*</p>
      </section>
    </main>
  </body>
</html>
`

const supplyDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Sr. Manager- Supply (FTL & PTL) - Shiprocket Careers</title>
  </head>
  <body>
    <main>
      <h1>Sr. Manager- Supply (FTL & PTL)</h1>
      <p>Gurgaon</p>
      <p>Department Logistics Operations Rocketbox</p>
      <p>Job posted on July 7, 2025</p>
      <p>Employee Type permanent</p>
      <p>Experience range 6-8 yrs</p>
      <a href="#apply">Apply for this job</a>
      <h2>Role Overview</h2>
      <p>We are seeking a highly driven and experienced professional to lead the sourcing, onboarding, and management of FTL and PTL partners across India.</p>
      <h2>Requirements</h2>
      <ul>
        <li>Vendor development</li>
        <li>Rate negotiation</li>
        <li>Cost optimization</li>
      </ul>
      <section>
        <h3>Job Application Form</h3>
        <p>Resume*</p>
      </section>
    </main>
  </body>
</html>
`

const encodedTitleCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Shiprocket Careers - Apply for a Job at Shiprocket</title>
  </head>
  <body>
    <main>
      <h1>Career That Takes You Miles!</h1>
      <h2>Join The Family, We&#8217;re Hiring!</h2>
      <div class="job enterprise-kam">
        <div class="content">
          <h5>Team Lead &#8211; Key Account Manager</h5>
          <div class="meta">
            <small>5+ Years</small>
            <small>Gurgaon</small>
          </div>
        </div>
        <a href="https://careers.shiprocket.in/jobs/team-lead-key-account-manager/">View Job</a>
      </div>
      <section>
        <h3>Job Application Form</h3>
        <p>Resume*</p>
      </section>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/shiprocket/script.js')
  } catch {
    assert.fail('Expected Shiprocket scraper module at ../../scraper/shiprocket/script.js')
  }
}

test('Shiprocket helpers stay pinned to the verified official careers list and detail pages', async () => {
  const shiprocket = await loadModule()

  assert.equal(shiprocket.SOURCE, 'shiprocket')
  assert.equal(shiprocket.COMPANY_NAME, 'Shiprocket')
  assert.equal(shiprocket.OFFICIAL_BRAND_NAME, 'Shiprocket')
  assert.equal(shiprocket.VERIFIED_ON, '2026-07-17')
  assert.equal(shiprocket.CAREERS_URL, 'https://careers.shiprocket.in/')
  assert.equal(shiprocket.JOB_PAGE_PREFIX, 'https://careers.shiprocket.in/jobs/')
  assert.equal(shiprocket.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(
    shiprocket.hasOfficialCareersSignal(
      careersHtml.replace('We&#8217;re Hiring!', 'We\u2019re Hiring!'),
    ),
    true,
  )
  assert.deepEqual(shiprocket.extractVisibleJobListings(careersHtml), [
    {
      slug: 'golang-developer',
      title: 'GoLang Developer',
      sourceUrl: 'https://careers.shiprocket.in/jobs/golang-developer/',
      applyUrl: 'https://careers.shiprocket.in/jobs/golang-developer/',
      location: 'Gurugram',
      experienceRequired: null,
    },
    {
      slug: 'central-analytics-lead',
      title: 'Central Analytics Lead',
      sourceUrl: 'https://careers.shiprocket.in/jobs/central-analytics-lead/',
      applyUrl: 'https://careers.shiprocket.in/jobs/central-analytics-lead/',
      location: 'Gurugram, Haryana',
      experienceRequired: '4+ years',
    },
    {
      slug: 'sr-manager-supply-ftl-ptl',
      title: 'Sr. Manager- Supply (FTL & PTL)',
      sourceUrl: 'https://careers.shiprocket.in/jobs/sr-manager-supply-ftl-ptl/',
      applyUrl: 'https://careers.shiprocket.in/jobs/sr-manager-supply-ftl-ptl/',
      location: 'Gurgaon',
      experienceRequired: '6-8 yrs',
    },
  ])
  assert.deepEqual(shiprocket.extractVisibleJobListings(encodedTitleCareersHtml), [
    {
      slug: 'team-lead-key-account-manager',
      title: 'Team Lead - Key Account Manager',
      sourceUrl: 'https://careers.shiprocket.in/jobs/team-lead-key-account-manager/',
      applyUrl: 'https://careers.shiprocket.in/jobs/team-lead-key-account-manager/',
      location: 'Gurgaon',
      experienceRequired: '5+ Years',
    },
  ])

  assert.deepEqual(
    shiprocket.extractJobDetail(golangDetailHtml, {
      slug: 'golang-developer',
      title: 'GoLang Developer',
      sourceUrl: 'https://careers.shiprocket.in/jobs/golang-developer/',
      applyUrl: 'https://careers.shiprocket.in/jobs/golang-developer/',
      location: 'Gurugram',
      experienceRequired: null,
    }),
    {
      slug: 'golang-developer',
      title: 'GoLang Developer',
      sourceUrl: 'https://careers.shiprocket.in/jobs/golang-developer/',
      applyUrl: 'https://careers.shiprocket.in/jobs/golang-developer/',
      location: 'Gurugram',
      city: 'Gurugram',
      country: 'India',
      department: 'Engineering',
      employmentType: 'permanent',
      experienceRequired: '2-4 years',
      postingDate: '2025-08-19',
      jobDescription: 'We are looking for a passionate and skilled GoLang Developer with 2-4 years of hands-on experience in backend development.',
      requiredSkills: ['Golang', 'RESTful APIs', 'Microservices Architecture'],
    },
  )
})

test('Shiprocket run validates the official careers page and enriches visible jobs from first-party detail pages', async () => {
  const shiprocket = await loadModule()
  const requestedUrls = []

  const jobs = await shiprocket.createShiprocketScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === shiprocket.CAREERS_URL) return careersHtml
      if (url === 'https://careers.shiprocket.in/jobs/golang-developer/') return golangDetailHtml
      if (url === 'https://careers.shiprocket.in/jobs/central-analytics-lead/') return centralAnalyticsDetailHtml
      if (url === 'https://careers.shiprocket.in/jobs/sr-manager-supply-ftl-ptl/') return supplyDetailHtml
      throw new Error(`Unexpected Shiprocket URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    shiprocket.CAREERS_URL,
    'https://careers.shiprocket.in/jobs/golang-developer/',
    'https://careers.shiprocket.in/jobs/central-analytics-lead/',
    'https://careers.shiprocket.in/jobs/sr-manager-supply-ftl-ptl/',
  ])
  assert.equal(jobs.length, 3)
  assert.deepEqual(jobs[0], {
    title: 'GoLang Developer',
    company: 'Shiprocket',
    department: 'Engineering',
    location: 'Gurugram',
    city: 'Gurugram',
    country: 'India',
    jobId: 'golang-developer',
    requisitionId: null,
    sourceUrl: 'https://careers.shiprocket.in/jobs/golang-developer/',
    applyUrl: 'https://careers.shiprocket.in/jobs/golang-developer/',
    employmentType: 'permanent',
    experienceRequired: '2-4 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: ['Golang', 'RESTful APIs', 'Microservices Architecture'],
    postingDate: '2025-08-19',
    closingDate: null,
    jobDescription: 'We are looking for a passionate and skilled GoLang Developer with 2-4 years of hands-on experience in backend development.',
    source: 'shiprocket',
    link: 'https://careers.shiprocket.in/jobs/golang-developer/',
    scrapedAt: FIXED_SCRAPED_AT,
  })
  assert.equal(jobs[1].title, 'Central Analytics Lead')
  assert.equal(jobs[1].department, 'Growth & Marketing')
  assert.equal(jobs[1].postingDate, '2025-07-04')
  assert.equal(jobs[2].title, 'Sr. Manager- Supply (FTL & PTL)')
  assert.equal(jobs[2].department, 'Logistics Operations Rocketbox')
})

test('Shiprocket fails closed when the verified careers page or detail pages drift materially', async () => {
  const shiprocket = await loadModule()

  await assert.rejects(
    shiprocket.createShiprocketScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified shiprocket careers page/i,
  )

  await assert.rejects(
    shiprocket.createShiprocketScraper().run({
      fetchText: async (url) => {
        if (url === shiprocket.CAREERS_URL) return careersHtml
        return golangDetailHtml.replace('Apply for this job', 'Share this job')
      },
    }),
    /verified shiprocket job detail page/i,
  )
})
