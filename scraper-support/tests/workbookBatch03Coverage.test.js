import assert from 'node:assert/strict'
import test from 'node:test'

import dedicatedProviders from '../providers/providerExtensions/zz-dedicated-scraper-folder-backfill.json' with { type: 'json' }
import workbookAliases from '../providers/companyAliasExtensions/zz-workbook-dedicated.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { getScraperCatalog } from '../providers/index.js'

const manifest = {
  batch: '03',
  companies: dedicatedProviders
    .filter((provider) => String(provider.originalModulePath || '').startsWith('../workbookbatch03/'))
    .map((provider) => provider.companyName),
}
const providersBySource = new Map(dedicatedProviders.map((provider) => [provider.source, provider]))

test('Workbook batch 03 providers preserve complete exact-name manifest coverage', () => {
  const report = generateCompanyCoverageReport({
    csvText: ['company_name', ...manifest.companies].join('\n'),
    catalog: getScraperCatalog(),
  })

  assert.equal(manifest.batch, '03')
  assert.equal(manifest.companies.length, 34)
  assert.deepEqual(
    {
      Plum: workbookAliases.Plum,
      'Saarthi AI': workbookAliases['Saarthi AI'],
      Sattva: workbookAliases.Sattva,
    },
    {
      Plum: 'plumhq',
      'Saarthi AI': 'saarthi',
      Sattva: 'sattvamedia',
    },
  )
  assert.equal(report.matchedCount, manifest.companies.length)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(report.unmatched, [])
  assert.deepEqual(report.matched.map(({ companyName }) => companyName), manifest.companies)
  assert.ok(report.matched.every(({ source }) => providersBySource.has(source)))
})
