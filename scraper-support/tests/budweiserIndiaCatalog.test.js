import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport, normalizeCompanyName } from '../providers/companyCoverage.js'
import { getScraperCatalog } from '../providers/index.js'

test('Budweiser India resolves to the already-verified AB InBev GCC India public LinkedIn source', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'abinbevgccindia')

  assert.ok(provider)
  assert.equal(provider.companyCareerPage, 'https://www.ab-inbev.com/')
  assert.equal(companyAliases['Budweiser India'], 'abinbevgccindia')
  assert.equal(normalizeCompanyName('Budweiser India'), 'budweiser')
})

test('Budweiser India matches company coverage through the explicit alias onto AB InBev GCC India', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Budweiser India,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Budweiser India', 'abinbevgccindia', 'ABInBev GCC India']],
  )
})
