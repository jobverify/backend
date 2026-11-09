import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const loadLindeIndiaModule = async () => {
  try {
    return await import('../../scraper/lindeindia/script.js')
  } catch {
    assert.fail('Expected Linde India scraper module at ../../scraper/lindeindia/script.js')
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Linde in India | A Linde Company</title>
  </head>
  <body>
    <a href="https://www.lindecareers.com/">Careers</a>
    <a href="https://www.linde.com/">Linde Corporate</a>
  </body>
</html>
`

const jobLocationsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Job Locations | Linde Careers</title>
  </head>
  <body>
    <h1>Click on the menus or map below for job location information, related details and applications.</h1>
    <div>Asia</div>
    <div>India</div>
    <a href="https://linde.csod.com/ux/ats/careersite/25/home?c=linde&amp;cfdd[0][id]=251&amp;cfdd[0][options][0]=1375&amp;cfdd[0][options][1]=1131&amp;cfdd[0][options][2]=1132&amp;country=in">Linde Gases</a>
    <a href="https://leindiacareers.peoplestrong.com/home">Linde Engineering</a>
    <a href="https://linde.csod.com/ux/ats/careersite/25/home?c=linde&amp;cfdd[0][id]=251&amp;cfdd[0][options][0]=2266&amp;country=in">Linde IT Service Center Kolkata</a>
  </body>
</html>
`

const engineeringPortalHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Candidate Portal</title>
  </head>
  <body class="LtR candidate-portal">
    <app-root data-testid="src-index-app-root-page-1"></app-root>
    <script src="main-MWXE6F34.js" type="module"></script>
  </body>
</html>
`

const samplePayload = {
  messageCode: {code:200,messages:'success'},
  totalRecords: 3,
  response: [
    {
      organizationUnitComplete:
        'Linde Engineering India Pvt. Ltd.>Engineering>Electrical Engineering & Instrumentation>Instrumentation & Controls>28300',
      jobPostedDate: '2026-07-10',
      locationHierarchyComplete: 'India>Gujarat>Vadodara>Vadodara',
      jobDetailUrl: null,
      requisitionId: null,
      jobTitle: 'Engineer - Instrumentation & Controls',
      jobCode: 'LEI/E-I-C/1792684',
      organizationUnit: 'Engineering',
      jobClosureDate: '2026-08-31',
      locationHierarchy: 'Vadodara',
      expRange: '18-25 years',
      skills: {
        mustTohave: [],
        goodtohave: [
          'Engineering',
          ' Instrument Control',
          ' Instrumentation',
        ],
      },
      employmentTenureType: null,
    },
    {
      organizationUnitComplete:
        'Linde Engineering India Pvt. Ltd.>Business Development & Sales South Asia>Business Development & Sales South Asia>Sales>31230',
      jobPostedDate: '2026-07-09',
      locationHierarchyComplete: 'India>Gujarat>Vadodara>Vadodara',
      jobDetailUrl: null,
      requisitionId: null,
      jobTitle: 'Senior Proposal Manager',
      jobCode: 'LEI/SPM/1794507',
      organizationUnit: 'Business Development & Sales South Asia',
      jobClosureDate: '2026-08-31',
      locationHierarchy: 'Vadodara',
      expRange: '18-22 years',
      skills: {
        mustTohave: [],
        goodtohave: [
          'Business Development',
          ' Proposal Writing',
          ' Communication',
        ],
      },
      employmentTenureType: null,
    },
    {
      organizationUnitComplete:
        'Linde Engineering GmbH>Engineering',
      jobPostedDate: '2026-07-08',
      locationHierarchyComplete: 'Germany>Bavaria>Munich',
      jobDetailUrl: null,
      requisitionId: null,
      jobTitle: 'Process Engineer',
      jobCode: 'DE/PE/1790001',
      organizationUnit: 'Engineering',
      jobClosureDate: '2026-08-15',
      locationHierarchy: 'Munich',
      expRange: '5-8 years',
      skills: {
        mustTohave: ['Process Design'],
        goodtohave: [],
      },
      employmentTenureType: 'Full Time',
    },
  ],
}

const fixture = name => JSON.parse(readFileSync(new URL(`./fixtures/lindeindia/${name}.json`, import.meta.url)))
const detailPayload = record => ({messageCode:{code:200,messages:'success'},response:{
  requisitionCode:record.jobCode,requisitionId:record.jobCode.split('/').at(-1),entityID:'1475',
  jobTitle:record.jobTitle,organizationUnitComplete:record.organizationUnitComplete,
  locationHierarchyComplete:record.locationHierarchyComplete,requisitionStatus:'OPEN',
  CandidatePortalStartDate:record.jobPostedDate+' 00:00:00.0',CandidatePortalEndDate:record.jobClosureDate+' 00:00:00.0',
  jobDescription:'<p>Provide engineering design and technical support for Linde projects.</p>',
}})

test('Linde India scraper keeps the verified official India handoff pinned', async () => {
  const lindeIndia = await loadLindeIndiaModule()

  assert.equal(lindeIndia.SOURCE, 'lindeindia')
  assert.equal(lindeIndia.COMPANY, 'Linde India')
  assert.equal(lindeIndia.COMPANY_DOMAIN, 'linde.in')
  assert.equal(lindeIndia.HOMEPAGE_URL, 'https://www.linde.in/')
  assert.equal(lindeIndia.JOB_LOCATIONS_URL, 'https://www.lindecareers.com/en/job-locations')
  assert.equal(lindeIndia.ENGINEERING_PORTAL_URL, 'https://leindiacareers.peoplestrong.com/home')
  assert.equal(
    lindeIndia.INDIA_GASES_URL,
    'https://linde.csod.com/ux/ats/careersite/25/home?c=linde&cfdd[0][id]=251&cfdd[0][options][0]=1375&cfdd[0][options][1]=1131&cfdd[0][options][2]=1132&country=in',
  )
  assert.equal(
    lindeIndia.INDIA_ITSC_URL,
    'https://linde.csod.com/ux/ats/careersite/25/home?c=linde&cfdd[0][id]=251&cfdd[0][options][0]=2266&country=in',
  )
  assert.equal(lindeIndia.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(lindeIndia.hasOfficialJobLocationsSignal(jobLocationsHtml), true)
  assert.equal(lindeIndia.hasEngineeringPortalShell(engineeringPortalHtml), true)
  assert.equal(
    lindeIndia.buildApiUrl(),
    'https://leindiacareers.peoplestrong.com/api/cp/rest/altone/cp/jobs/v1?offset=0&limit=20',
  )
  assert.deepEqual(lindeIndia.buildPublicHeaders(), {
    Origin: 'https://leindiacareers.peoplestrong.com',
    Referer: 'https://leindiacareers.peoplestrong.com/home',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
    Accept: 'application/json,text/plain,*/*',
    'Content-Type': 'application/json',
  })

  const jobs = lindeIndia.extractEngineeringJobs(samplePayload)
  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Engineer - Instrumentation & Controls',
    company: 'Linde India',
    department: 'Engineering',
    location: 'Vadodara, Gujarat, India',
    city: 'Vadodara',
    state: 'Gujarat',
    country: 'India',
    jobId: 'LEI/E-I-C/1792684',
    requisitionId: 'LEI/E-I-C/1792684',
    sourceUrl: 'https://leindiacareers.peoplestrong.com/job/detail/LEI_E-I-C_1792684',
    applyUrl: 'https://leindiacareers.peoplestrong.com/job/detail/LEI_E-I-C_1792684',
    employmentType: null,
    experienceRequired: '18-25 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'Engineering',
      'Instrument Control',
      'Instrumentation',
    ],
    postingDate: '2026-07-10',
    closingDate: '2026-08-31',
    jobDescription: null,
    companyCareerPage: 'https://www.lindecareers.com/en/job-locations',
    companyDomain: 'linde.in',
    atsPlatform: 'peoplestrong',
  })
})

test('Linde India scraper returns only India jobs from the verified official engineering board', async () => {
  const lindeIndia = await loadLindeIndiaModule()
  const requestedPages = []
  const apiRequests = []

  const jobs = await lindeIndia.createLindeIndiaScraper().run({
    maxJobs: 2,
    fetchPage: async (url) => {
      requestedPages.push(url)

      if (url === lindeIndia.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === lindeIndia.JOB_LOCATIONS_URL) {
        return { status: 200, url, html: jobLocationsHtml }
      }

      if (url === lindeIndia.ENGINEERING_PORTAL_URL) {
        return { status: 404, url, html: engineeringPortalHtml }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      apiRequests.push({ url, options })
      if (url.endsWith('/urlinfo')) return fixture('urlinfo')
      if (url.endsWith('/layout?isPreview=false')) return fixture('layout')
      const record = samplePayload.response.find(row=>lindeIndia.buildJobDetailsApiUrl(row.jobCode)===url)
      if (record) return detailPayload(record)
      return samplePayload
    },
  })

  assert.deepEqual(requestedPages, [
    lindeIndia.HOMEPAGE_URL,
    lindeIndia.JOB_LOCATIONS_URL,
    lindeIndia.ENGINEERING_PORTAL_URL,
  ])
  assert.equal(apiRequests.length, 5)
  const listingRequest = apiRequests.find(request=>request.url===lindeIndia.buildApiUrl())
  assert.equal(listingRequest.options.method, 'POST')
  assert.deepEqual(listingRequest.options.headers, lindeIndia.buildPublicHeaders())
  assert.equal(listingRequest.options.body, JSON.stringify({}))
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'lindeindia')
  assert.equal(jobs[0].company, 'Linde India')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].companyDomain, 'linde.in')
  assert.equal(jobs[0].companyCareerPage, 'https://www.lindecareers.com/en/job-locations')
  assert.equal(jobs[0].atsPlatform, 'peoplestrong')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
})

test('Linde India scraper fails closed when the verified first-party surface drifts', async () => {
  const lindeIndia = await loadLindeIndiaModule()

  await assert.rejects(
    lindeIndia.createLindeIndiaScraper().run({
      fetchPage: async (url) => {
        if (url === lindeIndia.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Placeholder</h1></body></html>' }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchJson: async () => samplePayload,
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    lindeIndia.createLindeIndiaScraper().run({
      fetchPage: async (url) => {
        if (url === lindeIndia.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === lindeIndia.JOB_LOCATIONS_URL) {
          return { status: 200, url, html: '<html><body><h1>No India handoff here</h1></body></html>' }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchJson: async () => samplePayload,
    }),
    /verified official job locations/i,
  )

  await assert.rejects(
    lindeIndia.createLindeIndiaScraper().run({
      fetchPage: async (url) => {
        if (url === lindeIndia.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === lindeIndia.JOB_LOCATIONS_URL) {
          return { status: 200, url, html: jobLocationsHtml }
        }

        if (url === lindeIndia.ENGINEERING_PORTAL_URL) {
          return { status: 200, url, html: '<html><body><h1>Unknown shell</h1></body></html>' }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchJson: async () => samplePayload,
    }),
    /verified public engineering portal/i,
  )
})
