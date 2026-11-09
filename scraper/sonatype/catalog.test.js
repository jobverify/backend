import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { getScraperCatalog, hydrateProviderCatalogEntry } from '../../scraper-support/providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, './script.js')

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Sonatype Careers & Current Job Openings</title>
  </head>
  <body>
    <h1>Join Our Workplace of Innovators</h1>
    <a href="https://jobs.lever.co/sonatype">See Open Positions</a>
    <section>
      <h2>Featured Job Openings</h2>
      <article>Senior Java Product Support Engineer</article>
    </section>
  </body>
</html>
`

const leverBoardHtml = `
<!doctype html>
<html lang="en">
  <head>
    <meta property="og:url" content="https://jobs.lever.co/sonatype" />
    <meta property="og:description" content="Job openings at Sonatype" />
  </head>
  <body>
    <h1>Job openings at Sonatype</h1>
    <div>Location type</div>
    <div>Location</div>
    <div>Team</div>
    <div>Work type</div>
    <a href="https://jobs.lever.co/sonatype/associate-customer-success-manager">Associate Customer Success Manager</a>
    <a href="https://jobs.lever.co/sonatype/senior-software-engineer-data-license-team">Senior Software Engineer - Data (License Team)</a>
    <a href="https://jobs.lever.co/sonatype/staff-software-engineer">Staff Software Engineer</a>
    <a href="https://jobs.lever.co/sonatype/staff-info-sec-ai-researcher">Staff Info Sec AI Researcher</a>
    <a href="https://jobs.lever.co/sonatype/staff-software-engineer-agentic-first">Staff Software Engineer - Agentic First</a>
    <div>Hyderabad</div>
    <div>United States - Remote</div>
  </body>
