import assert from 'node:assert/strict'
import test from 'node:test'
import { createWorkablePublicApiScraper } from '../utils/workablePublicApi.js'
import { withRetry, getRetryMetadata } from '../utils/retry.js'
import { classifyScraperError } from '../utils/failureClassification.js'
import { isVerifiedEmptyEvidence, readInventoryEvidence } from '../utils/inventoryEvidence.js'

const scraper = createWorkablePublicApiScraper({ source: 'local-workable-contract', company: 'Example',
  tenant: 'example', accountUid: 'local-account', boardIdentityVerified: true })
const url = 'https://apply.workable.com/api/v3/accounts/example/jobs'
const location = { city: 'New York', region: 'New York', country: 'United States', countryCode: 'US' }
const record = { id: 1001, shortcode: 'NATIVE1001', title: 'Engineer', accountUid: 'local-account',
  state: 'published', isInternal: false, approvalStatus: 'approved', published: '2026-10-01T00:00:00Z',
  location, locations: [location] }

test('a Workable total changed between pages can recover through a fresh inventory attempt', async () => {
  let attempts = 0, requests = 0
  const jobs = await withRetry(() => {
    const attempt = ++attempts
    let page = 0
    return scraper.run({ fetchJson: async () => {
      requests++
      if (attempt === 1) return ++page === 1
        ? { total: 2, results: [record], nextPage: 'next-page' }
        : { total: 1, results: [] }
      return { total: 1, results: [record] }
    } })
  }, { attempts: 2, baseDelayMs: 0 })
  assert.equal(attempts, 2)
  assert.equal(requests, 3)
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 1)
})

test('Workable listing/detail edits can recover without accepting the inconsistent first attempt', async () => {
  let attempts = 0
  const india = { city: 'Bengaluru', region: 'Karnataka', country: 'India', countryCode: 'IN' }
  const jobs = await withRetry(() => {
    const attempt = ++attempts
    const listing = { ...record, title: attempt === 1 ? 'Engineer' : 'Senior Engineer',
      location: india, locations: [india] }
    return scraper.run({ fetchJson: async (_url, options) => options.method === 'POST'
      ? { total: 1, results: [listing] }
      : { ...listing, title: 'Senior Engineer', description: '<p>Build reliable employer products.</p>',
        requirements: '<p>Software engineering experience.</p>', benefits: '<p>Learning support.</p>' } })
  }, { attempts: 2, baseDelayMs: 0 })
  assert.equal(attempts, 2)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Senior Engineer')
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})

test('a contradictory Workable cursor stays failed without replaying the whole inventory four times', async () => {
  let requests = 0
  await assert.rejects(withRetry(() => scraper.run({ fetchJson: async () => {
    requests++
    return { total: 0, results: [], nextPage: 'contradictory-continuation' }
  } }), { attempts: 4, baseDelayMs: 0 }), error => {
    assert.match(error.message, /cursor contradicts the authoritative record count/)
    assert.equal(classifyScraperError(error).failureKind, 'parser_or_contract_error')
    assert.equal(getRetryMetadata(error).attemptsUsed, 1)
    return true
  })
  assert.equal(requests, 1)
})

test('a forbidden Workable response keeps its HTTP status and stops retrying before JSON extraction', async t => {
  let requests = 0
  const response = new Response('Access denied', { status: 403 })
  Object.defineProperty(response, 'url', { value: url })
  t.mock.method(globalThis, 'fetch', async () => { requests++; return response })
  await assert.rejects(withRetry(() => scraper.run(), { attempts: 4, baseDelayMs: 0 }), error => {
    assert.equal(classifyScraperError(error).failureKind, 'blocked_or_access_denied')
    assert.equal(error.cause.status, 403)
    assert.equal(getRetryMetadata(error).attemptsUsed, 1)
    return true
  })
  assert.equal(requests, 1)
  assert.equal(response.bodyUsed, true)
})

test('a transient Workable HTTP outage can still recover on the existing retry path', async t => {
  let requests = 0
  t.mock.method(globalThis, 'fetch', async () => {
    const response = ++requests === 1 ? new Response('Unavailable', { status: 503 })
      : Response.json({ total: 0, results: [] })
    Object.defineProperty(response, 'url', { value: url })
    return response
  })
  const jobs = await withRetry(() => scraper.run(), { attempts: 2, baseDelayMs: 0 })
  assert.equal(requests, 2)
  assert.equal(isVerifiedEmptyEvidence(readInventoryEvidence(jobs)), true)
})
