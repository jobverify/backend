import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'

import * as family from './parser.js'
import { readInventoryDelegationEvidence } from '../../scraper-support/utils/inventoryDelegationEvidence.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const capture = JSON.parse(gunzipSync(readFileSync(new URL('./test-data/delegation-scope-20261031.json.gz', import.meta.url))))
const matchingId = '1363141357'
const fixture = ({ mutateParent, mutateCategory } = {}) => {
  const pages = structuredClone(capture.packets), parentConfig = family.createSourceConfig()
  for (const step of parentConfig.handoffs) step.verify(pages.find(page => page.url === step.url).body)
  const listing = parentConfig.parseListing(pages.find(page => page.url === family.SEARCH).body, family.SEARCH)
  const parentEvidence = { source: 'holcim', handoffVerified: true, listingPaginationComplete: false,
    listingRecords: listing.records, retainedResponses: pages.filter(page => page.url !== family.CATEGORY).map(page => ({
      url: page.url, status: page.status, headers: page.headers,
      completedAt: page.capturedAt, rawBodyBase64: Buffer.from(page.body).toString('base64'),
    })) }
  mutateParent?.(parentEvidence)
  const calls = []
  return { parentEvidence, calls, transport: async (url, { signal } = {}) => {
    signal?.throwIfAborted()
    calls.push(url)
    assert.equal(url, family.CATEGORY)
    const page = structuredClone(pages.find(page => page.url === url))
    mutateCategory?.(page)
    return { ...page, body: Buffer.from(page.body), bodyComplete: true, completedAt: page.capturedAt }
  } }
}

test('Holcim current native parent/category tuple proves only the separately owned GHBS recruitment reference', async () => {
  const f = fixture(), proof = await family.verifyHolcimRecruitmentReference?.(f)
  assert.equal(proof?.source, 'holcim')
  assert.deepEqual(proof.sources, ['holcimglobalhubbusinessservices'])
  assert.equal(proof.preservesChildSourceAndCompany, true)
  assert.equal(proof.verifiedAt, '2026-10-31T08:05:20.380Z')
  assert.equal(proof.evidence.method, 'native-group-and-business-unit-recruitment-reference')
  assert.equal(proof.evidence.url, family.CATEGORY)
  assert.deepEqual(proof.evidence.responses, [
    { url: family.HOME, finalUrl: family.HOME, status: 200, sha256: '5beb5d4c8f06c37b519929ab31a9faf9b6df4f21973886a691d14b1d7e6292d6' },
    { url: family.SEARCH, finalUrl: family.SEARCH, status: 200, sha256: '0bcfb75eaca8269e2e3e02370dd31c16932e4f49dc30053fb15015e9e962224c' },
    { url: family.CATEGORY, finalUrl: family.CATEGORY, status: 200, sha256: '04e724140d9b83f8a3fa390ceffa7eaf5c73eeeb8df41c79d121fc2d46441135' },
  ])
  assert.deepEqual(f.calls, [family.CATEGORY])
  assert.equal(f.parentEvidence.listingPaginationComplete, false)
})

