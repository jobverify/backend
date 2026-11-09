import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/ceipal/script.js')

const loadCatalog = async () => {
  try {
    return await import('../../scraper/ceipal/catalog.js')
  } catch {
    assert.fail('Expected Ceipal catalog module at ../../scraper/ceipal/catalog.js')
  }
}

const loadScript = async () => {
  try {
    return await import('../../scraper/ceipal/script.js')
  } catch {
    assert.fail('Expected Ceipal scraper module at ../../scraper/ceipal/script.js')
  }
}

const currentOpeningsHtml = `
<!doctype html>
<html>
  <head>
    <title>Current Opening | CEIPAL</title>
  </head>
  <body>
    <h1>We're Hiring</h1>
    <section>
      <article class="opening">
        <h2>Job Title: Enterprise Business Development Representative</h2>
        <p>Location: Rochester, NY</p>
        <p>Experience: 1-3 Years</p>
        <p>Resumes should be submitted via email to <a href="mailto:apply@ceipal.com">apply@ceipal.com</a></p>
      </article>
      <article class="opening">
        <h2>Job Title: Senior Implementation Engineer</h2>
        <p>Location: Hyderabad, India</p>
        <p>Experience: 4-6 Years</p>
        <p>Resumes should be submitted via email to <a href="mailto:apply@ceipal.com">apply@ceipal.com</a></p>
      </article>
    </section>
  </body>
</html>
`

const liveLikeUsOnlyHtml = `
<!doctype html>
<html>
  <body>
    <h1>We're Hiring</h1>
    <article class="opening">
      <h2>Job Title: Enterprise Business Development Representative</h2>
      <p>Location: Rochester, NY</p>
      <p>Experience: 1-3 Years</p>
      <p>Resumes should be submitted via email to <a href="mailto:apply@ceipal.com">apply@ceipal.com</a></p>
    </article>
  </body>
</html>
`

test('Ceipal local catalog captures the first-party current-opening page and mailto application handoff', async () => {
  const { CEIPAL_CATALOG, default: defaultCatalog } = await loadCatalog()
  const provider = hydrateProviderCatalogEntry(CEIPAL_CATALOG)
  const report = generateCompanyCoverageReport({
    csvText: 'Ceipal\n',
    catalog: [provider],
  })

  assert.equal(defaultCatalog, CEIPAL_CATALOG)
  assert.equal(provider.source, 'ceipal')
  assert.equal(provider.companyName, 'Ceipal')
  assert.equal(provider.officialBrandName, 'CEIPAL')
  assert.equal(provider.companyCareerPage, 'https://www.ceipal.com/current-opening')
  assert.equal(provider.officialCareersLandingUrl, 'https://www.ceipal.com/careers')
  assert.equal(provider.companyDomain, 'ceipal.com')
  assert.equal(provider.atsPlatform, 'first-party-current-opening-page')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-current-opening-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-current-opening-page+mailto-apply+india-location-filter',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /ceipal[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Enterprise Business Development Representative/i)
  assert.match(provider.verifiedSurfaceSummary, /apply@ceipal\.com/i)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})

test('Ceipal extracts the first-party opening cards and keeps only India jobs at run time', async () => {
  const ceipal = await loadScript()

  assert.equal(ceipal.CURRENT_OPENINGS_URL, 'https://www.ceipal.com/current-opening')
  assert.equal(ceipal.APPLICATION_URL, 'mailto:apply@ceipal.com')
  assert.equal(ceipal.hasOfficialCareersSignal(currentOpeningsHtml), true)

  const listings = ceipal.extractOpenings(currentOpeningsHtml)
  assert.equal(listings.length, 2)
  assert.deepEqual(listings[1], {
    title: 'Senior Implementation Engineer',
    company: 'Ceipal',
    department: null,
    location: 'Hyderabad, India',
    city: 'Hyderabad',
    country: 'India',
    jobId: 'senior-implementation-engineer',
    requisitionId: 'senior-implementation-engineer',
    sourceUrl: 'https://www.ceipal.com/current-opening',
    applyUrl: 'mailto:apply@ceipal.com',
    employmentType: null,
    experienceRequired: '4-6 Years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Resumes should be submitted via email to apply@ceipal.com',
  })

  const jobs = await ceipal.createCeipalScraper().run({
    fetchText: async (url) => {
      assert.equal(url, ceipal.CURRENT_OPENINGS_URL)
      return currentOpeningsHtml
    },
    now: () => '2026-07-18T00:00:00.000Z',
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Senior Implementation Engineer')
  assert.equal(jobs[0].source, 'ceipal')
  assert.equal(jobs[0].link, 'mailto:apply@ceipal.com')
  assert.equal(jobs[0].scrapedAt, '2026-07-18T00:00:00.000Z')
})

test('Ceipal returns [] for the verified live-like US-only page and throws on first-party surface drift', async () => {
  const ceipal = await loadScript()

  const jobs = await ceipal.createCeipalScraper().run({
    fetchText: async () => liveLikeUsOnlyHtml,
  })
  assert.deepEqual(jobs, [])

  await assert.rejects(
    ceipal.createCeipalScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /Ceipal current opening page/i,
  )
})
