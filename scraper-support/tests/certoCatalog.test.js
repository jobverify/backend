import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

const loadCertoModule = async () => {
  try {
    return await import('../../scraper/certo/script.js')
  } catch {
    assert.fail('Expected Certo scraper module at ../../scraper/certo/script.js')
  }
}

test('getScraperCatalog includes Certo as a verified first-party no-public-careers sentinel', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'certo')
  const certo = await loadCertoModule()

  assert.ok(provider)
  assert.equal(provider.source, 'certo')
  assert.equal(provider.companyName, 'Certo')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.certosoftware.com/')
  assert.equal(provider.companyDomain, 'certosoftware.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-about-plus-sitemap-and-404-careers-route-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-surface-without-public-jobs-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.match(provider.modulePath, /certo[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /certo[\\/]jobs\.json$/i)

  assert.equal(typeof certo.createCertoScraper, 'function')
  assert.equal(typeof certo.run, 'function')
  assert.equal(certo.SOURCE, provider.source)
  assert.equal(certo.COMPANY, provider.companyName)
  assert.equal(certo.HOMEPAGE_URL, provider.companyCareerPage)
  assert.equal(certo.ABOUT_URL, 'https://www.certosoftware.com/about/')
  assert.equal(certo.SITEMAP_URL, 'https://www.certosoftware.com/sitemap.xml')
})

test('buildScrapers and company coverage resolve Certo and Certo Software from the shared catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'certo')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'certo')
  assert.match(scraper.dryRunFile, /certo[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Certo,\nCerto Software,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Certo', 'certo', 'Certo'],
      ['Certo Software', 'certo', 'Certo'],
    ],
  )
})
