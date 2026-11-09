import assert from 'node:assert/strict'
import test from 'node:test'
import { pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { getScraperCatalog } from '../providers/index.js'

test('Mentor Graphics should resolve to the existing Siemens provider via alias mapping, not a duplicate provider', () => {
  const siemens = getScraperCatalog().find((item) => item.source === 'siemens')
  const exactNameProvider = getScraperCatalog().find((item) => item.source === 'mentorgraphics')

  assert.ok(siemens)
  assert.equal(siemens.adapter, 'script')
  assert.equal(siemens.atsPlatform, 'avature')
  assert.match(siemens.companyCareerPage, /jobs\.siemens\.com/i)
  assert.equal(exactNameProvider, undefined)

  const report = generateCompanyCoverageReport({
    csvText: 'Mentor Graphics\n',
    catalog: getScraperCatalog(),
    aliasMap: {
      'Mentor Graphics': 'siemens',
    },
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Mentor Graphics', 'siemens', 'Siemens']],
  )
})

test('Mentor Graphics should not introduce a second local runner when Siemens is already runnable', async () => {
  const siemens = getScraperCatalog().find((item) => item.source === 'siemens')
  const module = await import(pathToFileURL(siemens.modulePath).href)

  assert.ok(siemens)
  assert.match(siemens.modulePath, /siemens[\\/]script\.js$/i)
  assert.equal(typeof module.run, 'function')
})
