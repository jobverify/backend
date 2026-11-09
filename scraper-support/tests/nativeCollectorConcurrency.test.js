import assert from 'node:assert/strict'
import test from 'node:test'
import { createFirstPartyHTMLScraper } from '../shared/firstPartyHtmlJobs.js'
const BOARD = 'https://careers.example.invalid/India'
function fixture({ count = 7, options = {}, failIDs = [] } = {}) {
  const calls = [], active = new Set(); let peak = 0
  const config = { source: 'native-concurrency-fixture', companyName: 'Fixture', boardURL: BOARD, handoffs: [],
    validateURL(url) { assert.ok(url === BOARD || /^https:\/\/careers\.example\.invalid\/job\/\d+$/.test(url)) },
    sameReadIdentity: (a, b) => a === b, expectedContentType: () => 'application/json',
    parseListing: () => ({ pageNumber: 1, lastPage: 1, reportedTotal: count, observedRows: count,
      records: Array.from({ length: count }, (_, id) => ({ id: String(id), title: 'Role ' + id, url: 'https://careers.example.invalid/job/' + id })),
      errors: [], nextURL: null, terminationKnown: true }),
    pageFingerprint: p => String(p.reportedTotal), candidateForIndia: () => true,
    parseDetail(body, row) { if (failIDs.includes(Number(row.id))) throw Error('Representative upstream shape failure ' + row.id); return { id: row.id, title: row.title } },
    ...options,
  }
  return { calls, config, peak: () => peak, async transport(url) {
    calls.push(url)
    if (url !== BOARD) {
      active.add(url); peak = Math.max(peak, active.size)
      await new Promise(resolve => setTimeout(resolve, Number(url.split('/').at(-1)) % 3 === 0 ? 5 : 1))
      active.delete(url)
    }
    return { url, status: 200, headers: { 'content-type': 'application/json' }, body: Buffer.from('{"native":true}'), bodyComplete: true }
  } }
}
test('explicit bounded native concurrency reads a 600-role inventory without the default request ceiling truncating it', async () => {
  const f = fixture({ count: 600, options: { detailConcurrency: 4, maxRequests: 700 } })
  const result = await createFirstPartyHTMLScraper(f.config).collect({ transport: f.transport })
  assert.equal(result.jobs.length, 600)
  assert.equal(result.failures.length, 0); assert.equal(f.calls.length, 602)
  assert.ok(f.peak() > 1 && f.peak() <= 4)
  assert.deepEqual(result.jobs.map(j => j.id), Array.from({ length: 600 }, (_, i) => String(i)))
  assert.equal(result.closingInventoryMatches, true)
  assert.deepEqual(result.retainedResponses.map(p => p.url), [...result.retainedResponses.map(p => p.url)].sort((a, b) => a.localeCompare(b)))
})
test('unconfigured native sources retain sequential reads and their existing 512-request ceiling', async () => {
  const f = fixture({ count: 520 })
  const result = await createFirstPartyHTMLScraper(f.config).collect({ transport: f.transport })
  assert.equal(f.peak(), 1); assert.equal(f.calls.length, 512)
  assert.equal(result.jobs.length, 511); assert.ok(result.failures.length > 0)
  assert.equal(result.cleanupAllowed, false); assert.equal(result.verifiedZeroInventory, false)
  assert.equal(Object.hasOwn(result, 'collectionLimits'), false)
  assert.equal(Object.hasOwn(result, 'retainedResponseOrder'), false)
})
test('parallel failures and successful details retain stable listing order and exact unknown candidates', async () => {
  const f = fixture({ options: { detailConcurrency: 3 }, failIDs: [0, 2] })
  const result = await createFirstPartyHTMLScraper(f.config).collect({ transport: f.transport })
  assert.deepEqual(result.jobs.map(j => j.id), ['1', '3', '4', '5', '6'])
  assert.deepEqual(result.unknownRawFailures.map(f => f.candidate.id), ['0', '2'])
  assert.ok(result.unknownRawFailures.every(f => f.candidate.rawDetailHTML === '{"native":true}'))
  assert.equal(result.failures.length, 2); assert.equal(result.status, 'partial')
  assert.equal(result.cleanupAllowed, false); assert.ok(f.peak() <= 3)
})
test('native collection overrides are bounded integers and fail before public reads', async () => {
  for (const options of [{detailConcurrency:0},{detailConcurrency:9},{detailConcurrency:1.5},{detailConcurrency:'4'},
    {maxRequests:0},{maxRequests:2049},{maxRequests:1.5},{maxRequests:'700'}]) {
    const f = fixture({ options })
    await assert.rejects(createFirstPartyHTMLScraper(f.config).collect({ transport: f.transport }))
    assert.equal(f.calls.length, 0)
  }
})
