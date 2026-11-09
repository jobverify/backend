import assert from 'node:assert/strict'
import test from 'node:test'

const loadCheckPointIndiaModule = async () => {
  try {
    return await import('../../scraper/checkpointindia/script.js')
  } catch {
    assert.fail('Expected Check Point India scraper module at ../../scraper/checkpointindia/script.js')
  }
}

const officialLandingHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Careers - Check Point Software</title>
    <meta
      name="description"
      content="Join Check Point Software for an innovative, fast-paced global work environment. Collaborate with the brightest minds and build a dynamic career in cybersecurity!"
    />
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <p>Join Check Point Software for an innovative, fast-paced global work environment.</p>
      <a href="https://careers.checkpoint.com/index.php?m=cpcareers&amp;a=search&amp;golden=1">Open Positions</a>
    </main>
  </body>
</html>
`

const officialIndiaSearchHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career Opportunities at Check Point Software</title>
  </head>
  <body>
    <form
      id="solrSearch"
      method="get"
      action="https://careers.checkpoint.com/index.php?m=cpcareers&amp;a=search"
    >
      <input
        id="term"
        class="searchInput"
        type="text"
        placeholder="  Explore by Location, Role, or Department"
      />
      <input
        type="checkbox"
        name="fa[]"
        value="country_s:India"
        data-id="country"
        data-name="India"
        checked
      />
      India (29)
    </form>
    <div id="positionResults">
      <div class="position">
        <a href="https://careers.checkpoint.com/index.php?m=cpcareers&amp;a=show&amp;joborderid=7310896">
          <h2>Atlassian Platform Specialist</h2>
          <p><img src="https://sc1.checkpoint.com/careers/images/location.svg" class="place"> India: Bangalore </p>
        </a>
      </div>
      <div class="position">
        <a href="https://careers.checkpoint.com/index.php?m=cpcareers&amp;a=show&amp;joborderid=7312044">
          <h2>Sales Engineer</h2>
          <p><img src="https://sc1.checkpoint.com/careers/images/location.svg" class="place"> India: Mumbai </p>
        </a>
      </div>
    </div>
  </body>
</html>
`

const officialIndiaDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Atlassian Platform Specialist | Check Point Software</title>
  </head>
  <body>
    <p><img src="https://sc1.checkpoint.com/careers/images/location.svg" class="place"> India: Bangalore </p>
    <h3>Key Responsibilities</h3>
    <ul>
      <li><span>Design and maintain projects, workflows, screens, custom fields, permissions, SLAs, request types, forms, and service portals.</span></li>
    </ul>
    <a
      id="submitBtn"
      href="https://jobs.smartrecruiters.com/CheckPointSoftwareTechnologies2/744000137310896-atlassian-platform-specialist?oga=true"
    >
      APPLY NOW
    </a>
  </body>
