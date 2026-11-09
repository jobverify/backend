import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/trumindssoftwaresystems/script.js')

const CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Truminds | Careers at Truminds | Join Our Innovation-Driven Team</title>
  </head>
  <body>
    <h2>Job Positions</h2>
    <p>We are looking for creative-MINDS, talented self-starters to join our team. Check out the open positions and apply now.</p>
    <a href="https://truminds.turbohire.co/careerpage/2b7541be-4b35-4cd3-8ba3-09173acb3de9">View Job Positions</a>
  </body>
</html>
`

const BOARD_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Truminds Software Systems Private Limited</title>
    <meta property="og:title" content="Truminds Software Systems Private Limited - Career Page">
    <meta property="og:site_name" content="Truminds Software Systems Private Limited">
  </head>
  <body>
    You need to enable JavaScript to run this app.
  </body>
</html>
`

const SAMPLE_TURBOHIRE_PAYLOAD = {
  Total: 2,
  Result: [
    {
      JobId: 'truminds-job-1',
      JobIdObfuscated: 'truminds-public-role-1',
      JobCode: 'TRU-101',
      JobTitle: 'Senior Software Engineer',
      Department: 'Engineering',
      PublishedDate: '2026-07-11T10:30:00.000Z',
      ExpiryDates: {
        CAREERPAGE: '2026-07-31T00:00:00',
      },
      Location: '[{"Address":"Bengaluru, Karnataka, India"}]',
      JobTypeV2: 'Full Time',
      Experience: {
        MinExp: 4,
        MaxExp: 7,
      },
      Skills: ['C++', 'Networking'],
      JobDescV2: '<p>Build high-performance network software for product engineering clients.</p>',
      OrgDetails: {
        OrgID: '2b7541be-4b35-4cd3-8ba3-09173acb3de9',
        OrgName: 'Truminds Software Systems Private Limited',
      },
    },
    {
      JobId: 'truminds-job-2',
      JobIdObfuscated: 'ignore-me',
      JobCode: 'TRU-US-1',
      JobTitle: 'Solutions Architect',
      Department: 'Consulting',
      PublishedDate: '2026-07-11T10:30:00.000Z',
      ExpiryDates: {
        CAREERPAGE: '2026-07-31T00:00:00',
      },
      Location: '[{"Address":"Dallas, Texas, United States"}]',
      JobTypeV2: 'Full Time',
      Experience: {
        MinExp: 8,
        MaxExp: 10,
      },
      Skills: ['Cloud'],
      JobDescV2: '<p>Ignore non-India jobs.</p>',
      OrgDetails: {
        OrgID: '2b7541be-4b35-4cd3-8ba3-09173acb3de9',
        OrgName: 'Truminds Software Systems Private Limited',
      },
    },
  ],
}

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/trumindssoftwaresystems/catalog.js')
  } catch {
    assert.fail(
      'Expected Truminds Software Systems catalog module at ../../scraper/trumindssoftwaresystems/catalog.js',
    )
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/trumindssoftwaresystems/script.js')
  } catch {
    assert.fail(
      'Expected Truminds Software Systems scraper module at ../../scraper/trumindssoftwaresystems/script.js',
    )
  }
}

const buildProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Truminds Software Systems local catalog captures the verified first-party careers handoff and TurboHire feed contract', async () => {
  const { TRUMINDS_SOFTWARE_SYSTEMS_CATALOG, default: defaultCatalog } =
    await loadCatalogModule()
  const truminds = await loadScriptModule()
  const provider = buildProvider(TRUMINDS_SOFTWARE_SYSTEMS_CATALOG)

  assert.equal(defaultCatalog, TRUMINDS_SOFTWARE_SYSTEMS_CATALOG)
  assert.equal(provider.source, 'trumindssoftwaresystems')
  assert.equal(provider.companyName, 'Truminds Software Systems')
  assert.equal(provider.officialBrandName, 'Truminds Software Systems Private Limited')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.truminds.com/')
  assert.equal(provider.companyCareerPage, 'https://www.truminds.com/en/careers')
  assert.equal(
    provider.handoffBoardUrl,
    'https://truminds.turbohire.co/careerpage/2b7541be-4b35-4cd3-8ba3-09173acb3de9',
  )
  assert.equal(provider.atsPlatform, 'turbohire')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-careers-page-handoff-plus-public-turbohire-api')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+turbohire-board+noauth-token+filteredjobs-api',
  )
  assert.equal(provider.companyDomain, 'truminds.com')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /View Job Positions/i)
  assert.match(provider.verifiedSurfaceSummary, /truminds\.turbohire\.co/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /trumindssoftwaresystems[\\/]jobs\.json$/i)

  assert.equal(truminds.BOARD_URL, provider.handoffBoardUrl)
  assert.equal(truminds.PROVIDER_METADATA.source, provider.source)
})

