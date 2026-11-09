import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const newVisionModulePath = path.resolve(currentDir, '../../scraper/newvisionsoftwareconsultancy/script.js')
const FIXED_SCRAPED_AT = '2026-07-18T00:00:00.000Z'

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | NewVision Software</title>
  </head>
  <body>
    <h1>People-first culture, AI-first careers.</h1>
    <a href="https://careers-newvision.peoplestrong.com/">See Open Roles</a>
    <a href="https://careers-newvision.peoplestrong.com/">Explore Career</a>
    <a href="mailto:career@newvision-software.com">career@newvision-software.com</a>
  </body>
</html>
`

const portalShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Candidate Portal</title>
  </head>
  <body class="candidate-portal">
    <app-root data-testid="src-index-app-root-page-1"></app-root>
    <script src="main-IQMZX3K4.js" type="module"></script>
  </body>
</html>
`

const samplePayload = {
  messageCode: { code: 200, messages: 'success' },
  totalRecords: 2,
  response: [
    {
      organizationUnitComplete: 'NewVison>New Vision Softcom & Consultancy Pvt. Ltd>Business Units (BU)>Product Engineering>Application Development',
      organizationUnit: 'Product Engineering',
      jobPostedDate: '2026-07-17',
      locationHierarchyComplete: 'APAC>India>Pune>Hybrid>Pune office Standard>Maharashtra',
      jobDetailUrl: null,
      requisitionId: null,
      jobTitle: 'Sr. Python Developer AI/ML',
      jobCode: 'NVS/-PD/1803683',
      jobClosureDate: '2027-07-17',
      expRange: '5-8 years',
      skills: {
        mustTohave: ['Python'],
        goodtohave: ['Machine Learning'],
      },
      employmentTenureType: null,
    },
    {
      organizationUnitComplete: 'NewVison>New Vision Softcom & Consultancy Pvt. Ltd>Business Units (BU)>AI & Analytics>Data Engineering',
      organizationUnit: 'AI & Analytics',
      jobPostedDate: '2026-07-17',
      locationHierarchyComplete: 'APAC>India>Pune>Hybrid>Pune office Standard>Maharashtra',
      jobDetailUrl: null,
      requisitionId: null,
      jobTitle: 'AI Engineer',
      jobCode: 'NVS/AE/1805060',
      jobClosureDate: '2027-07-17',
      expRange: '3-5 years',
      skills: {
        mustTohave: ['LLM'],
        goodtohave: ['RAG'],
      },
      employmentTenureType: 'Full Time',
    },
  ],
}

const detailPayload = record => ({
  messageCode: {code:200,messages:'success'},
  response: {
    requisitionCode:record.jobCode,requisitionId:record.jobCode.split('/').at(-1),entityID:'1397',
    jobTitle:record.jobTitle,organizationUnitComplete:record.organizationUnitComplete,
    locationHierarchyComplete:record.locationHierarchyComplete,requisitionStatus:'OPEN',
    jobDescription:'<p>Develop production software with Python and machine learning.</p>',
  },
})

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/newvisionsoftwareconsultancy/catalog.js')
  } catch {
    assert.fail('Expected NewVision Software & Consultancy catalog module at ../../scraper/newvisionsoftwareconsultancy/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/newvisionsoftwareconsultancy/script.js')
  } catch {
    assert.fail('Expected NewVision Software & Consultancy scraper module at ../../scraper/newvisionsoftwareconsultancy/script.js')
  }
}

