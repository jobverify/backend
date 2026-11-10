import assert from 'node:assert/strict'
import test from 'node:test'
import { finishScraperProcessing, scraperTaskOutcome, inventoryCleanupOptions } from '../scraper-support/utils/scraperOutcome.js'
import { classifyScraperError } from '../scraper-support/utils/failureClassification.js'
import { createVerifiedFirstPartyAtsScraper } from '../scraper-support/shared/verifiedFirstPartyAts.js'

test('unavailable zero results retain the inventory reason through processing completion', () => {
  const result = finishScraperProcessing({ success: true, jobs: 0, zeroJobEvidence: 'coverage-gap',
    inventoryEvidence: { reason: 'Native worksite countries are unresolved', listingComplete: false } })
  assert.match(result.error, /Native worksite countries are unresolved/)
  assert.equal(scraperTaskOutcome(result), 'softFailed')
  assert.deepEqual(inventoryCleanupOptions(result), { replaceExisting: false })
  assert.equal(result.processingComplete, true)
})

test('unverified zero results have an actionable fallback without replacing existing errors', () => {
  for (const outcome of ['blocked-zero', 'coverage-gap', 'unverified-zero']) {
    assert.ok(finishScraperProcessing({ success: true, zeroJobEvidence: outcome }).error?.length > 0)
    assert.equal(finishScraperProcessing({ success: true, zeroJobEvidence: outcome, error: 'Original source reason' }).error, 'Original source reason')
  }
})

test('a Lyra public request deadline is an upstream timeout while a runner deadline stays hard', () => {
  assert.equal(classifyScraperError(Object.assign(new Error('Lyra request deadline'), { code: 'LYRA_NATIVE_REQUEST_DEADLINE' })).failureKind, 'network_or_timeout')
  assert.equal(classifyScraperError(Object.assign(new Error('Lyra request deadline'), { localTimeout: true })).failureKind, 'runner_timeout')
  assert.equal(classifyScraperError(Object.assign(new Error('Lyra request deadline'), { failureKind: 'parser_or_contract_error' })).failureKind, 'parser_or_contract_error')
})

test('invalid local request deadlines cannot be mislabeled as an upstream outage', () => {
  assert.throws(() => createVerifiedFirstPartyAtsScraper({ source: 'fixture', companyName: 'Fixture',
    platform: 'ashby', board: 'fixture', careersUrl: 'https://example.test/careers', requestTimeoutMs: 0 }), error => {
    assert.equal(classifyScraperError(error).softFailure, false)
    return true
  })
  assert.equal(classifyScraperError(new Error('Invalid Air India request deadline')).softFailure, false)
})
