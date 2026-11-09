import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import test from 'node:test'
import { gunzipSync } from 'node:zlib'

import { SOURCE, COMPANY, HOMEPAGE_URL, CAREERS_URL, JOBS_URL, createAstronicsScraper } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

// Original public bodies and HTTP metadata are retained together. Mutations
// below are negative controls, never evidence of a current vacancy or country.
const packets = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/native-20261103.json.gz', import.meta.url))))
for (const packet of packets) {
  assert.equal(createHash('sha256').update(packet.html).digest('hex'), packet.sha256)
  assert.ok(packet.originalCapture)
}
const greenhouse = 'https://job-boards.greenhouse.io/embed/job_board?for=astronicscorporation'
const canada = 'https://www.astronics.com/canada-jobs'
const france = 'https://francejobs.astronics.com'
const franceRole = packets.find(packet => packet.requestedUrl.endsWith('_432.aspx')).requestedUrl

const editModel = (html, edit) => html.replace(
  /(window\.__remixContext\s*=\s*)(\{[\s\S]*?\})(;\s*<\/script>)/,
  (_all, start, serialized, end) => {
    const value = JSON.parse(serialized)
    edit(value.state.loaderData)
    return start + JSON.stringify(value) + end
  },
)

async function replay(t, mutate = () => {}, options = {}) {
  t.mock.method(globalThis, 'fetch', async () => assert.fail('Only retained public HTTP receipts may be read'))
  const queues = new Map()
  for (const packet of packets) {
    if (!queues.has(packet.requestedUrl)) queues.set(packet.requestedUrl, [])
    queues.get(packet.requestedUrl).push(packet)
  }
  const calls = [], visits = new Map()
  let audit
  const jobs = await createAstronicsScraper().run({
    ...options,
    fetchPage: async (url, init) => {
      init.signal.throwIfAborted()
      const queue = queues.get(url)
      assert.ok(queue?.length, 'Uncaptured public URL: ' + url)
      const packet = structuredClone(queue.length > 1 ? queue.shift() : queue[0])
      const visit = (visits.get(url) || 0) + 1
      visits.set(url, visit)
      calls.push(url)
      mutate(packet, { url, visit })
      return packet
    },
    onAudit: value => { audit = value },
  })
  return { jobs, audit, calls }
}

test('Astronics factory exposes the current Test Systems identity and public careers entry', () => {
  assert.equal(SOURCE, 'astronics')
  assert.equal(COMPANY, 'Astronics Test Systems')
  assert.equal(HOMEPAGE_URL, 'https://www.astronics.com/test-systems')
  assert.equal(CAREERS_URL, 'https://www.astronics.com/careers')
  assert.equal(JOBS_URL, 'https://www.astronics.com/us-jobs')
  assert.equal(typeof createAstronicsScraper().run, 'function')
})

test('Astronics factory reconciles actual declared non-India inventory without assigning parent roles to Test Systems', async t => {
  const { jobs, audit, calls } = await replay(t)
  assert.deepEqual(jobs, [])
  assert.equal(calls[0], HOMEPAGE_URL)
  assert.ok(!calls.some(url => /diagnosys\.com|appone/i.test(url)))
  assert.equal(audit.greenhouseRoles.length, 88)
  assert.equal(audit.franceDetails.length, 6)
  assert.deepEqual(audit.countryCounts, { 'United States': 88, France: 5, Ireland: 1 })
  assert.ok(audit.franceDetails.every(role => role.company === 'Astronics PGA'
    && role.sourceDescription.length > 500 && role.sourceDetailComplete === true
    && role.sourceNativeReference.endsWith('-' + role.jobId)))
  assert.equal(audit.finalCanada.explicitEmpty, true)
  assert.equal(audit.sourceDeclaredBoardScopeComplete, true)
  assert.equal(audit.sourceCompanyWideScopeComplete, false)
  assert.equal(audit.sourceLifecycleCleanupVerified, false)
  assert.equal(audit.finalInventoryReadAfterDetails, true)
  assert.equal(audit.closingInventoryMatches, true)
  const lastDetail = calls.findLastIndex(url => /emploi-.*_\d+\.aspx$/.test(url))
  assert.ok(calls.findLastIndex(url => url === greenhouse + '&page=2') > lastDetail)
  assert.ok(audit.responses.every(receipt => packets.some(packet => packet.requestedUrl === receipt.url
    && packet.url === receipt.finalUrl && packet.status === receipt.status && packet.sha256 === receipt.sha256)))
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.firstParty, true)
  assert.equal(evidence.status, 'complete-inventory')
  assert.equal(evidence.listingComplete, true)
  assert.equal(evidence.reportedTotal, 94)
  assert.equal(evidence.indiaFacetCount, 0)
})

