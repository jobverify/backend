import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/shellrechargesolutions/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/shellrechargesolutions/catalog.js')
  } catch {
    assert.fail('Expected Shell Recharge Solutions catalog module at ../../scraper/shellrechargesolutions/catalog.js')
  }
}

const buildProvider = (catalogEntry) => hydrateProviderCatalogEntry({ ...catalogEntry, modulePath })

test('Shell Recharge Solutions local catalog captures the verified brand homepage and generic Shell careers redirect', async () => {
  const { SHELL_RECHARGE_SOLUTIONS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = buildProvider(SHELL_RECHARGE_SOLUTIONS_CATALOG)

  assert.equal(defaultCatalog, SHELL_RECHARGE_SOLUTIONS_CATALOG)
  assert.equal(provider.source, 'shellrechargesolutions')
  assert.equal(provider.companyName, 'Shell Recharge Solutions')
  assert.equal(provider.companyCareerPage, 'https://shellrecharge.com/careers')
  assert.equal(provider.atsPlatform, 'brand-homepage-plus-generic-shell-careers-redirect')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.verifiedSurfaceSummary, /Shell Global/i)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.equal(provider.modulePath, modulePath)
})

test('Shell Recharge Solutions exact backlog row resolves from the local provider contract', async () => {
  const { SHELL_RECHARGE_SOLUTIONS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Shell Recharge Solutions\n',
    catalog: [buildProvider(SHELL_RECHARGE_SOLUTIONS_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})
