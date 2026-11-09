import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { decorateJobsWithProviderMetadata, getScraperCatalog } from '../providers/index.js'
import { buildScraperAttemptDiagnostics } from '../runner.js'
import { buildPublishingGapReport } from '../../scripts/publishingGapReport.js'

const symbol = Symbol.for('jobverify.inventory-delegation-evidence')
const packets = JSON.parse(gunzipSync(fs.readFileSync(new URL('../../scraper/auth0/test-data/delegation-20261031.json.gz', import.meta.url)))).packets
const now = new Date('2026-10-31T08:20:00Z')
const catalog = getScraperCatalog().filter(p => ['auth0','okta'].includes(p.source))
const provider = catalog.find(p => p.source === 'auth0')
const proof = () => ({ source: 'auth0', verifiedAt: packets[1].capturedAt,
  sources: ['okta'], preservesChildSourceAndCompany: true,
  evidence: { method: 'official-careers-redirect', url: packets[0].url,
    responses: packets.map(p => ({ url: p.url, finalUrl: p.finalUrl, status: p.status, sha256: p.sha256 })) } })
const report = (evidence = proof(), changeAttempt = x => x, selectedCatalog = catalog) => buildPublishingGapReport({ catalog: selectedCatalog, now,
  runtime: { databaseAvailable: true, generatedAt: now.toISOString(), publicCompanyNames: ['Okta'],
    inventory: [{ source: 'auth0', savedJobs: 0, visibleJobs: 0, visibleCompanies: [] },
      { source: 'okta', savedJobs: 3, visibleJobs: 3, visibleCompanies: ['Okta'] }],
    statuses: [{ source: 'auth0', latestAttempt: changeAttempt({ completedAt: '2026-10-31T08:19:00Z', success: true,
      inventoryDelegationEvidence: evidence }) }] } })
const wrapper = value => value.rows.find(r => r.source === 'auth0')

test('registered decoration and runner diagnostics retain current relationship evidence with canonical child ownership', () => {
  const jobs = [{ source: 'okta', company: 'Okta', jobId: 'controlled-child' }]
  Object.defineProperty(jobs, symbol, { value: proof() })
  const decorated = decorateJobsWithProviderMetadata(jobs, provider)
  assert.deepEqual(decorated[symbol], proof())
  assert.equal(decorated[0].source, 'okta')
  assert.equal(decorated[0].company, 'Okta')
  assert.deepEqual(buildScraperAttemptDiagnostics(decorated, undefined, provider).inventoryDelegationEvidence, proof())
})

test('fresh completed-attempt relationship proof supersedes an expired catalog declaration without changing public attribution', () => {
  const result = report(), delegation = wrapper(result).inventoryDelegation
  assert.equal(delegation.evidenceFresh, true)
  assert.equal(delegation.fresh, true)
  assert.equal(delegation.evidenceOrigin, 'runtime-attempt')
  assert.equal(delegation.verifiedAt, packets[1].capturedAt)
  assert.deepEqual(delegation.publicChildSources, ['okta'])
  assert.equal(wrapper(result).visibleJobs, 0)
  assert.equal(result.rows.find(r => r.source === 'okta').visibleJobs, 3)
  assert.equal(result.summary.distinctVisibleCompanies, 1)
  assert.equal(wrapper(result).gapExplanation, 'delegated-inventory-published-under-other-sources')
  const backlog = result.backlog.find(row => row.source === 'auth0')
  assert.equal(backlog.reason, 'reconcile-delegated-source-coverage')
  assert.equal(backlog.priority, 3)
  assert.equal(backlog.discoveryRequired, false)
})

test('a current failed production attempt remains visible despite valid relationship proof', () => {
  const value = report(proof(), attempt => ({ ...attempt, success: false, failureKind: 'network_or_timeout' }))
  assert.equal(wrapper(value).gapExplanation, 'latest-persisted-check-failed')
})

