import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import nativeTest from 'node:test'

import {
  buildSearchResultsPageUrl,
  extractSearchPayload,
  run,
} from './script.js'
import {
  isFreshCompleteInventoryEvidence,
  readInventoryEvidence,
} from '../../scraper-support/utils/inventoryEvidence.js'

// All three private external fixtures are unshipped. No HTTP or fixture fallback.
// Only the first entry is a genuine response; the other two are controlled mutations.
const HOME = 'https://careers.opentext.com/us/en/search-results'
const fixtures = {
  actual: {
    url: '../../../artifacts/scraper-all-repair-2026-11-06/current-microfocus/first-page-public-probe-20261108/local-only-corrected/response.body',
    bytes: 86311,
    sha: 'b108ece10dcc0910151e7ac5f7f7acb6e135e5ac2f93948af9bdfe7a665886fd',
  },
  foreign: {
    url: '../../../artifacts/scraper-all-repair-2026-11-06/current-microfocus/alpha3-wrapper-test-proposal-20261108/local-only/explicit-foreign.body',
    bytes: 86295,
    sha: '66d4b91df36b86116c064539f98e5da99e42fb54f1e6824176ed48ea8b3262f4',
  },
  unknown: {
    url: '../../../artifacts/scraper-all-repair-2026-11-06/current-microfocus/alpha3-wrapper-test-proposal-20261108/local-only/unknown-country.body',
    bytes: 86295,
    sha: '2d71b5369e7d6e5f9643009413a7dd33c194dd69c9b2191328ba8028be6d53eb',
  },
}
const readFixture = name => {
  const fixture = fixtures[name]
  const body = readFileSync(new URL(fixture.url, import.meta.url))
  assert.equal(body.length, fixture.bytes, 'private fixture byte count')
  assert.equal(createHash('sha256').update(body).digest('hex'), fixture.sha, 'private fixture SHA-256')
  return body.toString('utf8')
}
const privateFixtureAvailability = Object.values(fixtures).map(fixture => (
  existsSync(new URL(fixture.url, import.meta.url))
))
const allPrivateFixturesAbsent = privateFixtureAvailability.every(present => !present)
assert.ok(
  allPrivateFixturesAbsent || privateFixtureAvailability.every(Boolean),
  'Partial private-fixture availability is an error; either all three are absent or all three must qualify',
)
// Validate every existing fixture before registering tests, including both controls.
const privateFixtureBodies = allPrivateFixturesAbsent ? null : Object.fromEntries(
  Object.keys(fixtures).map(name => [name, readFixture(name)]),
)
const test = (name, body) => nativeTest(name, {
  skip: allPrivateFixturesAbsent
    ? 'All three private external fixtures are unshipped and absent; no HTTP fallback'
    : false,
}, body)
const actualHTML = privateFixtureBodies?.actual ?? null
const actualPayload = () => extractSearchPayload(actualHTML)
const selectedRow = payload => {
  assert.equal(payload.jobs.length, 10)
  assert.equal(payload.totalHits, 368)
  assert.equal(payload.hits, 10)
  assert.equal(payload.aggregations.country.IND, 26)
  const rows = payload.jobs.filter(row => row.reqId === '51960')
  assert.equal(rows.length, 1)
  const [row] = rows
  assert.equal(row.jobId, '51960')
  assert.equal(row.jobSeqNo, 'OPJOPEUS51960EXTERNALENUS')
  assert.equal(row.title, 'Premium Support Engineer- Fortify')
  assert.equal(row.city, 'Bangalore')
  assert.equal(row.cityState, 'Bangalore, Karnataka')
  return row
}

// This is the sole public-wrapper request callback. Any second request or URL fails.
const withOnlyConfiguredGET = async (html, inspect) => {
  const calls = []
  const fetchText = async url => {
    calls.push(url)
    assert.deepEqual(calls, [HOME], 'only the exact configured first page may be read')
    return html
  }
  assert.equal(buildSearchResultsPageUrl(), HOME)
  try {
    await inspect(() => run({
      fetchText,
      useWidgetApi: false,
      maxPages: 1,
      detailEnrichmentBudgetMs: 0,
    }))
  } finally {
    assert.deepEqual(calls, [HOME], 'exactly one configured GET was requested')
  }
}

