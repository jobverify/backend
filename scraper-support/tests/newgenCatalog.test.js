import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'
import currentMetadata from '../../scraper/newgen/catalog.js'

test('Newgen own current catalog declares its qualified publication scope', () => {
  const provider = currentMetadata

  assert.ok(provider)
  assert.equal(provider.companyName, 'Newgen Software')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'current-own-declared-Omnirecruit-native-first-page')
  assert.equal(provider.companyCareerPage, 'https://newgensoft.com/company/careers/')
  assert.equal(provider.authoritativeCurrentPublication, true)
  assert.equal(provider.backfillMode, 'live-parser')
  assert.equal(provider.sourceScopeComplete, false)
  assert.equal(provider.lifecycleCleanupAllowed, false)
  assert.equal(provider.verifiedIndiaJobCount, null)
  assert.equal(provider.verifiedGlobalJobCount, null)
  assert.equal(provider.verifiedAt, null)
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.companyDomain, 'newgensoft.com')
  assert.match(provider.modulePath, /newgen[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Newgen Software to the newgen source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'newgen')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /newgen[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'newgen')

  const report = generateCompanyCoverageReport({
    csvText: 'Newgen Software,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Newgen Software', 'newgen', 'Newgen Software']],
  )
})
