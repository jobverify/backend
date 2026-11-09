import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const fiveStarBusinessFinanceModulePath = path.resolve(
  currentDir,
  '../../scraper/fivestarbusinessfinance/script.js',
)

const loadFiveStarBusinessFinanceCatalog = async () => {
  try {
    return await import('../../scraper/fivestarbusinessfinance/catalog.js')
  } catch {
    assert.fail(
      'Expected Five Star Business Finance catalog module at ../../scraper/fivestarbusinessfinance/catalog.js',
    )
  }
}

const loadFiveStarBusinessFinanceModule = async () => {
  try {
    return await import('../../scraper/fivestarbusinessfinance/script.js')
  } catch {
    assert.fail(
      'Expected Five Star Business Finance scraper module at ../../scraper/fivestarbusinessfinance/script.js',
    )
  }
}

test('Five Star Business Finance local catalog captures the verified first-party careers shell contract', async () => {
  const { FIVE_STAR_BUSINESS_FINANCE_CATALOG } = await loadFiveStarBusinessFinanceCatalog()
  const fiveStarBusinessFinance = await loadFiveStarBusinessFinanceModule()

  assert.equal(FIVE_STAR_BUSINESS_FINANCE_CATALOG.source, 'fivestarbusinessfinance')
  assert.equal(FIVE_STAR_BUSINESS_FINANCE_CATALOG.companyName, 'Five Star Business Finance')
  assert.equal(
    FIVE_STAR_BUSINESS_FINANCE_CATALOG.officialBrandName,
    'Five-Star Business Finance Limited',
  )
  assert.equal(FIVE_STAR_BUSINESS_FINANCE_CATALOG.adapter, 'script')
  assert.equal(FIVE_STAR_BUSINESS_FINANCE_CATALOG.homepageUrl, 'https://fivestargroup.in/')
  assert.equal(
    FIVE_STAR_BUSINESS_FINANCE_CATALOG.companyCareerPage,
    'https://fivestargroup.in/careers/',
  )
  assert.equal(
    FIVE_STAR_BUSINESS_FINANCE_CATALOG.careerPageUrl,
    'https://fivestargroup.in/careers/',
  )
  assert.equal(FIVE_STAR_BUSINESS_FINANCE_CATALOG.companyDomain, 'fivestargroup.in')
  assert.equal(FIVE_STAR_BUSINESS_FINANCE_CATALOG.atsPlatform, 'official-company-careers-empty-shell')
  assert.equal(FIVE_STAR_BUSINESS_FINANCE_CATALOG.countryFilter, 'India')
  assert.equal(
    FIVE_STAR_BUSINESS_FINANCE_CATALOG.paginationStrategy,
    'homepage-plus-empty-careers-shell-validation',
  )
  assert.equal(
    FIVE_STAR_BUSINESS_FINANCE_CATALOG.extractionStrategy,
    'verified-homepage-careers-link+verified-careers-shell-without-public-jobs+return-empty',
  )
  assert.equal(FIVE_STAR_BUSINESS_FINANCE_CATALOG.parser, 'custom-script')
  assert.equal(FIVE_STAR_BUSINESS_FINANCE_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(FIVE_STAR_BUSINESS_FINANCE_CATALOG.verifiedOn, '2026-07-15')
  assert.equal(FIVE_STAR_BUSINESS_FINANCE_CATALOG.dryRunFile, 'fivestarbusinessfinance/jobs.json')
  assert.match(
    FIVE_STAR_BUSINESS_FINANCE_CATALOG.verifiedSurfaceSummary,
    /https:\/\/fivestargroup\.in\//i,
  )
  assert.match(
    FIVE_STAR_BUSINESS_FINANCE_CATALOG.verifiedSurfaceSummary,
    /https:\/\/fivestargroup\.in\/careers\//i,
  )
  assert.match(FIVE_STAR_BUSINESS_FINANCE_CATALOG.verifiedSurfaceSummary, /Company Culture/i)
  assert.match(FIVE_STAR_BUSINESS_FINANCE_CATALOG.verifiedSurfaceSummary, /Contact us/i)
  assert.match(
    FIVE_STAR_BUSINESS_FINANCE_CATALOG.verifiedSurfaceSummary,
    /no trustworthy public jobs surface/i,
  )
  assert.equal(
    FIVE_STAR_BUSINESS_FINANCE_CATALOG.modulePath,
    fiveStarBusinessFinanceModulePath,
  )

  assert.equal(
    fiveStarBusinessFinance.PROVIDER_METADATA.source,
    FIVE_STAR_BUSINESS_FINANCE_CATALOG.source,
  )
  assert.equal(
    fiveStarBusinessFinance.PROVIDER_METADATA.companyName,
    FIVE_STAR_BUSINESS_FINANCE_CATALOG.companyName,
  )
  assert.equal(
    fiveStarBusinessFinance.PROVIDER_METADATA.careerPageUrl,
    FIVE_STAR_BUSINESS_FINANCE_CATALOG.careerPageUrl,
  )
})

test('Five Star Business Finance backlog row hydrates locally without any alias requirement', async () => {
  const { FIVE_STAR_BUSINESS_FINANCE_CATALOG } = await loadFiveStarBusinessFinanceCatalog()
  const provider = hydrateProviderCatalogEntry(FIVE_STAR_BUSINESS_FINANCE_CATALOG)

  assert.equal(provider.companyName, 'Five Star Business Finance')
  assert.equal(provider.companyDomain, 'fivestargroup.in')
  assert.match(provider.modulePath, /fivestarbusinessfinance[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /fivestarbusinessfinance[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Five Star Business Finance\n',
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Five Star Business Finance', 'fivestarbusinessfinance', 'Five Star Business Finance']],
  )
})
