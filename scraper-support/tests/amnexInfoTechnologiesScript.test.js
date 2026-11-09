import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-15T00:00:00.000Z'

const careerHubHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career - AMNEX</title>
    <link rel="canonical" href="https://amnex.com/career/" />
  </head>
  <body>
    <main>
      <h1>Fuel your passion. Shape the future</h1>
      <p>Join our growing team of dreamers and doers.</p>
      <a href="https://amnex.com/professional-opportunities/">See open positions</a>
    </main>
  </body>
</html>
`

const professionalOpportunitiesHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Professional Opportunities - AMNEX</title>
    <link rel="canonical" href="https://amnex.com/professional-opportunities/" />
  </head>
  <body>
    <main>
      <h1>Current Openings</h1>
      <p>Explore the exciting opportunities that await you at Amnex.</p>
      <button id="prev-page" disabled>Previous</button>
      <button id="next-page">Next</button>
      <button>Find Jobs</button>
      <a href="https://amnex.com/jobs/cyber-security-expert/">Cyber Security Expert</a>
      <a href="https://amnex.com/jobs/noc-engineer/">NOC Engineer</a>
      <a href="https://amnex.com/jobs/database-administrator-postgresql/">Database Administrator (PostgreSQL)</a>
      <a href="https://amnex.com/jobs/senior-sales-manager-cloud/">Senior Manager (Sales)- Cloud Domain</a>
    </main>
  </body>
</html>
`

const professionalOpportunitiesHtmlWithCurrentCards = `
<!doctype html>
<html lang="en">
  <head>
    <title>Professional Opportunities - AMNEX</title>
    <link rel="canonical" href="https://amnex.com/professional-opportunities/" />
  </head>
  <body>
    <main>
      <h1>Current Openings</h1>
      <p>Explore the exciting opportunities that await you at Amnex.</p>
      <button id="prev-page" disabled>Previous</button>
      <button id="next-page">Next</button>
      <button>Find Jobs</button>
      <article class="job-card">
        <h2>Legal Manager</h2>
        <a href="https://amnex.com/jobs/legal-manager/" class="view-more">View More</a>
      </article>
      <article class="job-card">
        <h2>Manager- Finance & Accounts</h2>
        <a href="https://amnex.com/jobs/manager-finance-accounts/" class="view-more">View More</a>
      </article>
      <article class="job-card">
        <h2>Vice President- Finance & Accounts</h2>
        <a href="https://amnex.com/jobs/vice-president-finance-accounts/" class="view-more">View More</a>
      </article>
      <article class="job-card">
        <h2>Cyber Security Expert</h2>
        <a href="https://amnex.com/jobs/cyber-security-expert-ahmedabad/" class="view-more">View More</a>
      </article>
    </main>
  </body>
</html>
`

const jobsApiPayload = [
  {
    id: 5379,
    date: '2026-05-27T11:10:35',
    link: 'https://amnex.com/jobs/cyber-security-expert/',
    slug: 'cyber-security-expert',
    title: {
      rendered: 'Cyber Security Expert',
    },
    job_locations: [74],
    job_years: [143],
  },
  {
    id: 5079,
    date: '2026-03-26T16:52:00',
    link: 'https://amnex.com/jobs/senior-sales-manager-cloud/',
    slug: 'senior-sales-manager-cloud',
    title: {
      rendered: 'Senior Manager (Sales)- Cloud Domain',
    },
    job_locations: [130, 77],
    job_years: [139],
  },
  {
    id: 5248,
    date: '2026-04-30T14:50:00',
    link: 'https://amnex.com/jobs/project-manager-2/',
    slug: 'project-manager-2',
    title: {
      rendered: 'Business Analyst (IT Infrastructure Domain)',
    },
    job_locations: [74],
    job_years: [127],
  },
]

const jobLocationsPayload = [
  { id: 74, name: 'Ahmedabad' },
  { id: 130, name: 'Delhi' },
  { id: 77, name: 'Mumbai' },
]

const jobYearsPayload = [
  { id: 143, name: '10+ Years' },
  { id: 139, name: '10-15 Years' },
  { id: 127, name: '5+ Years' },
]

const cyberSecurityExpertDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Cyber Security Expert - AMNEX</title>
    <link rel="canonical" href="https://amnex.com/jobs/cyber-security-expert/" />
  </head>
  <body>
    <article class="jobs type-jobs status-publish job_locations-ahmedabad job_years-10-years">
      <div class="job-specs">
        <div><p><strong>Employment</strong></p></div>
        <div><p>Full Time</p></div>
        <div><p><strong>Experience</strong></p></div>
        <div><p>10+ Years</p></div>
        <div><p><strong>Location</strong></p></div>
        <div><p>Ahmedabad</p></div>
        <div><p><strong>Open Positions</strong></p></div>
        <div><p>1</p></div>
        <div><p><strong>Job Code</strong></p></div>
        <div><p>AIPL/CORP/ITINFRA/CSE/2608</p></div>
      </div>
      <section class="job-copy">
        <p>Lead cyber security operations across enterprise platforms.</p>
        <ul>
          <li>Monitor incidents and coordinate remediation.</li>
          <li>Harden infrastructure and endpoints.</li>
        </ul>
      </section>
      <section class="job-apply">
        <label>Upload resume *</label>
        <form action="" method="post" enctype="multipart/form-data">
          <input type="file" name="upload-1" />
          <input type="submit" value="SUBMIT" />
        </form>
      </section>
    </article>
  </body>