test('NewVision Software & Consultancy catalog captures the verified PeopleStrong handoff and public jobs API', async () => {
  const {
    NEW_VISION_SOFTWARE_CONSULTANCY_CATALOG,
    default: defaultCatalog,
  } = await loadCatalogModule()
  const newVision = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(NEW_VISION_SOFTWARE_CONSULTANCY_CATALOG)

  assert.equal(defaultCatalog, NEW_VISION_SOFTWARE_CONSULTANCY_CATALOG)
  assert.equal(provider.source, 'newvisionsoftwareconsultancy')
  assert.equal(provider.companyName, 'NewVision Software & Consultancy')
  assert.equal(provider.officialBrandName, 'New Vision Softcom & Consultancy Pvt. Ltd.')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://newvision-software.com/')
  assert.equal(provider.companyCareerPage, 'https://newvision-software.com/careers/')
  assert.equal(provider.portalOrigin, 'https://careers-newvision.peoplestrong.com')
  assert.equal(provider.jobListingsUrl, 'https://careers-newvision.peoplestrong.com/')
  assert.equal(
    provider.jobsApiUrl,
    'https://careers-newvision.peoplestrong.com/api/cp/rest/altone/cp/jobs/v1?offset=0&limit=20',
  )
  assert.equal(provider.companyDomain, 'careers-newvision.peoplestrong.com')
  assert.equal(provider.atsPlatform, 'peoplestrong')
  assert.equal(provider.paginationStrategy, 'official-careers-page-plus-peoplestrong-offset-limit-api')
  assert.equal(
    provider.extractionStrategy,
    'official-careers-page+direct-peoplestrong-handoff+peoplestrong-jobs-api',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.verifiedPublicJobCount, 97)
  assert.equal(provider.modulePath, newVisionModulePath)
  assert.match(provider.verifiedSurfaceSummary, /97 public openings/i)
  assert.equal(newVision.PROVIDER_METADATA.source, NEW_VISION_SOFTWARE_CONSULTANCY_CATALOG.source)

  const report = generateCompanyCoverageReport({
    csvText: 'NewVision Software & Consultancy\n',
    catalog: [provider],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})

test('NewVision Software & Consultancy validates the official careers page and maps PeopleStrong roles', async () => {
  const newVision = await loadScriptModule()

  assert.equal(newVision.hasOfficialCareersPageSignal(careersPageHtml), true)
  assert.equal(
    newVision.extractPeopleStrongHandoffUrl(careersPageHtml),
    'https://careers-newvision.peoplestrong.com/',
  )
  assert.equal(newVision.hasPublicPortalShell(portalShellHtml), true)
  assert.deepEqual(newVision.buildPublicHeaders(), {
    Origin: 'https://careers-newvision.peoplestrong.com',
    Referer: 'https://careers-newvision.peoplestrong.com/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
    Accept: 'application/json,text/plain,*/*',
    'Content-Type': 'application/json',
  })

  assert.deepEqual(newVision.extractSearchResults(samplePayload), [
    {
      title: 'Sr. Python Developer AI/ML',
      company: 'NewVision Software & Consultancy',
      department: 'Product Engineering',
      location: 'Pune, Maharashtra, India',
      city: 'Pune',
      state: 'Maharashtra',
      country: 'India',
      jobId: 'NVS/-PD/1803683',
      requisitionId: 'NVS/-PD/1803683',
      sourceUrl: 'https://careers-newvision.peoplestrong.com/job/detail/NVS_-PD_1803683',
      applyUrl: 'https://careers-newvision.peoplestrong.com/job/detail/NVS_-PD_1803683',
      employmentType: null,
      experienceRequired: '5-8 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: ['Python', 'Machine Learning'],
      postingDate: '2026-07-17',
      closingDate: '2027-07-17',
      jobDescription: null,
      remoteStatus: 'Hybrid',
    },
    {
      title: 'AI Engineer',
      company: 'NewVision Software & Consultancy',
      department: 'AI & Analytics',
      location: 'Pune, Maharashtra, India',
      city: 'Pune',
      state: 'Maharashtra',
      country: 'India',
      jobId: 'NVS/AE/1805060',
      requisitionId: 'NVS/AE/1805060',
      sourceUrl: 'https://careers-newvision.peoplestrong.com/job/detail/NVS_AE_1805060',
      applyUrl: 'https://careers-newvision.peoplestrong.com/job/detail/NVS_AE_1805060',
      employmentType: 'Full Time',
      experienceRequired: '3-5 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: ['LLM', 'RAG'],
      postingDate: '2026-07-17',
      closingDate: '2027-07-17',
      jobDescription: null,
      remoteStatus: 'Hybrid',
    },
  ])

  const pageRequests = []
  const apiRequests = []
  const jobs = await newVision.createNewVisionSoftwareConsultancyScraper().run({
    now: () => FIXED_SCRAPED_AT,
    fetchPage: async (url) => {
      pageRequests.push(url)

      if (url === newVision.CAREERS_PAGE_URL) {
        return { status: 200, url, html: careersPageHtml }
      }

      if (url === newVision.JOB_LISTINGS_URL) {
        return { status: 200, url, html: portalShellHtml }
      }

      throw new Error(`Unexpected NewVision page URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      apiRequests.push({ url, options })
      const record = samplePayload.response.find(row => newVision.buildJobDetailsApiUrl(row.jobCode) === url)
      if (record) return detailPayload(record)
      return samplePayload
    },
  })

  assert.deepEqual(pageRequests, [
    newVision.CAREERS_PAGE_URL,
    newVision.JOB_LISTINGS_URL,
  ])
  assert.equal(apiRequests.length, 3)
  assert.equal(apiRequests[0].url, newVision.buildApiUrl())
  assert.equal(apiRequests[0].options.method, 'POST')
  assert.deepEqual(apiRequests[0].options.headers, newVision.buildPublicHeaders())
  assert.equal(apiRequests[0].options.body, JSON.stringify({}))
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'newvisionsoftwareconsultancy')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
})

test('NewVision Software & Consultancy fails closed when the verified handoff drifts', async () => {
  const newVision = await loadScriptModule()

  await assert.rejects(
    newVision.createNewVisionSoftwareConsultancyScraper().run({
      fetchPage: async (url) => {
        if (url === newVision.CAREERS_PAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Unexpected</h1></body></html>' }
        }

        throw new Error(`Unexpected NewVision page URL: ${url}`)
      },
    }),
    /verified official careers page/i,
  )
})

test('NewVision Software & Consultancy propagates the runner abort signal through page and API fetches', async () => {
  const newVision = await loadScriptModule()
  const controller = new AbortController()
  const pageSignals = []
  const apiSignals = []

  await newVision.createNewVisionSoftwareConsultancyScraper().run({
    signal: controller.signal,
    fetchPage: async (url, { signal } = {}) => {
      pageSignals.push(signal)

      if (url === newVision.CAREERS_PAGE_URL) {
        return { status: 200, url, html: careersPageHtml }
      }

      if (url === newVision.JOB_LISTINGS_URL) {
        return { status: 200, url, html: portalShellHtml }
      }

      throw new Error(`Unexpected NewVision page URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      apiSignals.push(options.signal)
      const record = samplePayload.response.find(row => newVision.buildJobDetailsApiUrl(row.jobCode) === url)
      if (record) return detailPayload(record)
      return samplePayload
    },
  })

  assert.deepEqual(pageSignals, [controller.signal, controller.signal])
  assert.deepEqual(apiSignals, [controller.signal, controller.signal, controller.signal])
})
