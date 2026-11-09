import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/cornerstoneondemand/script.js')

const loadCatalog = async () => {
  try {
    return await import('../../scraper/cornerstoneondemand/catalog.js')
  } catch {
    assert.fail('Expected Cornerstone OnDemand catalog module at ../../scraper/cornerstoneondemand/catalog.js')
  }
}

const loadScript = async () => {
  try {
    return await import('../../scraper/cornerstoneondemand/script.js')
  } catch {
    assert.fail('Expected Cornerstone OnDemand scraper module at ../../scraper/cornerstoneondemand/script.js')
  }
}

const sampleHomePage = `<!doctype html>
<html>
  <head>
    <title>Careers at Cornerstone | Grow Your Future with Us</title>
  </head>
  <body>
    <a href="https://cornerstone.csod.com/ux/ats/careersite/2/home?c=cornerstone">Search Open Positions</a>
    <p>Careers View open job opportunities.</p>
  </body>
</html>`

const sampleJobsBoardPage = `<!doctype html>
<html>
  <body>
    <script>
      if(!csod.context || !csod.context.token) csod.context={"corp":"cornerstone","cultureID":1,"cultureName":"en-US","endpoints":{"cloud":"https://us-galaxy.api.csod.com/","api":"/"},"token":"cornerstone-public-token"};
    </script>
  </body>
</html>`

const sampleSearchPayload = {
  status: 'Success',
  data: {
    totalCount: 3,
    requisitions: [
      {
        requisitionId: 11369,
        displayJobTitle: 'Principal Integration Engineer - India',
        postingEffectiveDate: '2026-07-17T00:00:00Z',
        postingExpirationDate: '2026-08-31T00:00:00Z',
        locations: [
          { city: 'Pune', country: 'India' },
          { city: 'Hyderabad', country: 'India' },
        ],
      },
      {
        requisitionId: 7656977,
        displayJobTitle: 'Principal Quality Engineer - SDET',
        postingEffectiveDate: '2026-07-14T00:00:00Z',
        postingExpirationDate: '2026-08-14T00:00:00Z',
        locations: [
          { city: 'Atlanta', country: 'United States' },
        ],
      },
      {
        requisitionId: 11357,
        displayJobTitle: 'Principal Data Engineer',
        postingEffectiveDate: '2026-07-12T00:00:00Z',
        postingExpirationDate: '2026-08-30T00:00:00Z',
        locations: [
          { city: 'Pune', country: 'India' },
        ],
      },
    ],
  },
}

const detailPayloadById = {
  11369: {
    ref: '11369',
    displayTitle: 'Principal Integration Engineer - India',
    externalDescription: '<p>Build integrations across enterprise learning products.</p>',
    primaryLocation: { city: 'Pune', country: 'India' },
    additionalLocations: [{ city: 'Hyderabad', country: 'India' }],
  },
  7656977: {
    ref: '7656977',
    displayTitle: 'Principal Quality Engineer - SDET',
    externalDescription: '<p>Quality engineering leadership for Atlanta.</p>',
    primaryLocation: { city: 'Atlanta', country: 'United States' },
    additionalLocations: [],
  },
  11357: {
    ref: '11357',
    displayTitle: 'Principal Data Engineer',
    externalDescription: '<p>Design data pipelines for product analytics.</p>',
    primaryLocation: { city: 'Pune', country: 'India' },
    additionalLocations: [],
  },
}

test('Cornerstone OnDemand local catalog captures the verified public CSOD contract with the extended postings window', async () => {
  const { CORNERSTONE_ONDEMAND_CATALOG, default: defaultCatalog } = await loadCatalog()
  const provider = hydrateProviderCatalogEntry(CORNERSTONE_ONDEMAND_CATALOG)
  const report = generateCompanyCoverageReport({
    csvText: 'Cornerstone OnDemand\n',
    catalog: [provider],
  })

  assert.equal(defaultCatalog, CORNERSTONE_ONDEMAND_CATALOG)
  assert.equal(provider.source, 'cornerstoneondemand')
  assert.equal(provider.companyName, 'Cornerstone OnDemand')
  assert.equal(provider.officialBrandName, 'Cornerstone')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.cornerstoneondemand.com/careers/')
  assert.equal(provider.officialJobsBoardUrl, 'https://cornerstone.csod.com/ux/ats/careersite/2/home?c=cornerstone')
  assert.equal(provider.companyDomain, 'cornerstoneondemand.com')
  assert.equal(provider.atsPlatform, 'cornerstone-csod')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'public-csod-search-api-with-postings-window')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page-handoff+public-csod-board-context+india-location-filter+extended-postings-window',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-01')
  assert.equal(provider.verifiedPublicJobCount, 69)
  assert.equal(provider.verifiedIndiaJobCount, 42)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /cornerstoneondemand[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Search Open Positions/i)
  assert.match(provider.verifiedSurfaceSummary, /public board page rather than the marketing handoff page/i)
  assert.match(provider.verifiedSurfaceSummary, /postingsWithinDays=3650/i)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})

