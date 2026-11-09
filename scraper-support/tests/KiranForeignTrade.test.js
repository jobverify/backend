import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/kiranforeigntrade/script.js')
const FIXED_SCRAPED_AT = '2026-07-18T00:00:00.000Z'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>KFT</title>
  </head>
  <body>
    <main>
      <h1>Welcome To Kft Software We Design your future</h1>
      <section>
        <h2>about KFT</h2>
        <p>KFT was established in 2007 and quickly became a leading expert in outsourcing.</p>
      </section>
      <section>
        <h3>our location</h3>
        <p>KFT, I-60, Alpha IT City</p>
        <p>Sector 83, Mohali (160055)</p>
        <p>info@kft.co.in</p>
        <button>Apply For Jobs</button>
      </section>
      <section>
        <h3>Taking your career to the next level</h3>
        <label for="job-role">Job applying for? *</label>
        <select id="job-role">
          <option>Select Position</option>
          <option>PHP Developer</option>
          <option>Web Designer</option>
          <option>Sharepoint Developer</option>
          <option>Ios Developer</option>
          <option>Android Developer</option>
          <option>SEO Executive</option>
          <option>Software Tester</option>
        </select>
      </section>
    </main>
  </body>
</html>
`

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/kiranforeigntrade/catalog.js')
  } catch {
    assert.fail('Expected Kiran Foreign Trade catalog module at ../../scraper/kiranforeigntrade/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/kiranforeigntrade/script.js')
  } catch {
    assert.fail('Expected Kiran Foreign Trade scraper module at ../../scraper/kiranforeigntrade/script.js')
  }
}

test('Kiran Foreign Trade local catalog captures the verified first-party application-form jobs surface', async () => {
  const { KIRAN_FOREIGN_TRADE_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(KIRAN_FOREIGN_TRADE_CATALOG)

  assert.equal(defaultCatalog, KIRAN_FOREIGN_TRADE_CATALOG)
  assert.equal(provider.source, 'kiranforeigntrade')
  assert.equal(provider.companyName, 'Kiran Foreign Trade')
  assert.equal(provider.officialBrandName, 'KFT')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://kft.co.in/')
  assert.equal(provider.companyCareerPage, 'https://kft.co.in/software/')
  assert.equal(provider.companyDomain, 'kft.co.in')
  assert.equal(provider.atsPlatform, 'official-first-party-application-form')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-application-form')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-position-dropdown+shared-apply-form',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Taking your career to the next level/i)
  assert.match(provider.verifiedSurfaceSummary, /PHP Developer/i)
  assert.match(provider.verifiedSurfaceSummary, /Software Tester/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Kiran Foreign Trade\n',
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})

test('Kiran Foreign Trade scraper parses the verified first-party position dropdown', async () => {
  const kft = await loadScriptModule()

  assert.equal(kft.SOURCE, 'kiranforeigntrade')
  assert.equal(kft.COMPANY, 'Kiran Foreign Trade')
  assert.equal(kft.CAREERS_URL, 'https://kft.co.in/software/')
  assert.equal(kft.hasOfficialCareerPageSignal(careersHtml), true)
  assert.deepEqual(kft.extractPositionTitles(careersHtml), [
    'PHP Developer',
    'Web Designer',
    'Sharepoint Developer',
    'Ios Developer',
    'Android Developer',
    'SEO Executive',
    'Software Tester',
  ])

  const jobs = await kft.createKiranForeignTradeScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      assert.equal(url, kft.CAREERS_URL)
      return careersHtml
    },
  })

  assert.equal(jobs.length, 7)
  assert.deepEqual(
    jobs.map((job) => [job.title, job.location, job.department]),
    [
      ['PHP Developer', 'Mohali, Punjab, India', 'Engineering'],
      ['Web Designer', 'Mohali, Punjab, India', 'Design'],
      ['Sharepoint Developer', 'Mohali, Punjab, India', 'Engineering'],
      ['Ios Developer', 'Mohali, Punjab, India', 'Engineering'],
      ['Android Developer', 'Mohali, Punjab, India', 'Engineering'],
      ['SEO Executive', 'Mohali, Punjab, India', 'Marketing'],
      ['Software Tester', 'Mohali, Punjab, India', 'Engineering'],
    ],
  )
  assert.equal(jobs[0].source, 'kiranforeigntrade')
  assert.equal(jobs[0].applyUrl, kft.CAREERS_URL)
  assert.match(jobs[0].sourceUrl, /#php-developer$/i)
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
})

test('Kiran Foreign Trade fails closed when the verified application-form surface drifts', async () => {
  const kft = await loadScriptModule()

  await assert.rejects(
    kft.createKiranForeignTradeScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified kiran foreign trade careers surface/i,
  )
})
