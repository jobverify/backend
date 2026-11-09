import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/onetrust/script.js')

const loadCatalog = async () => {
  try {
    return await import('../../scraper/onetrust/catalog.js')
  } catch {
    assert.fail('Expected One Trust catalog module at ../../scraper/onetrust/catalog.js')
  }
}

const loadScript = async () => {
  try {
    return await import('../../scraper/onetrust/script.js')
  } catch {
    assert.fail('Expected One Trust scraper module at ../../scraper/onetrust/script.js')
  }
}

const careersHtml = `
<!doctype html>
<html>
  <head>
    <title>Careers | OneTrust</title>
  </head>
  <body>
    <section class="greenhousejoblister" data-total-job-found="82">
      <input class="greenhouse-search-input" />
      <select class="greenhouse-location-dropdown"></select>
      <ul id="greenhouse-job-list" class="greenhouse-job-list">
        <li><a href="/careers/principal-software-engineer-java-backend-7668173/">Principal Software Engineer - Java Backend</a></li>
        <li><a href="/careers/principal-quality-engineer-sdet-7656977/">Principal Quality Engineer - SDET</a></li>
      </ul>
    </section>
  </body>
</html>
`

const indiaDetailHtml = `
<!doctype html>
<html>
  <body>
    <h1>Principal Software Engineer - Java Backend</h1>
    <p>Bengaluru, India | Engineering</p>
    <a href="https://job-boards.greenhouse.io/onetrust/jobs/7668173">Apply Now</a>
    <div class="job-description"><p>Build Java backend services.</p></div>
  </body>
</html>
`

const usDetailHtml = `
<!doctype html>
<html>
  <body>
    <h1>Principal Quality Engineer - SDET</h1>
    <p>Atlanta, Georgia | Engineering</p>
    <div class="job-description"><p>Lead quality engineering for US hiring.</p></div>
  </body>
</html>
`

test('One Trust local catalog captures the visible first-party greenhouse-style careers surface', async () => {
  const { ONETRUST_CATALOG, default: defaultCatalog } = await loadCatalog()
  const provider = hydrateProviderCatalogEntry(ONETRUST_CATALOG)
  const report = generateCompanyCoverageReport({
    csvText: 'One Trust\n',
    catalog: [provider],
  })

  assert.equal(defaultCatalog, ONETRUST_CATALOG)
  assert.equal(provider.source, 'onetrust')
  assert.equal(provider.companyName, 'One Trust')
  assert.equal(provider.officialBrandName, 'OneTrust')
  assert.equal(provider.companyCareerPage, 'https://www.onetrust.com/careers/')
  assert.equal(provider.companyDomain, 'onetrust.com')
  assert.equal(provider.atsPlatform, 'first-party-greenhouse-job-lister')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'first-visible-greenhouse-lister-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+visible-job-lister+detail-page-india-filter',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.verifiedPublicJobCount, 82)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /onetrust[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Principal Software Engineer - Java Backend/i)
  assert.match(provider.verifiedSurfaceSummary, /Bengaluru, India/i)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})

test('One Trust extracts visible detail URLs and maps India detail pages into shared job fields', async () => {
  const oneTrust = await loadScript()

  assert.equal(oneTrust.CAREERS_PAGE_URL, 'https://www.onetrust.com/careers/')
  assert.equal(oneTrust.hasOfficialCareersSignal(careersHtml), true)
  assert.deepEqual(oneTrust.extractVisibleDetailUrls(careersHtml), [
    'https://www.onetrust.com/careers/principal-software-engineer-java-backend-7668173/',
    'https://www.onetrust.com/careers/principal-quality-engineer-sdet-7656977/',
  ])
  assert.deepEqual(
    oneTrust.extractJobFromDetailPage(
      'https://www.onetrust.com/careers/principal-software-engineer-java-backend-7668173/',
      indiaDetailHtml,
    ),
    {
      title: 'Principal Software Engineer - Java Backend',
      company: 'One Trust',
      department: 'Engineering',
      location: 'Bengaluru, India',
      city: 'Bengaluru',
      country: 'India',
      jobId: '7668173',
      requisitionId: '7668173',
      sourceUrl: 'https://www.onetrust.com/careers/principal-software-engineer-java-backend-7668173/',
      applyUrl: 'https://job-boards.greenhouse.io/onetrust/jobs/7668173',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Build Java backend services.',
    },
  )
})

test('One Trust run fetches visible detail pages and keeps only India roles', async () => {
  const oneTrust = await loadScript()
  const requests = []

  const jobs = await oneTrust.createOneTrustScraper().run({
    fetchText: async (url) => {
      requests.push(url)

      if (url === oneTrust.CAREERS_PAGE_URL) return careersHtml
      if (url.endsWith('principal-software-engineer-java-backend-7668173/')) return indiaDetailHtml
      if (url.endsWith('principal-quality-engineer-sdet-7656977/')) return usDetailHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-18T00:00:00.000Z',
  })

  assert.deepEqual(requests, [
    oneTrust.CAREERS_PAGE_URL,
    'https://www.onetrust.com/careers/principal-software-engineer-java-backend-7668173/',
    'https://www.onetrust.com/careers/principal-quality-engineer-sdet-7656977/',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Principal Software Engineer - Java Backend')
  assert.equal(jobs[0].source, 'onetrust')
  assert.equal(jobs[0].link, 'https://job-boards.greenhouse.io/onetrust/jobs/7668173')
  assert.equal(jobs[0].scrapedAt, '2026-07-18T00:00:00.000Z')

  await assert.rejects(
    oneTrust.createOneTrustScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /One Trust careers page/i,
  )
})
