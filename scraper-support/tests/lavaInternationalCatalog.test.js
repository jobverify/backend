import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/lavainternational/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/lavainternational/catalog.js')
  } catch {
    assert.fail('Expected Lava International catalog module at ../../scraper/lavainternational/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/lavainternational/script.js')
  } catch {
    assert.fail('Expected Lava International scraper module at ../../scraper/lavainternational/script.js')
  }
}

test('Lava International local catalog captures the verified empty-openposition corporate careers contract', async () => {
  const { LAVA_INTERNATIONAL_CATALOG } = await loadCatalogModule()
  const lavainternational = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(LAVA_INTERNATIONAL_CATALOG)

  assert.equal(provider.source, 'lavainternational')
  assert.equal(provider.companyName, 'Lava International')
  assert.equal(provider.officialBrandName, 'Lava International Limited')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.lavamobiles.com/')
  assert.equal(provider.aboutPageUrl, 'https://www.lavamobiles.com/aboutus')
  assert.equal(provider.companyCareerPage, 'https://www.lavamobiles.com/career')
  assert.equal(provider.applicationUrl, 'https://www.lavamobiles.com/career/joblist')
  assert.equal(provider.companyDomain, 'lavamobiles.com')
  assert.equal(provider.atsPlatform, 'official-company-site-openposition-api')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'native-unfiltered-all-roles+full-pdf+closing-snapshots-before-cap',
  )
  assert.equal(
    provider.extractionStrategy,
    'current-first-party-clients+full-native-role-and-pdf+explicit-work-country',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, null)
  assert.equal(provider.verifiedPublicJobCount, null)
  assert.equal(provider.verifiedIndiaJobCount, null)
  assert.match(provider.dryRunFile, /lavainternational[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /HTTP failures remain failures/i)
  assert.match(provider.verifiedSurfaceSummary, /full PDF/i)

  assert.equal(lavainternational.PROVIDER_METADATA.source, LAVA_INTERNATIONAL_CATALOG.source)
  assert.equal(lavainternational.PROVIDER_METADATA.companyName, LAVA_INTERNATIONAL_CATALOG.companyName)
  assert.equal(
    lavainternational.PROVIDER_METADATA.companyCareerPage,
    LAVA_INTERNATIONAL_CATALOG.companyCareerPage,
  )
})

test('Lava International exact backlog name matches directly from local provider metadata', async () => {
  const { LAVA_INTERNATIONAL_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Lava International\n',
    catalog: [hydrateProviderCatalogEntry(LAVA_INTERNATIONAL_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Lava International', 'lavainternational', 'Lava International']],
  )
})

test('Lava International hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { LAVA_INTERNATIONAL_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(LAVA_INTERNATIONAL_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Lava International')
  assert.equal(provider.companyCareerPage, 'https://www.lavamobiles.com/career')
  assert.equal(provider.companyDomain, 'lavamobiles.com')
  assert.equal(provider.atsPlatform, 'official-company-site-openposition-api')
  assert.match(provider.modulePath, /lavainternational[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /lavainternational[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
