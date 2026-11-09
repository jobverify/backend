import assert from 'node:assert/strict'
import test from 'node:test'

import dedicatedProviders from '../scraper-support/providers/providerExtensions/zz-dedicated-scraper-folder-backfill.json' with { type: 'json' }
import {
  buildCanonicalWorkbookInventory,
  loadWorkbookBatchAliases,
  loadWorkbookBatchProviders,
} from '../scripts/lib/workbookMigrationInventory.js'

test('buildCanonicalWorkbookInventory merges all workbook sources without duplication', () => {
  const workbookProviders = loadWorkbookBatchProviders()
  const workbookAliases = loadWorkbookBatchAliases()
  const result = buildCanonicalWorkbookInventory({ workbookProviders, dedicatedProviders })

  assert.equal(result.stats.uniqueWorkbookSourceCount, workbookProviders.length)
  assert.equal(
    result.stats.overlapWithDedicatedCount + result.stats.batchOnlyCount,
    result.stats.uniqueWorkbookSourceCount,
  )
  assert.equal(result.dedicatedOnlyProviders.length, 6)
  assert.deepEqual(result.conflicts, [])
  assert.equal(
    result.canonicalProviders.length,
    result.stats.uniqueWorkbookSourceCount + result.dedicatedOnlyProviders.length,
  )
  assert.equal(workbookAliases.Cibil, 'transunioncibil')
  assert.equal(workbookAliases['Amazon Development Center'], 'amazon')
})
