import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'

import * as gojek from './script.js'
import { createCatalogScraper, getScraperCatalog } from '../../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

// Every positive case uses this complete, untouched original HTTP response.
// Mutations below are negative parser/uncertainty probes, never native proof.
const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/retained-http-20261029.json.gz', import.meta.url))))
const bytes = Buffer.from(fixture.bodyBase64, 'base64')
const html = bytes.toString('utf8')
const sha = value => createHash('sha256').update(value).digest('hex')
assert.equal(sha(bytes), 'da30b9ef393686c7541c49e7fe3ee3f3c7c6b9df0f31f1bd7ae468680f32ccd3')
assert.equal(sha(bytes), fixture.receipt.sha256)
globalThis.fetch = async () => { throw Error('Network disabled for Gojek offline tests') }

const replay = async (body = html, runner = gojek.createGojekScraper().run) => {
  const audits = []
  const jobs = await runner({
    fetchPage: async url => {
      assert.equal(url, 'https://www.gojek.io/careers')
      return { status: fixture.receipt.httpStatus, text: body }
    },
    onAudit: audit => audits.push(audit),
  })
  return { jobs, audit: audits.at(-1) }
}

const mutateStream = edit => html.replace(/self\.__next_f\.push\(([\s\S]*?)\);?<\/script>/, (_all, literal) => {
  const frame = JSON.parse(literal)
  frame[1] = edit(frame[1])
  return `self.__next_f.push(${JSON.stringify(frame)})</script>`
})

test('actual HTTP200 models survive as nine observations without creating complete or India-empty proof', async () => {
  const { jobs, audit } = await replay()
  assert.equal(jobs.length, 0)
  assert.equal(audit.originalCareersHTML, html)
  assert.equal(audit.observations.length, 9)
  assert.deepEqual(audit.observations.map(row => row.nativeId), fixture.independentExpected.models.map(row => row.id))
  assert.deepEqual(audit.observations.map(row => row.declaredCountry), ['ID', 'SG', 'SG', 'SG', 'SG', 'SG', 'SG', 'ID', 'ID'])
  for (const row of audit.observations) {
    assert.equal(row.country, null)
    assert.equal(row.legalHiringEmployer, null)
    assert.equal(row.sourceIdentityVerified, false)
    assert.equal(row.sourceVisibilityVerified, false)
    assert.equal(row.sourceDetailComplete, false)
    assert.equal(row.postingDate, null)
    assert.equal(row.sourceNativeCreatedAt, row.rawNativeRecord.createdAt)
    assert.equal(row.sourceScopeComplete, false)
    assert.equal(row.lifecycleCleanupAllowed, false)
  }
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'discovery-only')
  assert.equal(evidence.firstParty, false)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
  assert.equal(audit.authoritativeSourceTotal, null)
  assert.equal(audit.authoritativeIndiaFacetCount, null)
  assert.equal(audit.currentLiveQualification, false)
})

test('all original HTML/plain criteria, lists and native alternatives remain exact after reference resolution', async () => {
  const { audit } = await replay()
  for (const [index, expected] of fixture.independentExpected.models.entries()) {
    const observed = audit.observations[index]
    assert.deepEqual(observed.resolvedNativeRecord.categories, expected.categories)
    assert.equal(observed.resolvedNativeRecord.applyUrl, expected.applyUrl)
    assert.equal(observed.resolvedNativeRecord.hostedUrl, expected.hostedUrl)
    assert.deepEqual(observed.referenceIssues, [])
    for (const field of expected.criteriaFields) {
      assert.equal(typeof observed.resolvedNativeRecord[field.field], 'string')
      assert.equal(sha(observed.resolvedNativeRecord[field.field]), field.sha256, expected.id + ':' + field.field)
    }
    assert.equal(observed.resolvedNativeRecord.lists.length, expected.lists.length)
    for (const [position, list] of expected.lists.entries()) {
      assert.equal(observed.resolvedNativeRecord.lists[position].text, list.label)
      assert.equal(sha(observed.resolvedNativeRecord.lists[position].content), list.contentSha256)
    }
  }
  assert.equal(audit.observations[0].rawNativeRecord.description, '$2d')
  assert.ok(audit.declaredRoleAnchors.some(anchor => anchor.href.endsWith('/7dd45945-1b16-4cd5-b031-d128431a804a')))
})

test('ambiguous opaque control frames are retained without overwriting or dropping the nine role observations', async () => {
  const { audit } = await replay()
  assert.equal(audit.literalFrameOccurrences.length, 102)
  assert.deepEqual([...audit.ambiguousFrameIds].sort(), ['10', '16', '17', '18', 'e', 'f'])
  assert.ok(audit.literalFrameOccurrences.filter(frame => frame.id === '18').length > 1)
  assert.equal(audit.observations.length, 9)
  assert.ok(audit.observations.every(row => row.referenceIssues.length === 0))
})