</html>
`

const seniorSalesManagerDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Senior Manager (Sales)- Cloud Domain - AMNEX</title>
    <link rel="canonical" href="https://amnex.com/jobs/senior-sales-manager-cloud/" />
  </head>
  <body>
    <article class="jobs type-jobs status-publish job_locations-delhi job_locations-mumbai job_years-10-15-years">
      <div class="job-specs">
        <div><p><strong>Employment</strong></p></div>
        <div><p>Full Time</p></div>
        <div><p><strong>Experience</strong></p></div>
        <div><p>12 &#8211; 15 Years</p></div>
        <div><p><strong>Location</strong></p></div>
        <div><p>Delhi | Mumbai</p></div>
        <div><p><strong>Open Positions</strong></p></div>
        <div><p>1</p></div>
        <div><p><strong>Job Code</strong></p></div>
        <div><p>AIPL/CORP/SAL/SAL/2603</p></div>
      </div>
      <section class="job-copy">
        <p>Own enterprise cloud-domain sales across priority accounts.</p>
      </section>
      <section class="job-apply">
        <label>Upload resume</label>
        <form action="" method="post" enctype="multipart/form-data">
          <input type="file" name="upload-1" />
          <input type="submit" value="SUBMIT" />
        </form>
      </section>
    </article>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/amnexinfotechnologies/script.js')
  } catch {
    assert.fail(
      'Expected Amnex InfoTechnologies scraper module at ../../scraper/amnexinfotechnologies/script.js',
    )
  }
}

test('Amnex InfoTechnologies constants and parsers stay pinned to the verified first-party careers surface', async () => {
  const amnexInfoTechnologies = await loadModule()

  assert.equal(amnexInfoTechnologies.COMPANY_NAME, 'Amnex InfoTechnologies')
  assert.equal(amnexInfoTechnologies.SOURCE, 'amnexinfotechnologies')
  assert.equal(amnexInfoTechnologies.COUNTRY_FILTER, 'India')
  assert.equal(amnexInfoTechnologies.HOMEPAGE_URL, 'https://amnex.com/')
  assert.equal(amnexInfoTechnologies.CAREER_HUB_URL, 'https://amnex.com/career/')
  assert.equal(
    amnexInfoTechnologies.PROFESSIONAL_OPPORTUNITIES_URL,
    'https://amnex.com/professional-opportunities/',
  )
  assert.equal(
    amnexInfoTechnologies.JOBS_API_URL,
    'https://amnex.com/wp-json/wp/v2/jobs?per_page=100',
  )
  assert.equal(
    amnexInfoTechnologies.JOB_LOCATIONS_API_URL,
    'https://amnex.com/wp-json/wp/v2/job_locations?per_page=100',
  )
  assert.equal(
    amnexInfoTechnologies.JOB_YEARS_API_URL,
    'https://amnex.com/wp-json/wp/v2/job_years?per_page=100',
  )
  assert.equal(
    amnexInfoTechnologies.VERIFIED_JOB_DETAIL_URL,
    'https://amnex.com/jobs/cyber-security-expert/',
  )
  assert.equal(
    amnexInfoTechnologies.extractProfessionalOpportunitiesUrl(careerHubHtml),
    amnexInfoTechnologies.PROFESSIONAL_OPPORTUNITIES_URL,
  )
  assert.equal(amnexInfoTechnologies.hasOfficialCareerHubSignal(careerHubHtml), true)
  assert.equal(
    amnexInfoTechnologies.hasOfficialProfessionalOpportunitiesSignal(professionalOpportunitiesHtml),
    true,
  )
  assert.equal(
    amnexInfoTechnologies.hasOfficialProfessionalOpportunitiesSignal(
      professionalOpportunitiesHtmlWithCurrentCards,
    ),
    true,
  )

  const listings = amnexInfoTechnologies.extractListingJobs(
    jobsApiPayload,
    jobLocationsPayload,
    jobYearsPayload,
  )

  assert.deepEqual(listings, [
    {
      title: 'Cyber Security Expert',
      location: 'Ahmedabad, India',
      city: 'Ahmedabad',
      country: 'India',
      jobId: '5379',
      requisitionId: null,
      sourceUrl: 'https://amnex.com/jobs/cyber-security-expert/',
      applyUrl: 'https://amnex.com/jobs/cyber-security-expert/',
      employmentType: null,
      experienceRequired: '10+ Years',
      postingDate: '2026-05-27',
      closingDate: null,
      department: null,
      jobDescription: null,
    },
    {
      title: 'Senior Manager (Sales)- Cloud Domain',
      location: 'Delhi | Mumbai, India',
      city: null,
      country: 'India',
      jobId: '5079',
      requisitionId: null,
      sourceUrl: 'https://amnex.com/jobs/senior-sales-manager-cloud/',
      applyUrl: 'https://amnex.com/jobs/senior-sales-manager-cloud/',
      employmentType: null,
      experienceRequired: '10-15 Years',
      postingDate: '2026-03-26',
      closingDate: null,
      department: null,
      jobDescription: null,
    },
    {
      title: 'Business Analyst (IT Infrastructure Domain)',
      location: 'Ahmedabad, India',
      city: 'Ahmedabad',
      country: 'India',
      jobId: '5248',
      requisitionId: null,
      sourceUrl: 'https://amnex.com/jobs/project-manager-2/',
      applyUrl: 'https://amnex.com/jobs/project-manager-2/',
      employmentType: null,
      experienceRequired: '5+ Years',
      postingDate: '2026-04-30',
      closingDate: null,
      department: null,
      jobDescription: null,
    },
  ])

  assert.equal(
    amnexInfoTechnologies.hasOfficialJobDetailSignal(cyberSecurityExpertDetailHtml, listings[0]),
    true,
  )
  assert.deepEqual(
    amnexInfoTechnologies.extractJobDetail(cyberSecurityExpertDetailHtml, listings[0]),
    {
      title: 'Cyber Security Expert',
      company: 'Amnex InfoTechnologies',
      department: null,
      location: 'Ahmedabad, India',
      city: 'Ahmedabad',
      country: 'India',
      jobId: '5379',
      requisitionId: 'AIPL/CORP/ITINFRA/CSE/2608',
      sourceUrl: 'https://amnex.com/jobs/cyber-security-expert/',
      applyUrl: 'https://amnex.com/jobs/cyber-security-expert/',
      employmentType: 'Full Time',
      experienceRequired: '10+ Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-05-27',
      closingDate: null,
      jobDescription: [
        'Lead cyber security operations across enterprise platforms.',
        'Monitor incidents and coordinate remediation.',
        'Harden infrastructure and endpoints.',
      ].join(' '),
    },
  )

  assert.equal(
    amnexInfoTechnologies.hasOfficialJobDetailSignal(seniorSalesManagerDetailHtml, listings[1]),
    true,
  )
  assert.deepEqual(
    amnexInfoTechnologies.extractJobDetail(seniorSalesManagerDetailHtml, listings[1]),
    {
      title: 'Senior Manager (Sales)- Cloud Domain',
      company: 'Amnex InfoTechnologies',
      department: null,
      location: 'Delhi | Mumbai, India',
      city: null,
      country: 'India',
      jobId: '5079',
      requisitionId: 'AIPL/CORP/SAL/SAL/2603',
      sourceUrl: 'https://amnex.com/jobs/senior-sales-manager-cloud/',
      applyUrl: 'https://amnex.com/jobs/senior-sales-manager-cloud/',
      employmentType: 'Full Time',
      experienceRequired: '12 - 15 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-03-26',
      closingDate: null,
      jobDescription: 'Own enterprise cloud-domain sales across priority accounts.',
    },
  )
})

test('run validates the verified first-party careers surface and decorates runner fields', async () => {
  const amnexInfoTechnologies = await loadModule()
  const requestedTextUrls = []
  const requestedJsonUrls = []

  const jobs = await amnexInfoTechnologies.createAmnexInfoTechnologiesScraper({ maxJobs: 2 }).run({
    fetchText: async (url) => {
      requestedTextUrls.push(url)

      if (url === amnexInfoTechnologies.CAREER_HUB_URL) return careerHubHtml
      if (url === amnexInfoTechnologies.PROFESSIONAL_OPPORTUNITIES_URL) {
        return professionalOpportunitiesHtml
      }
      if (url === 'https://amnex.com/jobs/cyber-security-expert/') {
        return cyberSecurityExpertDetailHtml
      }
      if (url === 'https://amnex.com/jobs/senior-sales-manager-cloud/') {
        return seniorSalesManagerDetailHtml
      }

      throw new Error(`Unexpected Amnex InfoTechnologies fixture URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)

      if (url === amnexInfoTechnologies.JOBS_API_URL) return jobsApiPayload
      if (url === amnexInfoTechnologies.JOB_LOCATIONS_API_URL) return jobLocationsPayload
      if (url === amnexInfoTechnologies.JOB_YEARS_API_URL) return jobYearsPayload

      throw new Error(`Unexpected Amnex InfoTechnologies fixture API URL: ${url}`)
    },
    now: () => FIXED_SCRAPED_AT,
  })

  assert.deepEqual(requestedTextUrls, [
    amnexInfoTechnologies.CAREER_HUB_URL,
    amnexInfoTechnologies.PROFESSIONAL_OPPORTUNITIES_URL,
    'https://amnex.com/jobs/cyber-security-expert/',
    'https://amnex.com/jobs/senior-sales-manager-cloud/',
  ])
  assert.deepEqual(requestedJsonUrls, [
    amnexInfoTechnologies.JOBS_API_URL,
    amnexInfoTechnologies.JOB_LOCATIONS_API_URL,
    amnexInfoTechnologies.JOB_YEARS_API_URL,
  ])
  assert.deepEqual(jobs, [
    {
      title: 'Cyber Security Expert',
      company: 'Amnex InfoTechnologies',
      department: null,
      location: 'Ahmedabad, India',
      city: 'Ahmedabad',
      country: 'India',
      jobId: '5379',
      requisitionId: 'AIPL/CORP/ITINFRA/CSE/2608',
      sourceUrl: 'https://amnex.com/jobs/cyber-security-expert/',
      applyUrl: 'https://amnex.com/jobs/cyber-security-expert/',
      employmentType: 'Full Time',
      experienceRequired: '10+ Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-05-27',
      closingDate: null,
      jobDescription: [
        'Lead cyber security operations across enterprise platforms.',
        'Monitor incidents and coordinate remediation.',
        'Harden infrastructure and endpoints.',
      ].join(' '),
      source: 'amnexinfotechnologies',
      link: 'https://amnex.com/jobs/cyber-security-expert/',
      scrapedAt: FIXED_SCRAPED_AT,
    },
    {
      title: 'Senior Manager (Sales)- Cloud Domain',
      company: 'Amnex InfoTechnologies',
      department: null,
      location: 'Delhi | Mumbai, India',
      city: null,
      country: 'India',
      jobId: '5079',
      requisitionId: 'AIPL/CORP/SAL/SAL/2603',
      sourceUrl: 'https://amnex.com/jobs/senior-sales-manager-cloud/',
      applyUrl: 'https://amnex.com/jobs/senior-sales-manager-cloud/',
      employmentType: 'Full Time',
      experienceRequired: '12 - 15 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-03-26',
      closingDate: null,
      jobDescription: 'Own enterprise cloud-domain sales across priority accounts.',
      source: 'amnexinfotechnologies',
      link: 'https://amnex.com/jobs/senior-sales-manager-cloud/',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})

test('Amnex InfoTechnologies scraper fails closed when the verified careers hub, openings page, jobs feed, or detail form drifts', async () => {
  const amnexInfoTechnologies = await loadModule()

  await assert.rejects(
    amnexInfoTechnologies.createAmnexInfoTechnologiesScraper().run({
      fetchText: async (url) => {
        if (url === amnexInfoTechnologies.CAREER_HUB_URL) {
          return careerHubHtml.replace(
            'https://amnex.com/professional-opportunities/',
            'https://amnex.com/jobs/',
          )
        }

        throw new Error(`Unexpected Amnex InfoTechnologies fixture URL: ${url}`)
      },
      fetchJson: async () => [],
    }),
    /verified careers hub/i,
  )

  await assert.rejects(
    amnexInfoTechnologies.createAmnexInfoTechnologiesScraper().run({
      fetchText: async (url) => {
        if (url === amnexInfoTechnologies.CAREER_HUB_URL) return careerHubHtml
        if (url === amnexInfoTechnologies.PROFESSIONAL_OPPORTUNITIES_URL) {
          return professionalOpportunitiesHtml.replace('Current Openings', 'Current Roles')
        }

        throw new Error(`Unexpected Amnex InfoTechnologies fixture URL: ${url}`)
      },
      fetchJson: async () => [],
    }),
    /verified openings page/i,
  )

  await assert.rejects(
    amnexInfoTechnologies.createAmnexInfoTechnologiesScraper().run({
      fetchText: async (url) => {
        if (url === amnexInfoTechnologies.CAREER_HUB_URL) return careerHubHtml
        if (url === amnexInfoTechnologies.PROFESSIONAL_OPPORTUNITIES_URL) {
          return professionalOpportunitiesHtml
        }

        throw new Error(`Unexpected Amnex InfoTechnologies fixture URL: ${url}`)
      },
      fetchJson: async (url) => {
        if (url === amnexInfoTechnologies.JOBS_API_URL) return {}
        if (url === amnexInfoTechnologies.JOB_LOCATIONS_API_URL) return jobLocationsPayload
        if (url === amnexInfoTechnologies.JOB_YEARS_API_URL) return jobYearsPayload

        throw new Error(`Unexpected Amnex InfoTechnologies fixture API URL: ${url}`)
      },
    }),
    /verified jobs feed/i,
  )

  await assert.rejects(
    amnexInfoTechnologies.createAmnexInfoTechnologiesScraper({ maxJobs: 1 }).run({
      fetchText: async (url) => {
        if (url === amnexInfoTechnologies.CAREER_HUB_URL) return careerHubHtml
        if (url === amnexInfoTechnologies.PROFESSIONAL_OPPORTUNITIES_URL) {
          return professionalOpportunitiesHtml
        }
        if (url === 'https://amnex.com/jobs/cyber-security-expert/') {
          return cyberSecurityExpertDetailHtml.replace('type="file"', 'type="text"')
        }

        throw new Error(`Unexpected Amnex InfoTechnologies fixture URL: ${url}`)
      },
      fetchJson: async (url) => {
        if (url === amnexInfoTechnologies.JOBS_API_URL) return jobsApiPayload
        if (url === amnexInfoTechnologies.JOB_LOCATIONS_API_URL) return jobLocationsPayload
        if (url === amnexInfoTechnologies.JOB_YEARS_API_URL) return jobYearsPayload

        throw new Error(`Unexpected Amnex InfoTechnologies fixture API URL: ${url}`)
      },
    }),
    /verified detail page/i,
  )
})
