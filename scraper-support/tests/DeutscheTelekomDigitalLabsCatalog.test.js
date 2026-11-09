import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/deutschetelekomdigitallabs/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/deutschetelekomdigitallabs/catalog.js')
  } catch {
    assert.fail('Expected Deutsche Telekom Digital Labs catalog module at ../../scraper/deutschetelekomdigitallabs/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/deutschetelekomdigitallabs/script.js')
  } catch {
    assert.fail('Expected Deutsche Telekom Digital Labs scraper module at ../../scraper/deutschetelekomdigitallabs/script.js')
  }
}

test('Deutsche Telekom Digital Labs local catalog captures the verified affiliate page plus exact-name modern shell sentinel metadata', async () => {
  const { DEUTSCHE_TELEKOM_DIGITAL_LABS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const dtdl = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(DEUTSCHE_TELEKOM_DIGITAL_LABS_CATALOG)

  assert.equal(defaultCatalog, DEUTSCHE_TELEKOM_DIGITAL_LABS_CATALOG)
  assert.equal(provider.source, 'deutschetelekomdigitallabs')
  assert.equal(provider.companyName, 'Deutsche Telekom Digital Labs')
  assert.equal(provider.officialBrandName, 'Deutsche Telekom Digital Labs')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://dtdl.in/')
  assert.equal(provider.companyCareerPage, 'https://dtdl.in/')
  assert.equal(provider.telekomWorldwidePageUrl, 'https://www.telekom.com/en/company/worldwide')
  assert.equal(provider.companyDomain, 'dtdl.in')
  assert.equal(provider.atsPlatform, 'affiliate-page-plus-exact-name-shell-no-public-jobs')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'affiliate-page-plus-shell-validation')
  assert.equal(provider.extractionStrategy, 'telekom-affiliate-page+exact-name-legacy-or-modern-shell+common-route-validation-return-empty')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-01')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /deutschetelekomdigitallabs[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /DT Digital Labs in India is responsible for product development/i)
  assert.match(provider.verifiedSurfaceSummary, /modern DTDL app shell/i)
  assert.match(provider.verifiedSurfaceSummary, /canonical root at https:\/\/dtdl\.in\//i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Deutsche Telekom Digital Labs'), false)

  assert.equal(dtdl.PROVIDER_METADATA.source, DEUTSCHE_TELEKOM_DIGITAL_LABS_CATALOG.source)
  assert.equal(dtdl.PROVIDER_METADATA.telekomWorldwidePageUrl, DEUTSCHE_TELEKOM_DIGITAL_LABS_CATALOG.telekomWorldwidePageUrl)
})

test('Deutsche Telekom Digital Labs exact backlog row resolves from the local provider contract', async () => {
  const { DEUTSCHE_TELEKOM_DIGITAL_LABS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Deutsche Telekom Digital Labs\n',
    catalog: [hydrateProviderCatalogEntry(DEUTSCHE_TELEKOM_DIGITAL_LABS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Deutsche Telekom Digital Labs', 'deutschetelekomdigitallabs', 'Deutsche Telekom Digital Labs']],
  )
})
