import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Mitsogo as an official Greenhouse provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'mitsogo')

  assert.ok(provider)
  assert.equal(provider.adapter, 'apiPortal')
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.equal(provider.companyName, 'Mitsogo Inc')
  assert.equal(provider.companyCareerPage, 'https://www.mitsogo.com/careers/')
  assert.equal(provider.companyDomain, 'mitsogo.com')
  assert.match(
    provider.config.discovery.listingApiUrl,
    /boards-api\.greenhouse\.io\/v1\/boards\/mitsogoinc\/jobs/i,
  )
  assert.equal(provider.config.request.method, 'GET')
  assert.equal(provider.config.request.query.content, 'true')
  assert.equal(provider.config.pagination.strategy, 'single-page')
})

test('buildScrapers exposes a runnable Mitsogo apiPortal scraper and company coverage resolves the CSV row', () => {
  const scraper = buildScrapers().find((item) => item.name === 'mitsogo')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /mitsogo[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'mitsogo')
  assert.equal(scraper.provider.atsPlatform, 'greenhouse')

  const report = generateCompanyCoverageReport({
    csvText: 'Mitsogo,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Mitsogo', 'mitsogo', 'Mitsogo Inc']],
  )
})
