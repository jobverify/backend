import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/imageinformationsystems/catalog.js')
  } catch {
    assert.fail('Expected Image Information Systems catalog module at ../../scraper/imageinformationsystems/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/imageinformationsystems/script.js')
  } catch {
    assert.fail('Expected Image Information Systems scraper module at ../../scraper/imageinformationsystems/script.js')
  }
}

test('Image Information Systems local catalog captures the verified first-party careers page and detail-route metadata', async () => {
  const { IMAGE_INFORMATION_SYSTEMS_CATALOG } = await loadCatalogModule()
  const imageInformationSystems = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(IMAGE_INFORMATION_SYSTEMS_CATALOG)

  assert.equal(IMAGE_INFORMATION_SYSTEMS_CATALOG.source, 'imageinformationsystems')
  assert.equal(IMAGE_INFORMATION_SYSTEMS_CATALOG.companyName, 'Image Information Systems')
  assert.equal(
    IMAGE_INFORMATION_SYSTEMS_CATALOG.officialBrandName,
    'IMAGE Information Systems Europe GmbH',
  )
  assert.equal(IMAGE_INFORMATION_SYSTEMS_CATALOG.adapter, 'script')
  assert.equal(IMAGE_INFORMATION_SYSTEMS_CATALOG.homepageUrl, 'https://www.iq-image.com/')
  assert.equal(
    IMAGE_INFORMATION_SYSTEMS_CATALOG.companyCareerPage,
    'https://www.iq-image.com/join-our-team/',
  )
  assert.equal(IMAGE_INFORMATION_SYSTEMS_CATALOG.companyDomain, 'iq-image.com')
  assert.equal(IMAGE_INFORMATION_SYSTEMS_CATALOG.atsPlatform, 'official-company-site')
  assert.equal(IMAGE_INFORMATION_SYSTEMS_CATALOG.countryFilter, 'Global')
  assert.equal(
    IMAGE_INFORMATION_SYSTEMS_CATALOG.paginationStrategy,
    'single-first-party-listing-page-plus-first-party-detail-pages',
  )
  assert.equal(
    IMAGE_INFORMATION_SYSTEMS_CATALOG.extractionStrategy,
    'verified-first-party-careers-page+visible-job-detail-pages+active-application-signals',
  )
  assert.equal(IMAGE_INFORMATION_SYSTEMS_CATALOG.parser, 'custom-script')
  assert.equal(IMAGE_INFORMATION_SYSTEMS_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(
    IMAGE_INFORMATION_SYSTEMS_CATALOG.verifiedSampleJobUrl,
    'https://www.iq-image.com/job/frontend-developer-m-f-d/',
  )
  assert.equal(IMAGE_INFORMATION_SYSTEMS_CATALOG.modulePath, '../../scraper/imageinformationsystems/script.js')
  assert.equal(IMAGE_INFORMATION_SYSTEMS_CATALOG.dryRunFile, 'imageinformationsystems/jobs.json')
  assert.equal(IMAGE_INFORMATION_SYSTEMS_CATALOG.verifiedOn, '2026-07-16')
  assert.match(IMAGE_INFORMATION_SYSTEMS_CATALOG.verifiedSurfaceSummary, /iq-image\.com\/join-our-team/i)
  assert.match(IMAGE_INFORMATION_SYSTEMS_CATALOG.verifiedSurfaceSummary, /frontend-developer-m-f-d/i)
  assert.match(
    IMAGE_INFORMATION_SYSTEMS_CATALOG.verifiedSurfaceSummary,
    /don't have any open positions|do not have any open positions/i,
  )

  assert.equal(provider.source, 'imageinformationsystems')
  assert.equal(provider.companyName, 'Image Information Systems')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.iq-image.com/join-our-team/')
  assert.equal(provider.companyDomain, 'iq-image.com')
  assert.equal(provider.countryFilter, 'Global')
  assert.match(provider.modulePath, /imageinformationsystems[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /imageinformationsystems[\\/]jobs\.json$/i)

  assert.equal(imageInformationSystems.PROVIDER_METADATA.source, provider.source)
  assert.equal(imageInformationSystems.CAREERS_URL, provider.companyCareerPage)
  assert.equal(imageInformationSystems.HOMEPAGE_URL, provider.homepageUrl)
})

test('Image Information Systems exact-name backlog rows resolve directly from local provider metadata without shared aliases', async () => {
  const { IMAGE_INFORMATION_SYSTEMS_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'Image Information Systems\n',
    catalog: [hydrateProviderCatalogEntry(IMAGE_INFORMATION_SYSTEMS_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Image Information Systems', 'imageinformationsystems', 'Image Information Systems']],
  )
})

test('getScraperCatalog includes Image Information Systems as a verified first-party careers provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'imageinformationsystems')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Image Information Systems')
  assert.equal(provider.companyCareerPage, 'https://www.iq-image.com/join-our-team/')
  assert.equal(provider.companyDomain, 'iq-image.com')
  assert.equal(provider.atsPlatform, 'official-company-site')
  assert.match(provider.modulePath, /imageinformationsystems[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Image Information Systems scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'imageinformationsystems')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'imageinformationsystems')
  assert.equal(scraper.provider.atsPlatform, 'official-company-site')
  assert.match(scraper.dryRunFile, /imageinformationsystems[\\/]jobs\.json$/i)
})
