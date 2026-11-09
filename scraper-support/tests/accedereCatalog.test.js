import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const accedereModulePath = path.resolve(currentDir, '../../scraper/accedere/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/accedere/catalog.js')
  } catch {
    assert.fail('Expected Accedere catalog module at ../../scraper/accedere/catalog.js')
  }
}

const loadAccedereModule = async () => {
  try {
    return await import('../../scraper/accedere/script.js')
  } catch {
    assert.fail('Expected Accedere scraper module at ../../scraper/accedere/script.js')
  }
}

test('Accedere local catalog captures the verified first-party no-public-jobs surface', async () => {
  const { ACCEDERE_CATALOG } = await loadCatalogModule()
  const accedere = await loadAccedereModule()

  assert.equal(ACCEDERE_CATALOG.source, 'accedere')
  assert.equal(ACCEDERE_CATALOG.companyName, 'Accedere')
  assert.equal(ACCEDERE_CATALOG.officialBrandName, 'Accedere')
  assert.equal(ACCEDERE_CATALOG.adapter, 'script')
  assert.equal(ACCEDERE_CATALOG.companyCareerPage, 'https://accedere.io/')
  assert.equal(ACCEDERE_CATALOG.companyDomain, 'accedere.io')
  assert.equal(ACCEDERE_CATALOG.aboutPageUrl, 'https://accedere.io/about')
  assert.equal(ACCEDERE_CATALOG.contactPageUrl, 'https://accedere.io/contact')
  assert.equal(ACCEDERE_CATALOG.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(ACCEDERE_CATALOG.countryFilter, 'India')
  assert.equal(
    ACCEDERE_CATALOG.paginationStrategy,
    'homepage-plus-about-page-plus-contact-page-plus-common-careers-route-validation',
  )
  assert.equal(
    ACCEDERE_CATALOG.extractionStrategy,
    'verified-homepage+verified-about-page+verified-contact-page+no-public-ats-or-careers-links-return-empty',
  )
  assert.equal(ACCEDERE_CATALOG.parser, 'custom-script')
  assert.equal(ACCEDERE_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(ACCEDERE_CATALOG.verifiedOn, '2026-07-14')
  assert.match(ACCEDERE_CATALOG.verifiedSurfaceSummary, /accedere\.io/i)
  assert.match(ACCEDERE_CATALOG.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(ACCEDERE_CATALOG.modulePath, accedereModulePath)

  assert.equal(accedere.PROVIDER_METADATA.source, ACCEDERE_CATALOG.source)
  assert.equal(accedere.PROVIDER_METADATA.companyName, ACCEDERE_CATALOG.companyName)
  assert.equal(accedere.PROVIDER_METADATA.companyCareerPage, ACCEDERE_CATALOG.companyCareerPage)
  assert.equal(accedere.PROVIDER_METADATA.aboutPageUrl, ACCEDERE_CATALOG.aboutPageUrl)
  assert.equal(accedere.PROVIDER_METADATA.contactPageUrl, ACCEDERE_CATALOG.contactPageUrl)
})

test('buildScrapers and company coverage resolve Accedere from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'accedere')
  const scraper = buildScrapers().find((item) => item.name === 'accedere')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Accedere')
  assert.equal(provider.companyCareerPage, 'https://accedere.io/')
  assert.match(scraper.dryRunFile, /accedere[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Accedere\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Accedere', 'accedere', 'Accedere']],
  )
})
