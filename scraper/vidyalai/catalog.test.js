import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Vidyalai is registered as an official ERP jobs scraper', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'vidyalai')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Vidyalai')
  assert.equal(provider.companyCareerPage, 'https://erp.vidyalai.com/jobs')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.companyDomain, 'erp.vidyalai.com')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /vidyalai[\\/]script\.js$/i)
})

test('Vidyalai and Vidyalai.com resolve directly through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Vidyalai,\nVidyalai.com,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Vidyalai', 'vidyalai', 'Vidyalai'],
      ['Vidyalai.com', 'vidyalai', 'Vidyalai'],
    ],
  )
})

test('Vidyalai remains runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'vidyalai')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /vidyalai[\\/]jobs\.json$/i)
})
