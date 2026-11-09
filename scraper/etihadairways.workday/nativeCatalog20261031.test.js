import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'
import local from './catalog.js'
import { getScraperCatalog } from '../../scraper-support/providers/index.js'
import { isWorkdayBackedProvider } from '../../scraper-support/providers/sourcePaths.js'

test('local and effective Etihad metadata select the real SmartRecruiters native route without static counts', () => {
  const selected = getScraperCatalog().find(row => row.source === 'etihadairways')
  for (const row of [local, selected]) {
    assert.equal(row.atsPlatform, 'smartrecruiters')
    assert.equal(row.backfillMode, 'native-board-observation')
    assert.equal(row.zeroResultPolicy, 'evidence-required')
    assert.equal(row.verifiedOn, null)
    assert.equal(row.verifiedPublicJobCount, null)
    assert.equal(row.verifiedIndiaJobCount, null)
    assert.equal(row.sourceScopeComplete, false)
    assert.equal(isWorkdayBackedProvider(row), false)
    assert.equal(path.resolve(row.modulePath), path.resolve('scraper/etihadairways.workday/script.js'))
  }
})