for (const [label, target, change, pattern] of [
  ['Test Systems employer bridge', HOMEPAGE_URL,
    packet => { packet.html = packet.html.replaceAll('Astronics acquires Diagnosys Test Systems', 'Removed corporate history') }, /Test Systems\/Diagnosys identity/],
  ['declared corporate country handoff', CAREERS_URL,
    packet => { packet.html = packet.html.replaceAll('/canada-jobs', '/retired-canada-jobs') }, /country channel|unreviewed/],
  ['exact public Greenhouse tenant', greenhouse,
    packet => { packet.html = editModel(packet.html, model => { model.root.urlToken = 'unrelated-employer' }) }, /public employer board/],
  ['France all-offers handoff', france,
    packet => { packet.html = packet.html.replaceAll('liste-toutes-offres.aspx', 'retired-offers.aspx') }, /France all-offers declaration/],
]) test('Astronics factory rejects a changed ' + label, async t => {
  await assert.rejects(replay(t, (packet, { url }) => {
    if (url !== target) return
    const original = packet.html
    change(packet)
    assert.notEqual(packet.html, original, 'The negative control must change its retained response')
  }), pattern)
})

test('Astronics factory rejects a changed final response origin before using employer content', async t => {
  await assert.rejects(replay(t, (packet, { url }) => {
    if (url === HOMEPAGE_URL) packet.url = 'https://unrelated.invalid/test-systems'
  }), /final URL identity/)
})

test('Astronics factory requires the actual Canada empty declaration rather than inferring absence from a country page', async t => {
  await assert.rejects(replay(t, (packet, { url }) => {
    if (url === canada) packet.html = packet.html.replaceAll('Sorry, there are no open positions at this time.', 'Current vacancies are unavailable.')
  }), /explicit Canada empty statement changed/)
})

test('Astronics factory holds a potential India role on the shared parent board for exact employer and full criteria proof', async t => {
  const { jobs, audit } = await replay(t, (packet, { url }) => {
    if (url === greenhouse) packet.html = editModel(packet.html, model => {
      model['routes/embed.job_board'].jobPosts.data[0].location = 'Bengaluru, India'
    })
  })
  assert.deepEqual(jobs, [])
  assert.ok(audit.potentialIndiaRoles.length > 0)
  assert.equal(audit.sourceDeclaredBoardScopeComplete, false)
  assert.equal(audit.sourceCompanyWideScopeComplete, false)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
})

for (const [label, change] of [
  ['complete authored Mission criteria', html => html.replace(/(<h3\b[^>]*>\s*)Mission(\s*<\/h3>)/, '$1Unavailable$2')],
  ['the same native role title', html => html.replace(/(<h1\b[^>]*>)[\s\S]*?(<\/h1>)/, '$1Unrelated role$2')],
  ['its matching native requisition reference', html => html.replaceAll('2025-432', '2025-999')],
]) test('Astronics factory cannot qualify a France role without ' + label, async t => {
  const { jobs, audit } = await replay(t, (packet, { url }) => {
    if (url !== franceRole) return
    const original = packet.html
    packet.html = change(original)
    assert.notEqual(packet.html, original, 'The negative control must change its retained response')
  })
  assert.ok(audit.failures.some(row => row.stage === 'France-detail' && row.id === '432'))
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
})

test('Astronics factory revokes declared inventory completeness when full native closing criteria change', async t => {
  const { jobs, audit } = await replay(t, (packet, { url, visit }) => {
    if (url === franceRole && visit === 2) packet.html = packet.html.replace(
      /(<h3\b[^>]*>\s*Mission\s*<\/h3>)/, '$1<p>Changed closing criteria during collection.</p>',
    )
  })
  assert.ok(audit.failures.some(row => row.stage === 'France-detail' && /criteria\/country\/reference changed/.test(row.reason)))
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(audit.sourceLifecycleCleanupVerified, false)
})

test('Astronics factory forwards exact caller cancellation before any public read', async () => {
  const controller = new AbortController(), reason = Error('Caller stopped Astronics')
  controller.abort(reason)
  let reads = 0
  await assert.rejects(createAstronicsScraper().run({ signal: controller.signal,
    fetchPage: async () => { reads++; assert.fail('Cancelled factory must not read') },
  }), error => error === reason)
  assert.equal(reads, 0)
})
