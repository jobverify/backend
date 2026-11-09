import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'
import { run } from '../../scraper/axissecurities/script.js'
import { AXIS_SECURITIES_CATALOG } from '../../scraper/axissecurities/catalog.js'

test('Axis Securities exact CSV row resolves to its first-party provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'axissecurities')
  const report = generateCompanyCoverageReport({
    csvText: 'Axis Securities\n',
    catalog: [provider],
    aliasMap: {},
  })

  assert.ok(provider)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.equal(report.matched[0].source, 'axissecurities')
  assert.equal(provider.companyName, 'Axis Securities')
  assert.equal(provider.companyCareerPage, 'https://simplehai.axisdirect.in/portal/careers')
})

test('Axis Securities rejects unavailable native inventory without certifying zero', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'axissecurities')
  const scraper = buildScrapers().find((item) => item.name === 'axissecurities')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(AXIS_SECURITIES_CATALOG.verifiedPublicJobCount,77)
  assert.equal(AXIS_SECURITIES_CATALOG.verifiedIndiaJobCount,null)
  assert.equal(AXIS_SECURITIES_CATALOG.atsPlatform,'ripplehire')
  await assert.rejects(run({ fetchImpl: async () => { throw Error('offline fixture') } }),/offline fixture/)
})