</html>
`

const leverPayload = [
  {
    id: 'india-csm',
    text: 'Associate Customer Success Manager',
    hostedUrl: 'https://jobs.lever.co/sonatype/associate-customer-success-manager',
    applyUrl: 'https://jobs.lever.co/sonatype/associate-customer-success-manager/apply',
    createdAt: 1784976000000,
    descriptionPlain: 'Support customers from Hyderabad.',
    categories: {
      team: 'Customer Success - Direct',
      commitment: 'Full-Time',
      location: 'Hyderabad',
      allLocations: ['Hyderabad, India'],
    },
    workplaceType: 'On-site',
  },
  {
    id: 'india-data',
    text: 'Senior Software Engineer - Data (License Team)',
    hostedUrl: 'https://jobs.lever.co/sonatype/senior-software-engineer-data-license-team',
    applyUrl: 'https://jobs.lever.co/sonatype/senior-software-engineer-data-license-team/apply',
    createdAt: 1784976000000,
    descriptionPlain: 'Build data products from Hyderabad.',
    categories: {
      team: 'Engineering - Data Services',
      commitment: 'Full-Time',
      location: 'Hyderabad',
      allLocations: ['Hyderabad, India'],
    },
    workplaceType: 'Hybrid',
  },
  {
    id: 'us-platform',
    text: 'Azure DevOps Engineer',
    hostedUrl: 'https://jobs.lever.co/sonatype/azure-devops-engineer',
    applyUrl: 'https://jobs.lever.co/sonatype/azure-devops-engineer/apply',
    createdAt: 1784976000000,
    descriptionPlain: 'Remote in the United States.',
    categories: {
      team: 'Engineering - Application Platform',
      commitment: 'Full-Time',
      location: 'US - Remote',
      allLocations: ['US - Remote'],
    },
    workplaceType: 'Remote',
  },
]

const loadCatalogModule = async () => {
  try {
    return await import('./catalog.js')
  } catch {
    assert.fail('Expected Sonatype catalog module at ./catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Sonatype scraper module at ./script.js')
  }
}

test('Sonatype catalog captures the verified first-party careers handoff to the official Lever board', async () => {
  const { SONATYPE_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SONATYPE_CATALOG)

  assert.equal(defaultCatalog, SONATYPE_CATALOG)
  assert.equal(provider.source, 'sonatype')
  assert.equal(provider.companyName, 'Sonatype')
  assert.equal(provider.officialBrandName, 'Sonatype')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.sonatype.com/')
  assert.equal(provider.companyCareerPage, 'https://www.sonatype.com/company/careers')
  assert.equal(provider.officialLeverBoardUrl, 'https://jobs.lever.co/sonatype')
  assert.equal(provider.leverApiUrl, 'https://api.lever.co/v0/postings/sonatype?mode=json')
  assert.equal(provider.companyDomain, 'sonatype.com')
  assert.equal(provider.atsPlatform, 'lever')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-careers-validation-plus-lever-api')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+verified-lever-board+lever-postings-api+india-location-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-25')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /sonatype[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.sonatype\.com\/company\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/jobs\.lever\.co\/sonatype/i)
  assert.match(provider.verifiedSurfaceSummary, /Hyderabad/i)
})

test('Sonatype India exact backlog row resolves to the verified Sonatype provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nSonatype India\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.equal(report.matched[0]?.source, 'sonatype')
})

test('Sonatype scraper keeps only India jobs from the verified Lever payload', async () => {
  const sonatype = await loadScriptModule()

  assert.equal(sonatype.SOURCE, 'sonatype')
  assert.equal(sonatype.COMPANY, 'Sonatype')
  assert.equal(sonatype.CAREERS_URL, 'https://www.sonatype.com/company/careers')
  assert.equal(sonatype.LEVER_BOARD_URL, 'https://jobs.lever.co/sonatype')
  assert.equal(sonatype.LEVER_API_URL, 'https://api.lever.co/v0/postings/sonatype?mode=json')
  assert.equal(sonatype.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(sonatype.hasOfficialCareersSignal('<html><body><h1>Careers</h1></body></html>'), false)
  assert.equal(sonatype.hasOfficialLeverBoardSignal(leverBoardHtml), true)
  assert.equal(sonatype.hasOfficialLeverBoardSignal('<html><body><h1>Jobs</h1></body></html>'), false)

  assert.deepEqual(sonatype.extractLeverJobs(leverPayload).map((job) => ({
    title: job.title,
    department: job.department,
    location: job.location,
    city: job.city,
    country: job.country,
    remoteStatus: job.remoteStatus,
    sourceUrl: job.sourceUrl,
  })), [
    {
      title: 'Associate Customer Success Manager',
      department: 'Customer Success - Direct',
      location: 'Hyderabad',
      city: 'Hyderabad',
      country: 'India',
      remoteStatus: 'On-site',
      sourceUrl: 'https://jobs.lever.co/sonatype/associate-customer-success-manager',
    },
    {
      title: 'Senior Software Engineer - Data (License Team)',
      department: 'Engineering - Data Services',
      location: 'Hyderabad',
      city: 'Hyderabad',
      country: 'India',
      remoteStatus: 'Hybrid',
      sourceUrl: 'https://jobs.lever.co/sonatype/senior-software-engineer-data-license-team',
    },
  ])
})

test('Sonatype run validates the verified careers surfaces before decorating India jobs', async () => {
  const sonatype = await loadScriptModule()
  const jobs = await sonatype.createSonatypeScraper().run({
    fetchText: async (url) => {
      if (url === sonatype.CAREERS_URL) return careersHtml
      if (url === sonatype.LEVER_BOARD_URL) return leverBoardHtml

      assert.fail(`Unexpected URL requested: ${url}`)
    },
    fetchJson: async (url) => {
      assert.equal(url, sonatype.LEVER_API_URL)
      return leverPayload
    },
  })

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'sonatype')
  assert.equal(jobs[0].companyCareerPage, 'https://www.sonatype.com/company/careers')
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})

test('Sonatype run fails closed when the verified public surfaces drift', async () => {
  const sonatype = await loadScriptModule()

  await assert.rejects(
    sonatype.createSonatypeScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected Careers</h1></body></html>',
      fetchJson: async () => leverPayload,
    }),
    /verified official careers surface/i,
  )

  await assert.rejects(
    sonatype.createSonatypeScraper().run({
      fetchText: async (url) => (url === sonatype.CAREERS_URL ? careersHtml : '<html><body><h1>Unexpected Jobs</h1></body></html>'),
      fetchJson: async () => leverPayload,
    }),
    /verified public lever board/i,
  )
})
