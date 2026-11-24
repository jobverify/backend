import test from 'node:test'
import assert from 'node:assert/strict'
import * as source from './script.js'
import metadata from './catalog.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

test('normal source factory selects current publication and zero cap performs no acquisition', async () => {
  assert.equal(typeof source.createMacquarieScraper, 'function')
  const jobs = await source.createMacquarieScraper().run({ maxJobs: 0, fetchImpl: () => { throw Error('Unexpected native fetch') } })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).firstParty, false)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
})

test('normal factory rejects a legacy text callback before invoking it', async () => {
  assert.equal(typeof source.createMacquarieScraper, 'function')
  let callbacks = 0
  await assert.rejects(source.createMacquarieScraper().run({ maxJobs: 0, fetchText: () => { callbacks++; return '' } }), /original native Responses required/)
  assert.equal(callbacks, 0)
})

test('current metadata selects own native publication while company counts and cleanup remain held', () => {
  assert.equal(metadata.source, 'macquariegroup')
  assert.equal(metadata.authoritativeCurrentPublication, true)
  assert.equal(metadata.companyCareerPage, 'https://www.macquarie.com/in/en/careers.html')
  assert.equal(metadata.backfillMode, 'live-parser')
  assert.equal(metadata.verifiedOn, null)
  assert.equal(metadata.verifiedPublicJobCount, null)
  assert.equal(metadata.verifiedIndiaJobCount, null)
  assert.equal(metadata.sourceScopeComplete, false)
  assert.equal(metadata.lifecycleCleanupAllowed, false)
})
