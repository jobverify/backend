import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/spicejet/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/spicejet/catalog.js')
  } catch {
    assert.fail('Expected SpiceJet catalog module at ../../scraper/spicejet/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/spicejet/script.js')
  } catch {
    assert.fail('Expected SpiceJet scraper module at ../../scraper/spicejet/script.js')
  }
}

test('SpiceJet local catalog captures the verified careers notice and AME registration sentinel surface', async () => {
  const { SPICEJET_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const spiceJet = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(SPICEJET_CATALOG)

  assert.equal(defaultCatalog, SPICEJET_CATALOG)
  assert.equal(provider.source, 'spicejet')
  assert.equal(provider.companyName, 'SpiceJet')
  assert.equal(provider.officialBrandName, 'SpiceJet')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://corporate.spicejet.com/Careers.aspx?source=aero.jobs')
  assert.equal(provider.ameRegistrationUrl, 'https://corporate.spicejet.com/careers/AME.aspx')
  assert.equal(provider.spiceStarRegistrationUrl, 'https://application.spicestaracademy.edu.in/')
  assert.equal(provider.companyDomain, 'corporate.spicejet.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-trustworthy-public-jobs-surface')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-careers-notice-plus-ame-registration-form-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-notice+verified-ame-registration-form+return-empty-when-no-enumerable-public-jobs',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.dryRunFile, /spicejet[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/corporate\.spicejet\.com\/Careers\.aspx\?source=aero\.jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/corporate\.spicejet\.com\/careers\/AME\.aspx/i)
  assert.match(provider.verifiedSurfaceSummary, /careers@spicejet\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy enumerable public jobs surface/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'SpiceJet'), false)

  assert.equal(spiceJet.PROVIDER_METADATA.source, SPICEJET_CATALOG.source)
  assert.equal(spiceJet.PROVIDER_METADATA.companyName, SPICEJET_CATALOG.companyName)
  assert.equal(
    spiceJet.PROVIDER_METADATA.ameRegistrationUrl,
    SPICEJET_CATALOG.ameRegistrationUrl,
  )
})

test('SpiceJet exact backlog row matches directly from local provider metadata', async () => {
  const { SPICEJET_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'SpiceJet\n',
    catalog: [hydrateProviderCatalogEntry(SPICEJET_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['SpiceJet', 'spicejet', 'SpiceJet']],
  )
})

test('SpiceJet hydrated local catalog stays script-runner compatible for later shared-registry integration', async () => {
  const { SPICEJET_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SPICEJET_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'SpiceJet')
  assert.equal(provider.companyCareerPage, 'https://corporate.spicejet.com/Careers.aspx?source=aero.jobs')
  assert.equal(provider.companyDomain, 'corporate.spicejet.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-trustworthy-public-jobs-surface')
  assert.match(provider.modulePath, /spicejet[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /spicejet[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
