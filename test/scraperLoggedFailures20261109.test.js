import assert from 'node:assert/strict'
import test from 'node:test'
import { classifyScraperError } from '../scraper-support/utils/failureClassification.js'
import { withRetry, getRetryMetadata } from '../scraper-support/utils/retry.js'
import { applyRetryPolicyToScraperError, resolveScraperTimeoutMs } from '../scraper-support/runner.js'
import { getScraperCatalog, createCatalogScraper } from '../scraper-support/providers/index.js'

for (const source of ['Avasoft', 'Da Vinci', 'Finzly']) {
  test(`${source} HTTP 202 is an unavailable response with no immediate retry`, () => {
    const error = applyRetryPolicyToScraperError(new Error(`${source} native public HTTP 202`))
    assert.equal(error.softFailure, true)
    assert.equal(error.upstreamOutage, true)
    assert.equal(error.failureKind, 'upstream_response_pending')
    assert.equal(error.abortRetries, true)
  })
}

test('a public read/body deadline is a network failure while runner timeouts stay hard', () => {
  assert.equal(classifyScraperError(new Error('Anand native: read/body deadline exceeded')).failureKind, 'network_or_timeout')
  const local = Object.assign(new Error('source deadline exceeded'), { localTimeout: true })
  assert.equal(classifyScraperError(local).softFailure, false)
  assert.equal(classifyScraperError(local).failureKind, 'runner_timeout')
})

test('missing local runtime assets fail after one attempt and keep their original cause', async () => {
  let attempts = 0
  const missing = Object.assign(new Error('Missing provider JSON'), { code: 'ENOENT' })
  await assert.rejects(withRetry(() => { attempts++; throw missing }, { attempts: 4, baseDelayMs: 0 }), error => {
    assert.equal(error.code, 'ENOENT')
    assert.equal(error.cause, missing)
    assert.equal(error.abortRetries, true)
    assert.equal(getRetryMetadata(error).attemptsUsed, 1)
    return true
  })
  assert.equal(attempts, 1)
})

for (const source of ['mindrift', 'teconnectivity', 'wasteconnections']) {
  test(`${source} missing local assets cannot be mislabeled by words in its source name`, () => {
    const cause = Object.assign(new Error('Required provider manifest is absent'), { code: 'ENOENT' })
    const error = new Error(`[${source}] failed to import provider manifest`, { cause })
    assert.deepEqual(classifyScraperError(error), {
      softFailure: false, upstreamOutage: false, failureKind: 'configuration_error',
    })
    assert.equal(applyRetryPolicyToScraperError(error).abortRetries, true)
  })
}

test('explicit parser contract failures are not repeated or converted into outages', () => {
  const error = Object.assign(new Error('expected one role-owned matching structured record'), {
    failureKind: 'parser_or_contract_error',
  })
  assert.equal(applyRetryPolicyToScraperError(error).abortRetries, true)
  assert.equal(classifyScraperError(error).softFailure, false)
})

test('Affirm runner budget allows its bounded native opening/closing collection to finish', () => {
  const provider = getScraperCatalog().find(row => row.source === 'affirm')
  const scraper = createCatalogScraper(provider)
  assert.equal(resolveScraperTimeoutMs('', scraper), 930000)
  assert.equal(resolveScraperTimeoutMs('2000', scraper), 2000)
})
