import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { buildScrapers, getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const iskillboxModulePath = path.resolve(currentDir, '../../scraper/iskillbox/script.js')

const loadISkillBoxCatalog = async () => {
  try {
    return await import('../../scraper/iskillbox/catalog.js')
  } catch {
    assert.fail('Expected iSkillBox catalog module at ../../scraper/iskillbox/catalog.js')
  }
}

const loadISkillBoxModule = async () => {
  try {
    return await import('../../scraper/iskillbox/script.js')
  } catch {
    assert.fail('Expected iSkillBox scraper module at ../../scraper/iskillbox/script.js')
  }
}

test('iSkillBox local catalog captures the verified homepage and no-public-jobs career shell without aliases', async () => {
  const { ISKILLBOX_CATALOG } = await loadISkillBoxCatalog()
  const iskillbox = await loadISkillBoxModule()
  const provider = hydrateProviderCatalogEntry(ISKILLBOX_CATALOG)

  assert.equal(provider.source, 'iskillbox')
  assert.equal(provider.companyName, 'iSkillBox')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://iskillbox.com/career/')
  assert.equal(provider.officialHomepageUrl, 'https://iskillbox.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-homepage-plus-contact-style-career-shell-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-contact-style-career-shell-without-public-job-listings-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'iskillbox.com')
  assert.equal(provider.verifiedOn, '2026-08-02')
  assert.match(provider.modulePath, /iskillbox[\\/]script\.js$/i)
  assert.equal(provider.modulePath, iskillboxModulePath)
  assert.match(provider.verifiedSurfaceSummary, /Sunday, August 2, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/iskillbox\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/iskillbox\.com\/career\//i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'iSkillBox'), false)

  assert.equal(iskillbox.PROVIDER_METADATA.source, ISKILLBOX_CATALOG.source)
  assert.equal(iskillbox.PROVIDER_METADATA.companyName, ISKILLBOX_CATALOG.companyName)
  assert.equal(
    iskillbox.PROVIDER_METADATA.companyCareerPage,
    ISKILLBOX_CATALOG.companyCareerPage,
  )
})

test('iSkillBox backlog row matches directly from local provider metadata without alias churn', async () => {
  const { ISKILLBOX_CATALOG } = await loadISkillBoxCatalog()
  const report = generateCompanyCoverageReport({
    csvText: 'iSkillBox\n',
    catalog: [hydrateProviderCatalogEntry(ISKILLBOX_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['iSkillBox', 'iskillbox', 'iSkillBox']],
  )
})

test('getScraperCatalog includes iSkillBox as a verified no-public-jobs sentinel provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'iskillbox')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'iSkillBox')
  assert.equal(provider.companyCareerPage, 'https://iskillbox.com/career/')
  assert.equal(provider.companyDomain, 'iskillbox.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(provider.modulePath, /iskillbox[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable iSkillBox scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'iskillbox')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'iskillbox')
  assert.equal(scraper.provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(scraper.dryRunFile, /iskillbox[\\/]jobs\.json$/i)
})
