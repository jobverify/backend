import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/flexsintechnologies/script.js')

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career Opportunities</title>
    <link rel="canonical" href="https://www.flexsin.com/careers/">
  </head>
  <body>
    <ul class="jobsList flexBox">
      <li>
        <a href="https://www.flexsin.com/careers/director-open-source-technologies/" class="inner">
          <div class="hd">Director - Open Source</div>
          <div class="flexBox">
            <div class="info">11+ Yrs</div>
            <div class="info location">Noida</div>
          </div>
          <div class="over">Director - Open Source</div>
        </a>
      </li>
      <li>
        <a href="https://www.flexsin.com/careers/ai-architect-artificial-intelligence/" class="inner">
          <div class="hd">AI Architect - Artificial Intelligence</div>
          <div class="flexBox">
            <div class="info">11+ Yrs</div>
            <div class="info location">Noida</div>
          </div>
          <div class="over">AI Architect - Artificial Intelligence</div>
        </a>
      </li>
      <li>
        <a href="https://www.flexsin.com/careers/intern-software-engineering/" class="inner">
          <div class="hd">Intern - Software Engineering</div>
          <div class="flexBox">
            <div class="info">Fresher</div>
            <div class="info location">Noida</div>
          </div>
          <div class="over">Intern - Software Engineering</div>
        </a>
      </li>
      <li>
        <a href="https://www.flexsin.com/careers/software-engineer-python/" class="inner">
          <div class="hd">Software Engineer - Python</div>
          <div class="flexBox">
            <div class="info">1-3 Yrs</div>
            <div class="info location">Noida</div>
          </div>
          <div class="over">Software Engineer - Python</div>
        </a>
      </li>
    </ul>
  </body>
</html>
`

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/flexsintechnologies/catalog.js')
  } catch {
    assert.fail('Expected Flexsin Technologies catalog module at ../../scraper/flexsintechnologies/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/flexsintechnologies/script.js')
  } catch {
    assert.fail('Expected Flexsin Technologies scraper module at ../../scraper/flexsintechnologies/script.js')
  }
}

test('Flexsin Technologies local catalog captures the verified first-party careers listings', async () => {
  const { FLEXSIN_TECHNOLOGIES_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(FLEXSIN_TECHNOLOGIES_CATALOG)

  assert.equal(defaultCatalog, FLEXSIN_TECHNOLOGIES_CATALOG)
  assert.equal(provider.source, 'flexsintechnologies')
  assert.equal(provider.companyName, 'Flexsin Technologies')
  assert.equal(provider.officialBrandName, 'Flexsin')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.flexsin.com/')
  assert.equal(provider.companyCareerPage, 'https://www.flexsin.com/careers/')
  assert.equal(provider.companyDomain, 'flexsin.com')
  assert.equal(provider.atsPlatform, 'official-first-party-job-listings')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-page')
  assert.equal(provider.extractionStrategy, 'verified-first-party-inline-job-cards')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-09-13')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /flexsintechnologies[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /37 role cards/i)
  assert.match(provider.verifiedSurfaceSummary, /36 with verified India locations/i)
  assert.match(provider.verifiedSurfaceSummary, /one without a role location/i)
  assert.match(provider.verifiedSurfaceSummary, /prevents expiration of previous jobs/i)
})

test('Flexsin Technologies exact backlog row resolves from the local catalog', async () => {
  const { FLEXSIN_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Flexsin Technologies\n',
    catalog: [hydrateProviderCatalogEntry(FLEXSIN_TECHNOLOGIES_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})

test('Flexsin Technologies scraper parses the verified first-party careers cards', async () => {
  const flexsin = await loadScriptModule()

  assert.equal(flexsin.SOURCE, 'flexsintechnologies')
  assert.equal(flexsin.COMPANY, 'Flexsin Technologies')
  assert.equal(flexsin.CAREERS_URL, 'https://www.flexsin.com/careers/')
  assert.equal(flexsin.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(flexsin.hasOfficialCareersSignal('<html><body><h1>Careers</h1></body></html>'), false)

  assert.deepEqual(flexsin.extractJobs(careersHtml).map((job) => ({
    title: job.title,
    experienceRequired: job.experienceRequired,
    location: job.location,
    sourceUrl: job.sourceUrl,
  })), [
    {
      title: 'Director - Open Source',
      experienceRequired: '11+ Yrs',
      location: 'Noida, Uttar Pradesh, India',
      sourceUrl: 'https://www.flexsin.com/careers/director-open-source-technologies/',
    },
    {
      title: 'AI Architect - Artificial Intelligence',
      experienceRequired: '11+ Yrs',
      location: 'Noida, Uttar Pradesh, India',
      sourceUrl: 'https://www.flexsin.com/careers/ai-architect-artificial-intelligence/',
    },
    {
      title: 'Intern - Software Engineering',
      experienceRequired: 'Fresher',
      location: 'Noida, Uttar Pradesh, India',
      sourceUrl: 'https://www.flexsin.com/careers/intern-software-engineering/',
    },
    {
      title: 'Software Engineer - Python',
      experienceRequired: '1-3 Yrs',
      location: 'Noida, Uttar Pradesh, India',
      sourceUrl: 'https://www.flexsin.com/careers/software-engineer-python/',
    },
  ])
})

test('Flexsin Technologies run validates the verified careers surface before decorating jobs', async () => {
  const flexsin = await loadScriptModule()
  const jobs = await flexsin.createFlexsinTechnologiesScraper().run({
    fetchText: async (url) => {
      assert.equal(url, flexsin.CAREERS_URL)
      return careersHtml
    },
  })

  assert.equal(jobs.length, 4)
  assert.equal(jobs[0].source, 'flexsintechnologies')
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})

test('Flexsin Technologies run fails closed when the verified careers surface drifts', async () => {
  const flexsin = await loadScriptModule()

  await assert.rejects(
    flexsin.createFlexsinTechnologiesScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected Careers</h1></body></html>',
    }),
    /verified flexsin technologies careers surface/i,
  )
})