</html>
`

const smartRecruitersListingsPayload = {
  offset: 0,
  limit: 100,
  totalFound: 2,
  content: [
    {
      id: '744000137310896',
      name: 'Atlassian Platform Specialist',
      refNumber: '25784',
      releasedDate: '2026-07-12T14:36:11.863Z',
      location: {
        city: 'Bangalore',
        region: '',
        country: 'in',
        fullLocation: 'Bangalore, , India',
      },
      company: {
        identifier: 'CheckPointSoftwareTechnologies2',
        name: 'Check Point Software Technologies',
      },
      department: {},
      typeOfEmployment: {
        id: 'permanent',
        label: 'Full-time',
      },
      experienceLevel: {
        id: 'mid_senior_level',
        label: 'Mid-Senior Level',
      },
      ref: 'https://api.smartrecruiters.com/v1/companies/CheckPointSoftwareTechnologies2/postings/744000137310896',
    },
    {
      id: '744000137310359',
      name: 'Sales Engineer',
      refNumber: '25437',
      releasedDate: '2026-07-12T14:33:42.076Z',
      location: {
        city: 'Mumbai',
        region: '',
        country: 'in',
        fullLocation: 'Mumbai, , India',
      },
      company: {
        identifier: 'CheckPointSoftwareTechnologies2',
        name: 'Check Point Software Technologies',
      },
      department: {},
      typeOfEmployment: {
        id: 'permanent',
        label: 'Full-time',
      },
      experienceLevel: {
        id: 'mid_senior_level',
        label: 'Mid-Senior Level',
      },
      ref: 'https://api.smartrecruiters.com/v1/companies/CheckPointSoftwareTechnologies2/postings/744000137310359',
    },
  ],
}

const atlassianDetailPayload = {
  id: '744000137310896',
  name: 'Atlassian Platform Specialist',
  refNumber: '25784',
  releasedDate: '2026-07-12T14:36:11.863Z',
  postingUrl:
    'https://jobs.smartrecruiters.com/CheckPointSoftwareTechnologies2/744000137310896-atlassian-platform-specialist',
  applyUrl:
    'https://jobs.smartrecruiters.com/CheckPointSoftwareTechnologies2/744000137310896-atlassian-platform-specialist?oga=true',
  location: {
    city: 'Bangalore',
    region: '',
    country: 'in',
    fullLocation: 'Bangalore, , India',
    remote: false,
    hybrid: false,
  },
  company: {
    identifier: 'CheckPointSoftwareTechnologies2',
    name: 'Check Point Software Technologies',
  },
  customField: [
    {
      fieldLabel: 'Career site Category',
      valueLabel: 'IT & System Administration',
    },
  ],
  typeOfEmployment: {
    id: 'permanent',
    label: 'Full-time',
  },
  experienceLevel: {
    id: 'mid_senior_level',
    label: 'Mid-Senior Level',
  },
  jobAd: {
    sections: {
      jobDescription: {
        text: `
          <ul>
            <li><span>Administer and configure Jira Service Management and Jira Software.</span></li>
            <li><span>Design and maintain projects, workflows, screens, custom fields, permissions, SLAs, request types, forms, and service portals.</span></li>
          </ul>
        `,
      },
      qualifications: {
        text: `
          <ul>
            <li><span>B.Sc. in Industrial Engineering / Information Systems, or a related field.</span></li>
          </ul>
        `,
      },
      additionalInformation: {
        text: `
          <p>Experience with Atlassian Cloud environments and participation in migration projects from Data Center to Cloud.</p>
        `,
      },
    },
  },
}

const salesEngineerDetailPayload = {
  id: '744000137310359',
  name: 'Sales Engineer',
  refNumber: '25437',
  releasedDate: '2026-07-12T14:33:42.076Z',
  postingUrl:
    'https://jobs.smartrecruiters.com/CheckPointSoftwareTechnologies2/744000137310359-sales-engineer',
  applyUrl:
    'https://jobs.smartrecruiters.com/CheckPointSoftwareTechnologies2/744000137310359-sales-engineer?oga=true',
  location: {
    city: 'Mumbai',
    region: '',
    country: 'in',
    fullLocation: 'Mumbai, , India',
    remote: false,
    hybrid: false,
  },
  company: {
    identifier: 'CheckPointSoftwareTechnologies2',
    name: 'Check Point Software Technologies',
  },
  customField: [
    {
      fieldLabel: 'Career site Category',
      valueLabel: 'Sales',
    },
  ],
  typeOfEmployment: {
    id: 'permanent',
    label: 'Full-time',
  },
  experienceLevel: {
    id: 'mid_senior_level',
    label: 'Mid-Senior Level',
  },
  jobAd: {
    sections: {
      jobDescription: {
        text: `
          <ul>
            <li><span>Drive regional customer engagement for the India West sales engineering team.</span></li>
          </ul>
        `,
      },
      qualifications: {
        text: `
          <ul>
            <li><span>8+ years of pre-sales engineering experience in cybersecurity.</span></li>
          </ul>
        `,
      },
      additionalInformation: {
        text: `
          <p>Strong presentation and stakeholder management skills are a plus.</p>
        `,
      },
    },
  },
}

test('Check Point India constants stay pinned to the verified first-party careers surface and SmartRecruiters handoff', async () => {
  const checkpointindia = await loadCheckPointIndiaModule()

  assert.equal(checkpointindia.SOURCE, 'checkpointindia')
  assert.equal(checkpointindia.COMPANY, 'Check Point India')
  assert.equal(checkpointindia.OFFICIAL_CAREERS_URL, 'https://www.checkpoint.com/careers/')
  assert.equal(
    checkpointindia.OFFICIAL_JOBS_SURFACE_URL,
    'https://careers.checkpoint.com/index.php?m=cpcareers&a=search',
  )
  assert.equal(
    checkpointindia.OFFICIAL_INDIA_SEARCH_URL,
    'https://careers.checkpoint.com/index.php?m=cpcareers&a=search&fa[]=country_s:India',
  )
  assert.equal(
    checkpointindia.SMARTRECRUITERS_LISTING_API_URL,
    'https://api.smartrecruiters.com/v1/companies/CheckPointSoftwareTechnologies2/postings',
  )
  assert.equal(checkpointindia.SMARTRECRUITERS_COMPANY_IDENTIFIER, 'CheckPointSoftwareTechnologies2')
  assert.equal(checkpointindia.hasOfficialLandingSignal(officialLandingHtml), true)
  assert.equal(
    checkpointindia.extractOfficialJobsSurfaceUrl(officialLandingHtml),
    'https://careers.checkpoint.com/index.php?m=cpcareers&a=search',
  )
  assert.equal(checkpointindia.hasOfficialIndiaSearchSignal(officialIndiaSearchHtml), true)
  assert.deepEqual(checkpointindia.extractOfficialDetailUrls(officialIndiaSearchHtml), [
    'https://careers.checkpoint.com/index.php?m=cpcareers&a=show&joborderid=7310896',
    'https://careers.checkpoint.com/index.php?m=cpcareers&a=show&joborderid=7312044',
  ])
  assert.equal(checkpointindia.hasOfficialDetailSignal(officialIndiaDetailHtml), true)
  assert.equal(
    checkpointindia.extractVerifiedApplyUrl(officialIndiaDetailHtml),
    'https://jobs.smartrecruiters.com/CheckPointSoftwareTechnologies2/744000137310896-atlassian-platform-specialist?oga=true',
  )
  assert.equal(
    checkpointindia.extractSmartRecruitersCompanyIdentifier(
      'https://jobs.smartrecruiters.com/CheckPointSoftwareTechnologies2/744000137310896-atlassian-platform-specialist?oga=true',
    ),
    'CheckPointSoftwareTechnologies2',
  )
})

test('Check Point India run validates the official first-party surface and maps India SmartRecruiters jobs', async () => {
  const checkpointindia = await loadCheckPointIndiaModule()
  const requestedTextUrls = []
  const requestedJsonUrls = []

  const jobs = await checkpointindia.createCheckPointIndiaScraper().run({
    fetchText: async (url) => {
      requestedTextUrls.push(url)

      if (url === checkpointindia.OFFICIAL_CAREERS_URL) return officialLandingHtml
      if (url === checkpointindia.OFFICIAL_INDIA_SEARCH_URL) return officialIndiaSearchHtml
      if (url === 'https://careers.checkpoint.com/index.php?m=cpcareers&a=show&joborderid=7310896') {
        return officialIndiaDetailHtml
      }

      throw new Error(`Unexpected text fixture URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      requestedJsonUrls.push(url)

      if (
        url
        === 'https://api.smartrecruiters.com/v1/companies/CheckPointSoftwareTechnologies2/postings?limit=100&country=in&offset=0'
      ) {
        assert.equal(options.method, 'GET')
        return smartRecruitersListingsPayload
      }

      if (
        url
        === 'https://api.smartrecruiters.com/v1/companies/CheckPointSoftwareTechnologies2/postings/744000137310896'
      ) {
        return atlassianDetailPayload
      }

      if (
        url
        === 'https://api.smartrecruiters.com/v1/companies/CheckPointSoftwareTechnologies2/postings/744000137310359'
      ) {
        return salesEngineerDetailPayload
      }

      throw new Error(`Unexpected json fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedTextUrls, [
    checkpointindia.OFFICIAL_CAREERS_URL,
    checkpointindia.OFFICIAL_INDIA_SEARCH_URL,
    'https://careers.checkpoint.com/index.php?m=cpcareers&a=show&joborderid=7310896',
  ])
  assert.deepEqual(requestedJsonUrls, [
    'https://api.smartrecruiters.com/v1/companies/CheckPointSoftwareTechnologies2/postings?limit=100&country=in&offset=0',
    'https://api.smartrecruiters.com/v1/companies/CheckPointSoftwareTechnologies2/postings/744000137310896',
    'https://api.smartrecruiters.com/v1/companies/CheckPointSoftwareTechnologies2/postings/744000137310359',
  ])

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Atlassian Platform Specialist',
    company: 'Check Point India',
    location: 'Bangalore, India',
    city: 'Bangalore',
    state: null,
    country: 'India',
    link:
      'https://jobs.smartrecruiters.com/CheckPointSoftwareTechnologies2/744000137310896-atlassian-platform-specialist',
    applyUrl:
      'https://jobs.smartrecruiters.com/CheckPointSoftwareTechnologies2/744000137310896-atlassian-platform-specialist?oga=true',
    sourceUrl:
      'https://jobs.smartrecruiters.com/CheckPointSoftwareTechnologies2/744000137310896-atlassian-platform-specialist',
    source: 'checkpointindia',
    jobId: '744000137310896',
    requisitionId: '25784',
    department: 'IT & System Administration',
    employmentType: 'Full-time',
    experienceRequired: null,
    experienceLevel: 'Mid-Senior Level',
    postingDate: '2026-07-12T14:36:11.863Z',
    jobDescription: jobs[0].jobDescription,
    minimumQualification: jobs[0].minimumQualification,
    preferredQualification: jobs[0].preferredQualification,
    requiredSkills: [],
    remoteStatus: 'On-site',
    scrapedAt: jobs[0].scrapedAt,
  })
  assert.match(jobs[0].jobDescription, /Jira Service Management/i)
  assert.match(jobs[0].minimumQualification, /Industrial Engineering/i)
  assert.match(jobs[0].preferredQualification, /Atlassian Cloud/i)
  assert.equal(jobs[1].title, 'Sales Engineer')
  assert.equal(jobs[1].location, 'Mumbai, India')
  assert.equal(jobs[1].department, 'Sales')
})

test('Check Point India fails closed when the official surface or SmartRecruiters handoff changes', async () => {
  const checkpointindia = await loadCheckPointIndiaModule()

  await assert.rejects(
    checkpointindia.createCheckPointIndiaScraper().run({
      fetchText: async (url) => {
        if (url === checkpointindia.OFFICIAL_CAREERS_URL) {
          return '<html><body><h1>Careers</h1></body></html>'
        }

        throw new Error(`Unexpected fixture URL: ${url}`)
      },
      fetchJson: async () => smartRecruitersListingsPayload,
    }),
    /official careers landing page changed/i,
  )

  await assert.rejects(
    checkpointindia.createCheckPointIndiaScraper().run({
      fetchText: async (url) => {
        if (url === checkpointindia.OFFICIAL_CAREERS_URL) return officialLandingHtml
        if (url === checkpointindia.OFFICIAL_INDIA_SEARCH_URL) return officialIndiaSearchHtml
        if (url === 'https://careers.checkpoint.com/index.php?m=cpcareers&a=show&joborderid=7310896') {
          return officialIndiaDetailHtml.replace(
            'https://jobs.smartrecruiters.com/CheckPointSoftwareTechnologies2/744000137310896-atlassian-platform-specialist?oga=true',
            'https://jobs.smartrecruiters.com/AnotherCompany/744000137310896-atlassian-platform-specialist?oga=true',
          )
        }

        throw new Error(`Unexpected fixture URL: ${url}`)
      },
      fetchJson: async () => smartRecruitersListingsPayload,
    }),
    /verified smartrecruiters handoff changed/i,
  )

  await assert.rejects(
    checkpointindia.createCheckPointIndiaScraper().run({
      fetchText: async (url) => {
        if (url === checkpointindia.OFFICIAL_CAREERS_URL) return officialLandingHtml
        if (url === checkpointindia.OFFICIAL_INDIA_SEARCH_URL) return officialIndiaSearchHtml
        if (url === 'https://careers.checkpoint.com/index.php?m=cpcareers&a=show&joborderid=7310896') {
          return officialIndiaDetailHtml
        }

        throw new Error(`Unexpected fixture URL: ${url}`)
      },
      fetchJson: async (url) => {
        if (
          url
          === 'https://api.smartrecruiters.com/v1/companies/CheckPointSoftwareTechnologies2/postings?limit=100&country=in&offset=0'
        ) {
          return { ...smartRecruitersListingsPayload, content: [] }
        }

        throw new Error(`Unexpected json fixture URL: ${url}`)
      },
    }),
    /returned no public India jobs/i,
  )
})
