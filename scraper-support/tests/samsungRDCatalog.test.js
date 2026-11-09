import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { getScraperCatalog } from '../providers/index.js'

const PLANNED_ALIAS_MAP = {
  ...companyAliases,
  'Samsung R&D': 'samsungresearch',
}

test('Samsung R&D should resolve to the existing samsungresearch Workday provider via a central alias', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'samsungresearch')

  assert.ok(provider)
  assert.equal(provider.adapter, 'workday')
  assert.equal(provider.companyName, 'Samsung Research')
  assert.equal(provider.companyCareerPage, 'https://research.samsung.com/careers')
  assert.match(provider.baseUrl, /sec\.wd3\.myworkdayjobs\.com\/en-US\/Samsung_Careers/i)
  assert.equal(companyAliases['Samsung R&D'], 'samsungresearch')

  const report = generateCompanyCoverageReport({
    csvText: 'Samsung R&D\n',
    catalog: getScraperCatalog(),
    aliasMap: PLANNED_ALIAS_MAP,
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Samsung R&D', 'samsungresearch', 'Samsung Research']],
  )
})