test('Micro Focus public wrapper retains actual IND row as India discovery with explicit native mapping', async () => {
  const raw = selectedRow(actualPayload())
  assert.equal(raw.country, 'IND')
  assert.equal(actualPayload().jobs.filter(row => row.country === 'IND').length, 1)
  await withOnlyConfiguredGET(actualHTML, async invoke => {
    const jobs = await invoke()
    assert.equal(jobs.length, 1, 'only the literal IND first-page row is a target discovery')
    const [job] = jobs
    assert.equal(job.source, 'microfocus')
    assert.equal(job.company, 'Micro Focus')
    assert.equal(job.jobId, raw.jobId)
    assert.equal(job.requisitionId, raw.reqId)
    assert.equal(job.title, raw.title)
    assert.equal(job.city, raw.city)
    assert.equal(job.country, 'India')
    assert.deepEqual(job.sourceNativeCountryEvidence, {
      listingCountry: 'IND',
      nativeCountryCodeMappings: [{ code: 'IND', region: 'IN' }],
    })
    assert.equal(job.sourceListingComplete, false)
    assert.equal(job.sourceDetailComplete, false)
    assert.equal(job.sourceDetailFailureKind, 'budget-exhausted')
    assert.equal(job.jobDescription, null, 'no full criteria were qualified')
    const evidence = readInventoryEvidence(jobs)
    assert.equal(evidence.status, 'discovery-only')
    assert.equal(evidence.surface, HOME)
    assert.equal(evidence.listingComplete, false)
    assert.equal(evidence.pagesFetched, 1)
    assert.equal(evidence.reportedTotal, 368, 'native advertised total is not a reconciled company inventory')
    assert.equal(evidence.indiaFacetCount, 26, 'native IND facet count is retained as an advertisement')
    assert.equal(isFreshCompleteInventoryEvidence(evidence), false)
  })
})

const assertCountryControl = (html, code) => {
  const original = selectedRow(actualPayload())
  const changedPayload = extractSearchPayload(html)
  const changed = selectedRow(changedPayload)
  assert.equal(changed.country, code)
  assert.equal(changed.cityStateCountry, 'Bangalore, Karnataka, ' + code)
  assert.equal(changed.location, 'Bangalore, Karnataka, ' + code + ', 560093')
  assert.deepEqual(changed.multi_location, ['Bangalore, Karnataka, ' + code + ', 560093'])
  assert.equal(changed.multi_location_array.length, 1)
  assert.equal(changed.multi_location_array[0].location, 'Bangalore, Karnataka, ' + code + ', 560093')
  assert.deepEqual(changed.multi_location_array[0].latlong, original.multi_location_array[0].latlong)
  const expected = structuredClone(original)
  expected.country = code
  expected.cityStateCountry = changed.cityStateCountry
  expected.location = changed.location
  expected.multi_location = structuredClone(changed.multi_location)
  expected.multi_location_array[0].location = changed.multi_location_array[0].location
  assert.deepEqual(changed, expected, 'only the five explicit country carriers changed in this role')
  const restoredPayload = structuredClone(changedPayload)
  restoredPayload.jobs[restoredPayload.jobs.findIndex(row => row.reqId === '51960')] = structuredClone(original)
  assert.deepEqual(restoredPayload, actualPayload(), 'all parsed native fields other than selected country carriers are unchanged')
}
const rejectNoTarget = async html => withOnlyConfiguredGET(html, async invoke => {
  await assert.rejects(invoke, error => {
    assert.equal(error.code, 'PHENOM_INCOMPLETE_SNAPSHOT')
    assert.equal(error.message, 'PHENOM_INCOMPLETE_SNAPSHOT: no verified target jobs before listing completion')
    return true
  })
})

test('Micro Focus keeps actual Bangalore city but rejects controlled explicit foreign country', async () => {
  const html = readFixture('foreign')
  assertCountryControl(html, 'USA')
  await rejectNoTarget(html)
})

test('Micro Focus keeps actual Bangalore city but rejects controlled unknown country', async () => {
  const html = readFixture('unknown')
  assertCountryControl(html, 'XZZ')
  await rejectNoTarget(html)
})