test('a missing criteria reference remains raw and unresolved instead of disappearing', async () => {
  const body = mutateStream(stream => stream.replace('"description":"$2d"', '"description":"$dead"'))
  assert.notEqual(body, html)
  const { audit, jobs } = await replay(body)
  assert.equal(audit.observations[0].rawNativeRecord.description, '$dead')
  assert.equal(audit.observations[0].resolvedNativeRecord.description, '$dead')
  assert.ok(audit.observations[0].referenceIssues.some(issue => issue.code === 'missing-frame'))
  assert.equal(audit.observations.length, 9)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('conflicting criteria targets are preserved as ambiguity instead of selecting the last value', async () => {
  const body = mutateStream(stream => stream + '2d:T4,oops')
  const { audit } = await replay(body)
  assert.equal(audit.observations[0].resolvedNativeRecord.description, '$2d')
  assert.ok(audit.observations[0].referenceIssues.some(issue => issue.code === 'ambiguous-frame'))
  assert.equal(audit.observations[0].sourceDetailComplete, false)
  assert.equal(audit.literalFrameOccurrences.filter(frame => frame.id === '2d').length, 2)
})

test('cyclic and unreviewed control references cannot become resolved criteria', async () => {
  for (const [reference, suffix, code] of [['$dead', 'dead:"$dead"\n', 'cyclic-reference'], ['$L2d', '', 'unreviewed-control-token']]) {
    const body = mutateStream(stream => stream.replace('"description":"$2d"', `"description":"${reference}"`) + suffix)
    const { audit } = await replay(body)
    assert.equal(audit.observations[0].resolvedNativeRecord.description, reference)
    assert.ok(audit.observations[0].referenceIssues.some(issue => issue.code === code))
    assert.equal(audit.observations[0].sourceDetailComplete, false)
  }
})

test('foreign tenant and ID mismatches remain auditable without promoting application identity', async () => {
  const body = mutateStream(stream => stream.replace('https://jobs.lever.co/GoToGroup/7dd45945-1b16-4cd5-b031-d128431a804a/apply', 'https://jobs.lever.co/OtherTenant/7dd45945-1b16-4cd5-b031-d128431a804a/apply'))
  assert.notEqual(body, html)
  const { audit } = await replay(body)
  assert.match(audit.observations[0].rawNativeRecord.applyUrl, /OtherTenant/)
  assert.ok(audit.observations[0].identityIssues.length > 0)
  assert.equal(audit.observations[0].sourceIdentityVerified, false)
})

test('missing native primary country preserves all categories and never infers India from description context', async () => {
  const body = mutateStream(stream => stream.replace('"country":"ID"', '"country":null'))
  const { audit, jobs } = await replay(body)
  assert.equal(audit.observations[0].declaredCountry, null)
  assert.equal(audit.observations[0].country, null)
  assert.deepEqual(audit.observations[0].resolvedNativeRecord.categories.allLocations, ['Tangerang'])
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'discovery-only')
})

test('removing serialized data cannot turn remaining corporate cards into a verified empty feed', async () => {
  const body = html.replace(/<script\b[^>]*>self\.__next_f\.push\([\s\S]*?<\/script>/g, '')
  await assert.rejects(replay(body), error => error.code === 'GOJEK_COVERAGE_GAP')
})

test('changed page identity is rejected even if archived serialized job models remain', async () => {
  const body = html.replace('Gojek Careers | Check out the current job openings at Gojek Tech', 'Unrelated archived page')
  await assert.rejects(replay(body), error => error.code === 'GOJEK_COVERAGE_GAP')
})

test('additional executable script text is never evaluated as Flight data', async () => {
  const body = html.replace('self.__next_f.push(', 'globalThis.__gojekBad = true; self.__next_f.push(')
  delete globalThis.__gojekBad
  await assert.rejects(replay(body), error => error.code === 'GOJEK_COVERAGE_GAP')
  assert.equal(globalThis.__gojekBad, undefined)
})

test('registered source forwards options and preserves incomplete inventory while auditing all nine observations', async () => {
  const provider = getScraperCatalog().find(row => row.source === 'gojek')
  const { audit, jobs } = await replay(html, createCatalogScraper(provider).run)
  assert.equal(audit.observations.length, 9)
  assert.equal(readInventoryEvidence(jobs).status, 'discovery-only')
  assert.equal(provider.sourceScopeComplete, false)
  assert.equal(provider.sourceListingComplete, false)
  assert.equal(provider.lifecycleCleanupAllowed, false)
  assert.equal(provider.authoritativeSourceTotal, null)
  assert.equal(provider.authoritativeIndiaFacetCount, null)
})

test('HTTP checkpoint never falls through to a parent HoldCo signal and a successful empty result', async () => {
  const requested = []
  await assert.rejects(gojek.run({ fetchPage: async url => {
    requested.push(url)
    return { status: 429, text: '<title>Vercel Security Checkpoint</title>' }
  } }), error => error.code === 'GOJEK_COVERAGE_GAP')
  assert.deepEqual(requested, ['https://www.gojek.io/careers'])
})

test('pre-aborted caller makes no request', async () => {
  const controller = new AbortController(), reason = Error('Stop before request')
  controller.abort(reason)
  let calls = 0
  await assert.rejects(gojek.run({ signal: controller.signal, fetchPage: async () => { calls++; return { status: 200, text: html } } }), error => error === reason)
  assert.equal(calls, 0)
})

test('abort during transport prevents audit and preserves its reason', async () => {
  const controller = new AbortController(), reason = Error('Stop during request')
  let audits = 0
  await assert.rejects(gojek.run({ signal: controller.signal, fetchPage: async (_url, init) => {
    assert.equal(init.signal, controller.signal)
    controller.abort(reason)
    return { status: 200, text: html }
  }, onAudit: () => audits++ }), error => error === reason)
  assert.equal(audits, 0)
})

test('transport errors and audit errors propagate without an empty success', async () => {
  const reason = Error('Unavailable')
  await assert.rejects(gojek.run({ fetchPage: async () => { throw reason } }), error => error === reason)
  await assert.rejects(gojek.run({ fetchPage: async () => ({ status: 200, text: html }), onAudit: () => { throw reason } }), error => error === reason)
})

test('abort from audit prevents even a partial successful result', async () => {
  const controller = new AbortController(), reason = Error('Stop after audit')
  await assert.rejects(gojek.run({ signal: controller.signal, fetchPage: async () => ({ status: 200, text: html }), onAudit: () => controller.abort(reason) }), error => error === reason)
})
