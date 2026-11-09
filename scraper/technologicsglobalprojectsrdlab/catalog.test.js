import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

const SOURCE = 'technologicsglobalprojectsrdlab'
const COMPANY = 'Technologics Global Projects & R&D Lab'
const COMPANY_CAREER_PAGE = 'https://technologics.in/jobs/'

test('Technologics Global Projects & R&D Lab is registered against its verified first-party jobs surface without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === SOURCE)

  assert.ok(provider, 'Expected Technologics Global Projects & R&D Lab provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, COMPANY)
  assert.equal(provider.companyCareerPage, COMPANY_CAREER_PAGE)
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'homepage-plus-jobs-page-plus-page-sitemap-public-posting-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-jobs-page+verified-page-sitemap+verified-first-party-job-posting-pages+shared-register-apply-link',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'technologics.in')
  assert.match(provider.modulePath, /technologicsglobalprojectsrdlab[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, COMPANY), false)
})

test('Technologics Global Projects & R&D Lab matches company coverage directly from provider metadata and is runnable via buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: `${COMPANY},\n`,
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [[COMPANY, SOURCE, COMPANY]],
  )

  const scraper = buildScrapers().find((item) => item.name === SOURCE)

  assert.ok(scraper, 'Expected buildScrapers() to return the Technologics Global Projects & R&D Lab scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, SOURCE)
  assert.equal(scraper.provider.companyCareerPage, COMPANY_CAREER_PAGE)
  assert.match(scraper.dryRunFile, /technologicsglobalprojectsrdlab[\\/]jobs\.json$/i)
})
