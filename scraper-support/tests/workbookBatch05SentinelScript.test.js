import { assertCurrentWorkbookRoute, installWorkbookOfflineGuard } from './helpers/workbookBatchCatalogAssertions20261102.js'
import assert from 'node:assert/strict'
import test from 'node:test'

import dedicatedProviders from '../providers/providerExtensions/zz-dedicated-scraper-folder-backfill.json' with { type: 'json' }
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const EXPECTED_PROVIDER_SOURCES = [
  'smarterai',
  'snapmint',
  'socialpilot',
  'spheraindia',
  'sporjo',
  'stackbox',
  'starhealthdigital',
  'sukoon',
  'sumupindia',
  'supergaming',
  'suprdaily',
  'synup',
  'techjockey',
  'technovert',
  'telioev',
  'thirdeyedata',
  'trell',
  'trigyn',
  'tricog',
  'truecallerindia',
  'trukkerindia',
  'twimbit',
  'unbxd',
  'uniqus',
  'uolo',
  'urbanpiper',
  'vakilsearch',
  'verygoodsecurityindia',
  'vervotech',
  'wati',
  'wealthy',
]

const NON_GENERIC_PROVIDER_SOURCES = new Set([
  'smarterai',
  'snapmint',
  'socialpilot',
  'spheraindia',
  'sporjo',
  'stackbox',
  'starhealthdigital',
  'sukoon',
  'sumupindia',
  'supergaming',
  'suprdaily',
  'synup',
  'techjockey',
  'technovert',
  'telioev',
  'thirdeyedata',
  'trell',
  'tricog',
  'trigyn',
  'truecallerindia',
  'trukkerindia',
  'twimbit',
  'unbxd',
  'uniqus',
  'uolo',
  'urbanpiper',
  'vakilsearch',
  'verygoodsecurityindia',
  'vervotech',
  'wati',
  'wealthy',
])

const EXPECTED_VERIFIED_ON_BY_SOURCE = {
  supergaming: '2026-10-23',
  synup: '2026-10-23',
  trigyn: '2026-10-23',
  wati: '2026-10-23',
  verygoodsecurityindia: '2026-09-13',
  sukoon: '2026-08-04',
  suprdaily: '2026-08-04',
  urbanpiper: '2026-08-01',
}

const batchProviders = dedicatedProviders.filter((provider) => EXPECTED_PROVIDER_SOURCES.includes(provider.source))

test('workbook batch 05 retains specialized provenance and current runnable routes', async (t) => {
  installWorkbookOfflineGuard(t)
  assert.equal(batchProviders.length, EXPECTED_PROVIDER_SOURCES.length)
  assert.deepEqual(
    batchProviders.map((provider) => provider.source).sort((left, right) => left.localeCompare(right)),
    [...EXPECTED_PROVIDER_SOURCES].sort((left, right) => left.localeCompare(right)),
  )

  const catalog = getScraperCatalog()
  const scrapersByName = new Map(buildScrapers().map(scraper => [scraper.name, scraper]))
  for (const source of EXPECTED_PROVIDER_SOURCES) {
    const provider = catalog.find((item) => item.source === source)
    assert.ok(provider, `Expected ${source} in hydrated scraper catalog`)
    const historical = batchProviders.find(provider => provider.source === source)
    await assertCurrentWorkbookRoute(provider, scrapersByName.get(source))
    assert.equal(provider.adapter, 'script')
    assert.equal(historical.verifiedOn, EXPECTED_VERIFIED_ON_BY_SOURCE[source] || '2026-07-25')
    assert.equal(
      String(historical.originalModulePath || '').includes('failClosedSentinel'),
      !NON_GENERIC_PROVIDER_SOURCES.has(source),
    )
    assert.match(provider.modulePath, new RegExp(`${source}[\\\\/]script\\.js$`, 'i'))
  }
})

test('workbook batch 05 executes only remaining empty implementations with an offline guard', async (t) => {
  const forbidden = installWorkbookOfflineGuard(t)
  const catalog = getScraperCatalog()
  const scrapers = buildScrapers()
  for (const source of EXPECTED_PROVIDER_SOURCES) {
    const scraper = scrapers.find(item => item.name === source)
    const provider = catalog.find(item => item.source === source)
    const implementation = await assertCurrentWorkbookRoute(provider, scraper)
    if (['sentinel', 'static-empty'].includes(implementation)) {
      assert.deepEqual(await scraper.run({ fetchText: forbidden, fetchJson: forbidden, fetchPage: forbidden }), [], source)
    }
  }
})
