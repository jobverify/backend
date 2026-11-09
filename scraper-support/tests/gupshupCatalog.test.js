import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/gupshup/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/gupshup/catalog.js')
  } catch {
    assert.fail('Expected Gupshup catalog module at ../../scraper/gupshup/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/gupshup/script.js')
  } catch {
    assert.fail('Expected Gupshup scraper module at ../../scraper/gupshup/script.js')
  }
}

test('Gupshup local catalog captures the verified careers page and WhatsApp handoff without alias churn', async () => {
  const { GUPSHUP_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const gupshup = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(GUPSHUP_CATALOG)

  assert.equal(defaultCatalog, GUPSHUP_CATALOG)
  assert.equal(provider.source, 'gupshup')
  assert.equal(provider.companyName, 'Gupshup')
  assert.equal(provider.officialBrandName, 'Gupshup')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.gupshup.ai/en/')
  assert.equal(provider.companyCareerPage, 'https://www.gupshup.ai/en/careers')
  assert.equal(provider.aboutUsUrl, 'https://www.gupshup.ai/about-us')
  assert.equal(
    provider.officialCareersHandoffUrl,
    'https://api.whatsapp.com/send?app_absent=0&phone=+919873865178&text=Hi+&type=phone_number',
  )
  assert.equal(provider.businessContactEmail, 'sales@gupshup.ai')
  assert.equal(provider.companyDomain, 'gupshup.ai')
  assert.equal(provider.atsPlatform, 'official-company-site-whatsapp-handoff-no-public-jobs')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-careers-page-plus-whatsapp-handoff-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+about-page+whatsapp-handoff-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.dryRunFile, /gupshup[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.gupshup\.ai\/en\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.gupshup\.ai\/about-us/i)
  assert.match(provider.verifiedSurfaceSummary, /api\.whatsapp\.com\/send/i)
  assert.match(provider.verifiedSurfaceSummary, /sales@gupshup\.ai/i)
  assert.match(provider.verifiedSurfaceSummary, /Born in India/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Gupshup'), false)

  assert.equal(gupshup.PROVIDER_METADATA.source, GUPSHUP_CATALOG.source)
  assert.equal(gupshup.PROVIDER_METADATA.companyName, GUPSHUP_CATALOG.companyName)
  assert.equal(
    gupshup.PROVIDER_METADATA.officialCareersHandoffUrl,
    GUPSHUP_CATALOG.officialCareersHandoffUrl,
  )
})

test('Gupshup exact backlog row matches directly from local provider metadata', async () => {
  const { GUPSHUP_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Gupshup\n',
    catalog: [hydrateProviderCatalogEntry(GUPSHUP_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Gupshup', 'gupshup', 'Gupshup']],
  )
})

test('Gupshup hydrated local catalog stays script-runner compatible for later registry integration', async () => {
  const { GUPSHUP_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(GUPSHUP_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Gupshup')
  assert.equal(provider.companyCareerPage, 'https://www.gupshup.ai/en/careers')
  assert.equal(provider.companyDomain, 'gupshup.ai')
  assert.equal(provider.atsPlatform, 'official-company-site-whatsapp-handoff-no-public-jobs')
  assert.match(provider.modulePath, /gupshup[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /gupshup[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
