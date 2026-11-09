import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { getScraperCatalog } from '../providers/index.js'

test('Shiksha.com should resolve to the existing infoedge provider via a central alias', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'infoedge')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'InfoEdge')
  assert.equal(provider.companyCareerPage, 'https://careers.infoedge.com/infoedge/jobslist')
  assert.equal(provider.careersLandingUrl, 'https://careers.infoedge.com/infoedge/')
  assert.equal(provider.companyDomain, 'careers.infoedge.com')
  assert.equal(companyAliases['Shiksha.com'], 'infoedge')

  const report = generateCompanyCoverageReport({
    csvText: 'Shiksha.com\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Shiksha.com', 'infoedge', 'InfoEdge']],
  )
})