test('Truminds Software Systems exact backlog row resolves from the local catalog without aliases', async () => {
  const { TRUMINDS_SOFTWARE_SYSTEMS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Truminds Software Systems\n',
    catalog: [buildProvider(TRUMINDS_SOFTWARE_SYSTEMS_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})

const FULL_DESCRIPTION = 'Responsibilities: Build high-performance network software for product engineering clients. Required qualifications: Design reliable networking services, test distributed systems and maintain production software with strong engineering practices.'

test('Truminds Software Systems TurboHire scraper validates the official handoff and maps India jobs', async () => {
  const truminds = await loadScriptModule()
  const requested = []

  const jobs = await truminds.createTrumindsSoftwareSystemsScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requested.push({ type: 'text', url })
      if (url === truminds.OFFICIAL_CAREERS_URL) return CAREERS_HTML
      if (url === truminds.BOARD_URL) return BOARD_HTML
      throw new Error(`Unexpected Truminds text URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      requested.push({ type: 'json', url, method: options.method || 'GET' })

      if (url === truminds.NOAUTH_TOKEN_URL) {
        return { access_token: 'public-token' }
      }

      if (url === truminds.FILTERED_JOBS_URL) {
        return SAMPLE_TURBOHIRE_PAYLOAD
      }
      if (url === `${truminds.API_BASE_URL}/api/publicjobs/truminds-job-1?fieldVisibility=CareerPage`) {
        const record = structuredClone(SAMPLE_TURBOHIRE_PAYLOAD.Result[0])
        return { ...record, JobDescriptionV2: `<p>${FULL_DESCRIPTION}</p>`,
          PublishedDates: { CAREERPAGE: record.PublishedDate }, IsPublic: true,
          JobStatus: 'Active', PublishedJobBoards: ['CAREERPAGE'] }
      }

      throw new Error(`Unexpected Truminds json URL: ${url}`)
    },
    now: () => '2026-07-18T00:00:00.000Z',
  })

  assert.equal(truminds.hasOfficialCareersSignal(CAREERS_HTML), true)
  assert.equal(truminds.extractTurboHireHandoffUrl(CAREERS_HTML), truminds.BOARD_URL)
  assert.equal(truminds.hasOfficialBoardSignal(BOARD_HTML), true)
  assert.deepEqual(requested, [
    { type: 'text', url: truminds.OFFICIAL_CAREERS_URL },
    { type: 'text', url: truminds.BOARD_URL },
    { type: 'json', url: truminds.NOAUTH_TOKEN_URL, method: 'GET' },
    { type: 'json', url: truminds.FILTERED_JOBS_URL, method: 'POST' },
    { type: 'json', url: `${truminds.API_BASE_URL}/api/publicjobs/truminds-job-1?fieldVisibility=CareerPage`, method: 'GET' },
    { type: 'json', url: truminds.FILTERED_JOBS_URL, method: 'POST' },
  ])
  assert.deepEqual(jobs, [
    {
      title: 'Senior Software Engineer',
      company: 'Truminds Software Systems',
      department: 'Engineering',
      location: 'Bengaluru, Karnataka, India',
      city: 'Bengaluru',
      country: 'India',
      jobId: 'truminds-job-1',
      requisitionId: 'TRU-101',
      sourceUrl: 'https://truminds.turbohire.co/job/publicjobs/truminds-public-role-1',
      applyUrl: 'https://truminds.turbohire.co/job/publicjobs/truminds-public-role-1',
      employmentType: 'Full Time',
      experienceRequired: '4-7 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: ['C++', 'Networking'],
      postingDate: '2026-07-11T10:30:00.000Z',
      closingDate: '2026-07-31T00:00:00',
      jobDescription: FULL_DESCRIPTION,
      sourceDescription: FULL_DESCRIPTION,
      sourceDetailComplete: true,
      sourceDescriptionApiUrl: `${truminds.API_BASE_URL}/api/publicjobs/truminds-job-1?fieldVisibility=CareerPage`,
      sourceNativeGeneralPublishedDate: '2026-07-11T10:30:00.000Z',
      sourceNativeLocations: ['Bengaluru, Karnataka, India'],
      sourceListingComplete: false,
      lifecycleCleanupAllowed: false,
      sourceInventoryScope: 'declared-first-party-trumindssoftwaresystems-TurboHire-careers-board',
      source: 'trumindssoftwaresystems',
      link: 'https://truminds.turbohire.co/job/publicjobs/truminds-public-role-1',
      scrapedAt: '2026-07-18T00:00:00.000Z',
    },
  ])
})
