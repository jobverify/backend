import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/stanzaliving/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/stanzaliving/catalog.js')
  } catch {
    assert.fail('Expected Stanza Living catalog module at ../../scraper/stanzaliving/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/stanzaliving/script.js')
  } catch {
    assert.fail('Expected Stanza Living scraper module at ../../scraper/stanzaliving/script.js')
  }
}

test('Stanza Living local catalog captures the verified no-public-careers sentinel surface without alias churn', async () => {
  const { STANZA_LIVING_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const stanzaLiving = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(STANZA_LIVING_CATALOG)

  assert.equal(defaultCatalog, STANZA_LIVING_CATALOG)
  assert.equal(provider.source, 'stanzaliving')
  assert.equal(provider.companyName, 'Stanza Living')
  assert.equal(provider.officialBrandName, 'Stanza Living')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.stanzaliving.com/')
  assert.equal(provider.companyCareerPage, 'https://www.stanzaliving.com/careers')
  assert.equal(provider.aboutPageUrl, 'https://www.stanzaliving.com/about-us')
  assert.equal(provider.contactPageUrl, 'https://www.stanzaliving.com/contact-us')
  assert.equal(provider.companyDomain, 'stanzaliving.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'homepage-about-contact-plus-misdirected-careers-route-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-about-contact-pages+verified-careers-route-is-property-listing+return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.dryRunFile, /stanzaliving[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.stanzaliving\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /PG near Careers Department, Mall Road, Dehradun/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Stanza Living'), false)

  assert.equal(stanzaLiving.PROVIDER_METADATA.source, STANZA_LIVING_CATALOG.source)
  assert.equal(stanzaLiving.PROVIDER_METADATA.companyName, STANZA_LIVING_CATALOG.companyName)
  assert.equal(stanzaLiving.PROVIDER_METADATA.aboutPageUrl, STANZA_LIVING_CATALOG.aboutPageUrl)
})

test('Stanza Living exact backlog row matches directly from local provider metadata', async () => {
  const { STANZA_LIVING_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Stanza Living\n',
    catalog: [hydrateProviderCatalogEntry(STANZA_LIVING_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Stanza Living', 'stanzaliving', 'Stanza Living']],
  )
})

test('Stanza Living hydrated local catalog stays script-runner compatible for later registry integration', async () => {
  const { STANZA_LIVING_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(STANZA_LIVING_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Stanza Living')
  assert.equal(provider.companyCareerPage, 'https://www.stanzaliving.com/careers')
  assert.equal(provider.companyDomain, 'stanzaliving.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(provider.modulePath, /stanzaliving[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /stanzaliving[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
