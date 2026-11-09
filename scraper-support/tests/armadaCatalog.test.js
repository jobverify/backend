import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Armada as an official Greenhouse apiPortal provider', () => {
  const catalog = getScraperCatalog()
  const armada = catalog.find((provider) => provider.source === 'armada')

  assert.ok(armada)
  assert.equal(armada.adapter, 'apiPortal')
  assert.equal(armada.atsPlatform, 'greenhouse')
  assert.equal(armada.companyCareerPage, 'https://www.armada.ai/careers')
  assert.equal(armada.companyDomain, 'armada.ai')
  assert.match(armada.config.discovery.listingApiUrl, /boards-api\.greenhouse\.io\/v1\/boards\/armada\/jobs/i)
})

test('buildScrapers and company coverage resolve Armada to the armada source', () => {
  const armada = buildScrapers().find((scraper) => scraper.name === 'armada')

  assert.ok(armada)
  assert.equal(typeof armada.run, 'function')
  assert.match(armada.dryRunFile, /armada[\\/]jobs\.json$/)
  assert.equal(armada.provider.source, 'armada')
  assert.equal(armada.provider.atsPlatform, 'greenhouse')

  const report = generateCompanyCoverageReport({
    csvText: 'Armada,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Armada', 'armada', 'Armada']],
  )
})
