import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import test from 'node:test'
import { pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../providers/index.js'
import { getScraperSourceDirectoryName } from '../../providers/sourcePaths.js'
import { classifyProviderImplementation } from '../../../scripts/reportScriptCatalogTopology.js'

let runtime
const getRuntime = () => {
  runtime ??= {
    catalog: getScraperCatalog(),
    scrapersByName: new Map(buildScrapers().map(scraper => [scraper.name, scraper])),
  }
  return runtime
}

const installOfflineGuard = (t) => {
  let requests = 0
  const forbidden = (url) => {
    requests += 1
    throw Object.assign(new Error('Workbook catalog tests forbid HTTP: ' + String(url)), {
      abortRetries: true,
      code: 'WORKBOOK_TEST_OFFLINE',
    })
  }
  t.mock.method(globalThis, 'fetch', forbidden)
  // A scraper that swallows the transport error must still fail this test.
  t.after(() => assert.equal(requests, 0, 'A workbook test attempted uncontrolled HTTP'))
  return forbidden
}

const assertSentinelProvenance = (provider, id) => {
  const source = provider.source
  const family = id.slice(0, 2)
  const directory = getScraperSourceDirectoryName(provider)
  const verifiedOn = family === '09' ? '2026-08-01' : '2026-08-08'
  const humanDate = family === '09' ? 'Saturday, August 1, 2026' : 'Saturday, August 8, 2026'

  assert.equal(provider.modulePath, '../' + directory + '/script.js', source)
  assert.equal(provider.dryRunFile, directory + '/jobs.json', source)
  assert.equal(provider.atsPlatform, 'workbook-exact-name-sentinel', source)
  assert.equal(provider.countryFilter, 'India', source)
  assert.equal(provider.paginationStrategy, 'none', source)
  assert.equal(provider.extractionStrategy, 'exact-name-batch-coverage-sentinel-return-empty-until-public-surface-is-verified', source)
  assert.equal(provider.parser, 'custom-script', source)
  assert.equal(provider.normalizationProfile, 'engineering-default', source)
  assert.equal(provider.verifiedOn, verifiedOn, source)
  assert.equal(provider.verifiedPublicJobCount, 0, source)
  assert.equal(provider.verifiedIndiaJobCount, 0, source)
  assert.equal(provider.originalModulePath, '../workbookbatch' + id + '/failClosedSentinel.js', source)
  assert.equal(provider.backfillMode ?? null, 'workday', source)
  assert.equal(provider.verificationDisposition, 'no-trustworthy-exact-name-public-jobs-flow-verified-locally', source)
  assert.ok(provider.verifiedSurfaceSummary.includes('Workbook batch ' + family + ' exact-name sentinel'), source)
  assert.ok(provider.verifiedSurfaceSummary.includes(humanDate), source)
  assert.ok(provider.verifiedSurfaceSummary.includes(provider.companyName), source)
}

export const registerWorkbookBatchTests = ({ id, providers }) => {
  assert.match(id, /^(09|10|11)[a-f]$/)

  test('workbook batch ' + id + ' preserves every current exact-name catalog registration', (t) => {
    installOfflineGuard(t)
    const { catalog } = getRuntime()
    assert.ok(providers.length > 0, 'Workbook batch must contain current registrations')
    assert.equal(new Set(providers.map(provider => provider.source)).size, providers.length, 'Workbook sources must be unique')
    const csvText = ['company_name', ...providers.map(provider => '"' + provider.companyName.replaceAll('"', '""') + '"')].join('\n')
    const report = generateCompanyCoverageReport({ csvText, catalog })

    assert.equal(report.matchedCount, providers.length)
    assert.equal(report.unmatchedCount, 0)
    assert.deepEqual(report.unmatched, [])
    assert.deepEqual(report.matched.map(entry => [entry.companyName, entry.source]), providers.map(provider => [provider.companyName, provider.source]))
  })

  test('workbook batch ' + id + ' preserves provenance, checks native routes, and runs only remaining sentinels offline', async (t) => {
    const forbidden = installOfflineGuard(t)
    const { catalog, scrapersByName } = getRuntime()
    const bySource = new Map(catalog.map(provider => [provider.source, provider]))
    let executedSentinels = 0, checkedNativeRoutes = 0

    for (const provider of providers) {
      const source = provider.source
      const current = bySource.get(source)
      const scraper = scrapersByName.get(source)
      assert.ok(current, source + ' must remain registered')
      assert.ok(scraper, source + ' must remain executable')
      assert.equal(current.source, source)
      assert.equal(scraper.name, source)
      assert.equal(typeof scraper.run, 'function', source)
      assert.equal(scraper.provider.adapter, current.adapter, source)
      assert.equal(scraper.provider.atsPlatform, current.atsPlatform, source)
      assert.equal(scraper.provider.modulePath, current.modulePath, source)
      assert.equal(scraper.dryRunFile, current.dryRunFile, source)
      assert.equal(current.countryFilter, 'India', source)

      // Original sentinel records remain documentary after an implementation
      // upgrade. Some workbook records have themselves been updated to native.
      if (provider.atsPlatform === 'workbook-exact-name-sentinel') {
        assertSentinelProvenance(provider, id)
      } else {
        assert.equal(provider.countryFilter, 'India', source)
        assert.ok(provider.atsPlatform && provider.parser && provider.extractionStrategy, source)
      }

      const implementation = classifyProviderImplementation(current)
      if (current.adapter === 'script') {
        assert.ok(existsSync(current.modulePath), source + ' selected module must exist')
        const module = await import(pathToFileURL(current.modulePath).href)
        assert.equal(typeof module.run, 'function', source + ' selected module must export run')
      }
      if (['sentinel', 'static-empty'].includes(implementation.type)) {
        const directory = getScraperSourceDirectoryName(provider)
        assert.ok(current.modulePath.replaceAll('\\', '/').endsWith('/scraper/' + directory + '/script.js'), source)
        assert.deepEqual(await scraper.run({ fetchPage: forbidden, fetchText: forbidden, fetchJson: forbidden }), [], source)
        executedSentinels += 1
      } else {
        // Every repaired source still passes the exact-name, selected adapter,
        // module export, and runner routing contracts above. Its source-specific
        // native fixtures own extraction; this test never calls it unmocked or
        // requires a working integration to keep returning placeholder zeros.
        assert.ok(['script', 'shared-adapter', 'discovery-only'].includes(implementation.type), source)
        checkedNativeRoutes += 1
      }
    }
    assert.equal(executedSentinels + checkedNativeRoutes, providers.length)
  })
}

// Earlier workbook records have their own historical schemas and dates. This
// guard checks the current selected executable without rewriting provenance.
export const installWorkbookOfflineGuard = installOfflineGuard

export const assertCurrentWorkbookRoute = async (current, scraper) => {
  assert.ok(current, 'Workbook source must remain registered')
  assert.ok(scraper, current.source + ' must remain executable')
  const source = current.source
  assert.equal(scraper.name, source)
  assert.equal(typeof scraper.run, 'function', source)
  assert.equal(scraper.provider.companyName, current.companyName, source)
  assert.equal(scraper.provider.adapter, current.adapter, source)
  assert.equal(scraper.provider.atsPlatform, current.atsPlatform, source)
  assert.equal(scraper.provider.modulePath, current.modulePath, source)
  assert.equal(scraper.dryRunFile, current.dryRunFile, source)
  const implementation = classifyProviderImplementation(current)
  assert.ok(['sentinel', 'static-empty', 'script', 'shared-adapter', 'discovery-only'].includes(implementation.type), source)
  if (current.adapter === 'script') {
    assert.ok(existsSync(current.modulePath), source + ' selected module must exist')
    const module = await import(pathToFileURL(current.modulePath).href)
    assert.equal(typeof module.run, 'function', source + ' selected module must export run')
  }
  return implementation.type
}
