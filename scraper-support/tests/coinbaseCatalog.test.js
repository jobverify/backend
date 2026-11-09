import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  createCatalogScraper,
  getScraperCatalog,
} from '../providers/index.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { readSourceObservationEvidence } from '../utils/sourceObservationEvidence.js'

test('getScraperCatalog includes Coinbase native recovery without declaring complete company scope', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'coinbase')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Coinbase')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'greenhouse-native-public-api')
  assert.equal(provider.companyCareerPage, 'https://www.coinbase.com/careers/positions')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'native-complete-envelope-count-reconciliation')
  assert.equal(
    provider.extractionStrategy,
    'documented-first-party-native-handoff+native-employer-and-role-identity+explicit-primary-india-label+full-native-content-and-original-publication',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'coinbase.com')
  assert.equal(provider.zeroResultPolicy, 'evidence-required')
  assert.equal(provider.sourceScopeComplete, false)
  assert.match(provider.modulePath, /coinbase[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Coinbase rows', () => {
  const scraper = buildScrapers().find((item) => item.name === 'coinbase')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /coinbase[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'coinbase')

  const report = generateCompanyCoverageReport({
    csvText: 'Coinbase,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Coinbase', 'coinbase', 'Coinbase']],
  )
})

test('registered Coinbase execution retains native observation evidence without authorizing company cleanup', async () => {
  const provider = getScraperCatalog().find(item => item.source === 'coinbase')
  const body = await readFile(new URL('../../scraper/coinbase/native-captures/greenhouse-coinbase-jobs-20261101.json', import.meta.url), 'utf8')
  const jobs = await createCatalogScraper(provider).run({
    fetchJson: async url => {
      assert.equal(url, 'https://boards-api.greenhouse.io/v1/boards/coinbase/jobs?content=true')
      return JSON.parse(body)
    },
    fetchText: async () => { throw new Error('legacy employer transport must not run') },
    fetchPage: async () => { throw new Error('legacy employer transport must not run') },
  })
  assert.equal(jobs.length, 18)
  assert.equal(readSourceObservationEvidence(jobs, 'coinbase').observedRecordCount, 254)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).status, 'discovery-only')
  assert.ok(jobs.every(job => job.sourceScopeComplete === false && job.sourceListingComplete === false && job.lifecycleCleanupAllowed === false))
})