test('Cornerstone OnDemand maps the public CSOD search payload into shared India job records', async () => {
  const cornerstone = await loadScript()

  assert.equal(cornerstone.CAREER_PAGE_URL, 'https://www.cornerstoneondemand.com/careers/')
  assert.equal(cornerstone.OFFICIAL_JOBS_BOARD_URL, 'https://cornerstone.csod.com/ux/ats/careersite/2/home?c=cornerstone')
  assert.equal(cornerstone.CAREER_SITE_ID, 2)
  assert.equal(cornerstone.DEFAULT_POSTINGS_WITHIN_DAYS, 3650)
  assert.equal(cornerstone.hasOfficialCareersSignal(sampleHomePage), true)
  assert.equal(cornerstone.extractContextFromHomePage(sampleJobsBoardPage).token, 'cornerstone-public-token')
  assert.deepEqual(cornerstone.buildSearchRequest(), {
    careerSiteId: 2,
    careerSitePageId: 2,
    pageNumber: 1,
    pageSize: 20,
    cultureId: 1,
    cultureName: 'en-US',
    searchText: '',
    states: '',
    countryCodes: '',
    cities: '',
    placeID: '',
    radius: 0,
    postingsWithinDays: 3650,
    customFieldCheckboxKeys: [],
    customFieldDropdowns: [],
    customFieldRadios: [],
  })
  assert.equal(
    cornerstone.buildDetailUrl(11369),
    'https://cornerstone.csod.com/services/x/job-requisition/v2/requisitions/11369/jobDetails?cultureId=1',
  )

  const jobs = cornerstone.extractSearchResults(sampleSearchPayload, { detailPayloadById })

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Principal Integration Engineer - India',
    company: 'Cornerstone OnDemand',
    department: null,
    location: 'Pune, Hyderabad, India',
    city: 'Pune',
    country: 'India',
    jobId: '11369',
    requisitionId: '11369',
    sourceUrl: 'https://cornerstone.csod.com/ux/ats/careersite/2/home/requisition/11369?c=cornerstone',
    applyUrl: 'https://cornerstone.csod.com/ux/ats/careersite/2/home/requisition/11369?c=cornerstone',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-17T00:00:00Z',
    closingDate: '2026-08-31T00:00:00Z',
    jobDescription: 'Build integrations across enterprise learning products.',
  })
})

test('Cornerstone OnDemand run uses the public CSOD search API with the extended postings window and decorates runner fields', async () => {
  const cornerstone = await loadScript()
  const requests = []

  const jobs = await cornerstone.createCornerstoneOnDemandScraper({
    maxJobs: null,
  }).run({
    fetchText: async (url) => {
      requests.push({ type: 'text', url })
      if (url === cornerstone.CAREER_PAGE_URL) return sampleHomePage
      if (url === cornerstone.OFFICIAL_JOBS_BOARD_URL) return sampleJobsBoardPage
      throw new Error(`Unexpected HTML URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      requests.push({ type: 'json', url, options })
      if (url === 'https://us-galaxy.api.csod.com/rec-job-search/external/jobs') {
        return sampleSearchPayload
      }

      const detailMatch = url.match(/requisitions\/(\d+)\/jobDetails/i)
      if (detailMatch) {
        return detailPayloadById[Number(detailMatch[1])]
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-18T00:00:00.000Z',
  })

  const searchRequest = requests.find((request) => request.url === 'https://us-galaxy.api.csod.com/rec-job-search/external/jobs')
  assert.equal(requests[0].url, cornerstone.CAREER_PAGE_URL)
  assert.equal(requests[1].url, cornerstone.OFFICIAL_JOBS_BOARD_URL)
  assert.ok(searchRequest)
  assert.equal(JSON.parse(searchRequest.options.body).postingsWithinDays, 3650)
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'cornerstoneondemand')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].scrapedAt, '2026-07-18T00:00:00.000Z')
})