for (const [name, options] of [
  ['unrelated tenant', { mutateCategory: page => { page.body = page.body.replaceAll("'holcimgrou'", "'foreign-company'") } }],
  ['hidden child surface', { mutateCategory: page => { page.body = '<div hidden>' + page.body + '</div>' } }],
  ['inert child surface', { mutateCategory: page => { page.body = '<div inert>' + page.body + '</div>' } }],
  ['missing GHBS self-label', { mutateCategory: page => { page.body = page.body.replaceAll('Jobs at Holcim Global Hub Business Services', 'Jobs at Another Company') } }],
  ['missing reciprocal group label', { mutateCategory: page => { page.body = page.body.replaceAll('Holcim Group Jobs', 'Foreign Company Jobs') } }],
  ['foreign final URL', { mutateCategory: page => { page.finalUrl = 'https://example.invalid/' } }],
  ['unavailable category', { mutateCategory: page => { page.status = 403 } }],
  ['changed native title tuple', { mutateParent: evidence => { evidence.listingRecords.find(row => row.id === matchingId).title += ' changed' } }],
  ['foreign-country tuple', { mutateCategory: page => { page.body = page.body.replaceAll('Navi Mumbai, MH, IN, 400708', 'Navi Mumbai, MH, US, 400708') } }],
  ['missing actual parent row backing', { mutateParent: evidence => { evidence.retainedResponses = evidence.retainedResponses.filter(page => page.url !== family.SEARCH) } }],
  ['missing parent corporate binding', { mutateParent: evidence => { evidence.retainedResponses[0].rawBodyBase64 = Buffer.from(Buffer.from(evidence.retainedResponses[0].rawBodyBase64, 'base64').toString().replaceAll('https://www.holcim.com/', 'https://example.invalid/')).toString('base64') } }],
]) test('Holcim cannot refresh a scoped reference from ' + name, async () => {
  await assert.rejects(async () => family.verifyHolcimRecruitmentReference?.(fixture(options)), /Holcim.*reference|Holcim.*binding|company token|native tile/i)
})

for (const [name, options] of [
  ['untimed parent response', { mutateParent: evidence => { delete evidence.retainedResponses[0].completedAt } }],
  ['untimed category', { mutateCategory: page => { delete page.capturedAt } }],
  ['future native clock', { mutateCategory: page => { page.capturedAt = '2999-01-01T00:00:00Z' } }],
]) test('Holcim ' + name + ' cannot be restamped as a current native reference', async () => {
  const proof = await family.verifyHolcimRecruitmentReference?.(fixture(options))
  assert.equal(proof, null)
})

test('Holcim exact cancellation during the category read cannot be swallowed as relationship unavailability', async () => {
  const controller = new AbortController(), reason = Error('stop GHBS reference'), f = fixture({ mutateCategory: () => controller.abort(reason) })
  await assert.rejects(async () => family.verifyHolcimRecruitmentReference?.({ ...f, signal: controller.signal }), error => error === reason)
})

for (const [name, row] of [
  ['parent-employer alias', { source: 'holcim', company: 'Another Company', sourceUrl: family.ORIGIN + '/job/own/123456/' }],
  ['GHBS role rewritten as the parent', { source: 'holcim', company: 'Holcim', sourceUrl: family.ORIGIN + '/holcim_ghbs/job/child/123456/' }],
  ['missing separate child ownership references', { source: 'holcim', company: 'Holcim', sourceUrl: family.ORIGIN + '/job/own/123456/' }],
  ['missing matching native ownership reference', { source: 'holcim', company: 'Holcim', sourceUrl: family.ORIGIN + '/job/own/123456/',
    nativeDelegatedIndiaRecords: [{ source: 'holcimglobalhubbusinessservices', id: '123456', url: family.ORIGIN + '/holcim_ghbs/job/other/123456/' }] }],
]) test('Holcim reference cannot certify ' + name, async () => {
  await assert.rejects(family.verifyHolcimRecruitmentReference({ ...fixture(), parentJobs: [row] }), /ownership|attribution/i)
})

test('Holcim parent keeps genuine own historical jobs when the current reference is unavailable', async () => {
  const f = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/native-20261023.json.gz', import.meta.url))))
  const byUrl = new Map(f.requests.map(page => [page.url, page])), calls = []
  const jobs = await family.runFamily('holcim', { transport: async url => {
    calls.push(url)
    const page = byUrl.get(url)
    assert.ok(page, 'Uncaptured historical native boundary ' + url)
    return { ...page, status: url === family.CATEGORY ? 403 : page.status, body: Buffer.from(page.rawBodyBase64, 'base64') }
  } })
  assert.ok(calls.includes(family.CATEGORY))
  assert.equal(jobs.length, 2)
  assert.ok(jobs.every(job => job.source === 'holcim' && job.company === 'Holcim' && !job.sourceUrl.includes('/holcim_ghbs/job/')))
  assert.equal(readInventoryDelegationEvidence(jobs), null)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(jobs.sourceDelegationAudit?.status, 'unverified')
})