for (const independentDeclaration of [false, true]) {
  for (const [label, changes] of [
    ['coverage gap', { success: false, softFailure: true, failureKind: 'coverage_gap' }],
    ['partial positive', { success: false, partial: true, failureKind: 'partial_positive' }],
  ]) test(`${label} cannot hide behind delegated publication with ${independentDeclaration ? 'fresh' : 'expired'} independent catalog evidence`, () => {
    const selectedCatalog = independentDeclaration ? catalog.map(row => row.source === 'auth0'
      ? { ...row, inventoryDelegation: { ...row.inventoryDelegation, verifiedAt: packets[1].capturedAt } } : row) : catalog
    const value = report(proof(), attempt => ({ ...attempt, ...changes }), selectedCatalog)
    const row = wrapper(value)
    assert.equal(row.gapExplanation, 'latest-persisted-check-incomplete')
    assert.equal(row.attemptSuccessful, false)
    const backlog = value.backlog.find(row => row.source === 'auth0')
    assert.notEqual(backlog.reason, 'reconcile-delegated-source-coverage')
    assert.notEqual(backlog.priority, 3)
    assert.equal(row.inventoryDelegation.evidenceOrigin, 'catalog-declaration')
    assert.equal(row.inventoryDelegation.fresh, independentDeclaration)
    assert.equal(value.rows.find(row => row.source === 'okta').visibleJobs, 3)
  })
}

test('future-dated completion cannot refresh expired catalog relationship evidence', () => {
  const value = report(proof(), attempt => ({ ...attempt, completedAt: '2099-01-01T00:00:00Z' }))
  const row = wrapper(value)
  assert.equal(row.attemptFresh, false)
  assert.equal(row.inventoryDelegation.evidenceOrigin, 'catalog-declaration')
  assert.equal(row.inventoryDelegation.fresh, false)
  assert.notEqual(row.gapExplanation, 'delegated-inventory-published-under-other-sources')
  assert.equal(value.rows.find(row => row.source === 'okta').visibleJobs, 3)
})

for (const [label, change] of [
  ['wrong parent source', p => { p.source = 'unrelated' }],
  ['undeclared child source', p => { p.sources = ['auth0'] }],
  ['duplicate child source', p => { p.sources = ['okta','okta'] }],
  ['unqualified child attribution', p => { p.preservesChildSourceAndCompany = false }],
  ['unqualified native status', p => { p.evidence.responses[0].status = 403 }],
  ['missing native response hash', p => { delete p.evidence.responses[0].sha256 }],
  ['unread declared evidence URL', p => { p.evidence.url = 'https://unread.invalid/' }],
  ['unrelated fully described native relationship', p => {
    p.evidence.url = 'https://unrelated.invalid/careers'
    p.evidence.responses[0].url = p.evidence.url
    p.evidence.responses[0].finalUrl = p.evidence.url
  }],
  ['non-HTTPS native response', p => { p.evidence.responses[0].finalUrl = 'http://auth0.com/careers' }],
  ['proof newer than its attempt', p => { p.verifiedAt = '2026-10-31T08:19:30Z' }],
  ['expired runtime proof', p => { p.verifiedAt = '2026-10-23T10:01:54.060Z' }],
]) test(`runtime delegation cannot refresh relationship from ${label}`, () => {
  const candidate = proof();change(candidate)
  assert.equal(wrapper(report(candidate)).inventoryDelegation.evidenceFresh, false)
  assert.equal(wrapper(report(candidate)).inventoryDelegation.fresh, false)
  assert.notEqual(wrapper(report(candidate)).gapExplanation, 'delegated-inventory-published-under-other-sources')
})

test('relationship evidence does not create a live public-inventory snapshot or company-empty proof', () => {
  const result = buildPublishingGapReport({ catalog, now, runtime: { databaseAvailable: false,
    statuses: [{ source: 'auth0', latestAttempt: { success: true, completedAt: '2026-10-31T08:19:00Z', inventoryDelegationEvidence: proof() } }] } })
  assert.equal(wrapper(result).inventoryDelegation.evidenceFresh, true)
  assert.equal(wrapper(result).inventoryDelegation.fresh, false)
  assert.equal(wrapper(result).completeSuccessfulCheck, false)
  assert.equal(wrapper(result).savedJobs, null)
})
