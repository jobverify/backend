import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import * as avaamo from '../../scraper/avaamo/script.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { readSourceObservationEvidence } from '../utils/sourceObservationEvidence.js'
import { extractionRawJobMetrics } from '../utils/extractionRawJobMetrics.js'
import { extractionDetailHealth } from '../utils/extractionDetailHealth.js'
import { analyzePublishableJobs } from '../utils/publishableJobMetrics.js'
import { inventoryCleanupOptions } from '../utils/scraperOutcome.js'
import { createAvaamoReader } from '../../scraper/avaamo/boundedRead.js'

const archive = JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/avaamo/fixtures/current-native-20261105.json.gz', import.meta.url))))
const opening = archive.responses[0]
const sourceClock = archive.responses.at(-1).completedAt
const sha = body => createHash('sha256').update(body).digest('hex')
const fixtureResponses = new Map(archive.responses.slice(1, -1).map(packet => [packet.finalUrl, packet]))
fixtureResponses.set(opening.finalUrl, opening)
const response = (packet, body = packet.body, status = packet.status) => {
  const result = new Response(body, { status, headers: { 'content-type': packet.headers['content-type'] } })
  Object.defineProperty(result, 'url', { value: packet.finalUrl })
  return result
}
const fetchFixture = (seen = [], mutate = (_url, body) => body) => async (url, init = {}) => {
  assert.equal(init.method, 'GET')
  assert.equal(init.redirect, 'manual')
  assert.equal(init.credentials, 'omit')
  assert.equal(init.body, undefined)
  const packet = fixtureResponses.get(url)
  assert.ok(packet, `Unexpected URL ${url}`)
  seen.push(url)
  return response(packet, mutate(url, packet.body, seen))
}

test('Avaamo recognizes current Framer native cards and resolves relative roles against the actual canonical document URL', () => {
  for (const packet of archive.responses) {
    assert.equal(Buffer.byteLength(packet.body), packet.bytes)
    assert.equal(sha(packet.body), packet.sha256)
    assert.equal(packet.status, 200)
  }
  assert.equal(avaamo.hasOfficialCareersPageSignal(opening.body), true)
  const cards = avaamo.extractListingCards(opening.body, opening.finalUrl)
  assert.equal(cards.length, 12)
  assert.equal(cards[0].detailUrl, 'https://avaamo.ai/career/senior-account-executive')
  assert.equal(cards[0].location, 'United States')
  assert.equal(cards[2].title, 'Forward Deployed Engineer (FDE)')
  assert.equal(cards[2].detailUrl, 'https://avaamo.ai/career/forward-deployed-engineer')
  assert.equal(cards[3].location, 'Bangalore')
})

test('Avaamo current collector retains 12 observed roles, complete original criteria for 11 and the FDE content gap without inferring India', async () => {
  const seen = []
  const jobs = await avaamo.run({ fetchImpl: fetchFixture(seen), now: () => sourceClock })
  assert.equal(jobs.length, 12)
  assert.equal(seen.length, 14)
  assert.equal(seen[0], 'https://avaamo.ai/career')
  assert.equal(seen.at(-1), seen[0])
  assert.equal(jobs.filter(job => job.country === null).length, 8)
  assert.equal(jobs.filter(job => job.country === 'United States').length, 4)
  assert.equal(jobs.filter(job => job.sourceDetailComplete).length, 11)
  const fde = jobs.find(job => job.jobId === 'forward-deployed-engineer')
  assert.equal(fde.sourceDetailComplete, false)
  assert.equal(fde.sourceDetailFailureKind, 'missing-role-criteria')
  const ai = jobs.find(job => job.jobId === 'applied-ai-engineer')
  assert.equal(ai.location, 'Bangalore')
  assert.equal(ai.country, null)
  assert.equal(ai.sourceCountryScopeUnresolved, true)
  assert.equal(ai.sourceNativePayload.detail.rawHtml, fixtureResponses.get(ai.sourceUrl).body)
  assert.ok(ai.sourceDescription.includes('About Avaamo'))
  assert.ok(ai.sourceDescription.includes('Design, develop, and deploy conversational agents using Avaamo platform.'))
  assert.ok(ai.sourceDescriptionHtml.includes('<ul'))
  assert.ok(ai.sourceSections.some(section => /requirements|qualifications/i.test(section.heading)))
  assert.ok(jobs.find(job => job.jobId === 'conversation-designer').sourceDescription.includes('Senior Conversation Designer'))
  assert.ok(!jobs.some(job => job.country === 'India'))
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
  assert.equal(evidence.verifiedAt, sourceClock)
  assert.equal(jobs[avaamo.AVAAMO_COLLECTION_EVIDENCE].openingClosingMatch, true)
  assert.equal(jobs[avaamo.AVAAMO_COLLECTION_EVIDENCE].unknownCountryCount, 8)
  assert.equal(readSourceObservationEvidence(jobs, 'avaamo').observedVacancyCount, 12)
  assert.equal(extractionRawJobMetrics({ source: 'avaamo' }, jobs, evidence).rawJobs, 12)
  assert.equal(extractionDetailHealth(jobs).complete, false)
  assert.deepEqual(inventoryCleanupOptions({ success: true, inventoryEvidence: evidence }), { replaceExisting: false })
})

test('Avaamo registered collection preserves real raw observations and does not publish unknown city-only countries', async () => {
  const scraper = buildScrapers().find(row => row.name === 'avaamo')
  const jobs = await scraper.run({ fetchImpl: fetchFixture(), now: () => sourceClock })
  const analysis = analyzePublishableJobs(jobs, { now: new Date(sourceClock) })
  assert.equal(jobs.length, 12)
  assert.equal(jobs.filter(job => job.country === null && job.sourceCountryScopeUnresolved).length, 8)
  assert.equal(analysis.indiaJobs.length, 0)
  assert.equal(analysis.eligibleJobs.length, 0)
  assert.equal(extractionRawJobMetrics(scraper.provider, jobs, readInventoryEvidence(jobs)).rawJobs, 12)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
})

test('Avaamo active provider metadata agrees with the current source-local partial inventory contract', () => {
  const provider = getScraperCatalog().find(row => row.source === 'avaamo')
  const scraper = buildScrapers().find(row => row.name === 'avaamo')
  assert.equal(provider.catalogOverride, true)
  for (const key of ['companyCareerPage', 'extractionStrategy', 'paginationStrategy', 'verifiedOn', 'verifiedSurfaceSummary', 'verifiedPublicJobCount', 'verifiedIndiaJobCount']) {
    assert.equal(provider[key], avaamo.PROVIDER_METADATA[key], key)
    assert.equal(scraper.provider[key], provider[key], key)
  }
  assert.equal(provider.companyCareerPage, 'https://avaamo.ai/career')
  assert.equal(provider.verifiedPublicJobCount, null)
  assert.equal(provider.verifiedIndiaJobCount, null)
})

test('Avaamo recognizes explicit foreign countries without inferring geography from cities or travel prose', () => {
  assert.equal(avaamo.explicitAvaamoCountry('Toronto, Ontario, Canada'), 'Canada')
  assert.equal(avaamo.explicitAvaamoCountry('United Kingdom (remote)'), 'United Kingdom')
  assert.equal(avaamo.explicitAvaamoCountry('Bangalore'), null)
  assert.equal(avaamo.explicitAvaamoCountry('Bengaluru, Koramangala'), null)
  assert.equal(avaamo.explicitAvaamoCountry('Frequent travel to the US and Europe'), null)
  assert.equal(avaamo.explicitAvaamoCountry('Bangalore, India'), 'India')
})

const roleListing = id => avaamo.extractListingCards(opening.body, opening.finalUrl).find(row => row.detailUrl.endsWith('/' + id))
const rolePacket = id => fixtureResponses.get('https://avaamo.ai/career/' + id)
const contentReplacement = (packet, inner) => {
  const detail = avaamo.parseAvaamoDetail(packet.body, roleListing(packet.finalUrl.split('/').at(-1)))
  const { innerStart, innerEnd } = detail.contentSourceOffsets
  return packet.body.slice(0, innerStart) + inner + packet.body.slice(innerEnd)
}

test('Avaamo ignores comments, templates, raw script data and hidden fakes when binding native roles and full criteria', () => {
  const packet = rolePacket('applied-ai-engineer'), listing = roleListing('applied-ai-engineer')
  const full = avaamo.parseAvaamoDetail(packet.body, listing)
  const fake = '<div data-framer-name="Content" data-framer-component-type="RichTextContainer"><h3>Requirements</h3><p>Forged requirements must remain inert and cannot replace authored criteria.</p></div>'
  const decorated = packet.body.replace('</head>', '<style>.avaamo-fake {display:none}</style></head>')
    .replace('</body>', '<!--' + fake + '--><template>' + fake + '</template><div hidden>' + fake + '</div><div inert>' + fake + '</div><div aria-hidden="true">' + fake + '</div><div class="avaamo-fake">' + fake + '</div><div style="opacity:0">' + fake + '</div><script type="application/json">' + JSON.stringify({ fake }) + '</script></body>')
  const parsed = avaamo.parseAvaamoDetail(decorated, listing)
  assert.equal(parsed.sourceDescription, full.sourceDescription)
  assert.equal(parsed.sourceDescriptionHtml, full.sourceDescriptionHtml)
  assert.equal(parsed.rawContentHtml, full.rawContentHtml)
  assert.equal(parsed.sourceDetailComplete, true)
  assert.equal(parsed.sourceDescription.includes('Forged requirements'), false)
})

test('Avaamo withholds complete criteria for absent, hidden or placeholder requirements and preserves authored company text', () => {
  const packet = rolePacket('applied-ai-engineer'), listing = roleListing('applied-ai-engineer')
  for (const inner of [
    '<p>Location: Bangalore</p><h3>About Avaamo</h3><p>Avaamo builds enterprise AI products for large organizations and leading global companies.</p>',
    '<p>We build conversational agents for enterprise customer experiences and reliable production operations.</p><h3>Requirements</h3><p>TBD</p><h3>About Avaamo</h3><p>Avaamo builds enterprise products.</p>',
    '<p>We build conversational agents for enterprise customer experiences and reliable production operations.</p><h3>Requirements</h3><template><p>Extensive experience with production systems and typed services is required.</p></template>',
  ]) {
    const parsed = avaamo.parseAvaamoDetail(contentReplacement(packet, inner), listing)
    assert.equal(parsed.sourceDetailComplete, false)
    assert.equal(parsed.sourceDetailFailureKind, 'missing-role-criteria')
  }
  assert.throws(() => avaamo.parseAvaamoDetail(packet.body.replace('data-framer-name="Content" data-framer-component-type="RichTextContainer"', 'hidden data-framer-name="Content" data-framer-component-type="RichTextContainer"'), listing), /active authored role Content/)
})

test('Avaamo fails closed for mismatched employer, canonical, responsive titles, detail metadata and offsite role links', () => {
  const packet = rolePacket('applied-ai-engineer'), listing = roleListing('applied-ai-engineer')
  const mutations = [
    packet.body.replace('<title>Applied AI Engineer | Careers at Avaamo</title>', '<title>Different role | Careers at Avaamo</title>'),
    packet.body.replace('"legalName":"Avaamo, Inc."', '"legalName":"Different employer"'),
    packet.body.replace('rel="canonical" href="' + listing.detailUrl, 'rel="canonical" href="https://avaamo.ai/career/other-role'),
    packet.body.replace('>Applied AI Engineer</h1>', '>Incorrect role</h1>'),
    packet.body.replace(/(data-framer-name="Location" data-framer-component-type="RichTextContainer"[^>]*>[\s\S]*?>)Bangalore/, '$1United States'),
  ]
  for (const html of mutations) {
    assert.ok(html !== packet.body, 'mutation must actually alter the native fixture')
    assert.throws(() => avaamo.parseAvaamoDetail(html, listing), /Avaamo current native contract/)
  }
  assert.throws(() => avaamo.extractListingCards(opening.body.replace('href="./career/senior-account-executive"', 'href="https://example.com/career/senior-account-executive"'), opening.finalUrl), /outside public careers scope/)
  assert.throws(() => avaamo.extractListingCards(opening.body.replace('<title>Careers at Avaamo</title>', '<title>Another employer</title>'), opening.finalUrl), /page title/)
  assert.throws(() => avaamo.extractListingCards(opening.body.replace('>Senior Account Executive</h3>', '>Conflicting responsive title</h3>'), opening.finalUrl), /renditions disagree/)
})

test('Avaamo requires independent matching closing records and never promotes changed or job-limited inventory', async () => {
  const seen = []
  await assert.rejects(avaamo.run({ fetchImpl: fetchFixture(seen, (url, body, calls) => url === opening.finalUrl && calls.length > 1 ? body.replaceAll('>Senior Account Executive</h3>', '>Different current title</h3>') : body), now: () => sourceClock }), /opening and closing native inventory changed/)
  assert.equal(seen.length, 14)
  const limited = []
  await assert.rejects(avaamo.run({ fetchImpl: fetchFixture(limited), maxJobs: 1 }), /job count budget exceeded/)
  assert.deepEqual(limited, [opening.finalUrl])
})

test('Avaamo physical requests, pages, response/source/output bytes and bad MIME remain bounded and cancel rejected bodies', async () => {
  for (const options of [{ maxRequests: 1 }, { maxPages: 1 }, { maxBodyBytes: 100 }, { maxTotalBytes: 100 }, { maxOutputBytes: 100 }]) {
    await assert.rejects(avaamo.run({ ...options, fetchImpl: fetchFixture(), now: () => sourceClock }), /(?:count|byte) budget exceeded/)
  }
  let cancelled = false
  await assert.rejects(avaamo.run({ fetchImpl: async url => {
    const res = new Response(new ReadableStream({ cancel() { cancelled = true } }), { headers: { 'content-type': 'application/javascript' } })
    Object.defineProperty(res, 'url', { value: url })
    return res
  } }), /unexpected HTML MIME/)
  assert.equal(cancelled, true)
  let textCalled = false
  await assert.rejects(avaamo.run({ fetchImpl: async url => ({ status: 200, url, headers: new Headers({ 'content-type': 'text/html' }), text() { textCalled = true; return opening.body } }) }), /non-streaming/)
  assert.equal(textCalled, false)
})

test('Avaamo manual redirects cannot escape source scope and count each admitted physical request', async () => {
  const seen = []
  await assert.rejects(avaamo.run({ maxRequests: 2, fetchImpl: async (url, init) => {
    assert.equal(init.redirect, 'manual')
    seen.push(url)
    const res = new Response(null, { status: 302, headers: { location: url } })
    Object.defineProperty(res, 'url', { value: url })
    return res
  } }), /request count budget exceeded/)
  assert.equal(seen.length, 2)
  const escaped = []
  await assert.rejects(avaamo.run({ fetchImpl: async url => {
    escaped.push(url)
    const res = new Response(null, { status: 302, headers: { location: 'https://example.com/other' } })
    Object.defineProperty(res, 'url', { value: url })
    return res
  } }), /unreviewed public redirect/)
  assert.deepEqual(escaped, [opening.finalUrl])
})

test('Avaamo rejects ignored fetch and body reads at the request deadline and releases late bodies', async () => {
  await assert.rejects(avaamo.run({ requestTimeoutMs: 10, collectionBudgetMs: 1000, fetchImpl: async () => new Promise(() => {}) }), /request deadline exceeded/)
  let cancelled = false
  await assert.rejects(avaamo.run({ requestTimeoutMs: 10, collectionBudgetMs: 1000, fetchImpl: async url => {
    const res = new Response(new ReadableStream({ pull() { return new Promise(() => {}) }, cancel() { cancelled = true } }), { headers: { 'content-type': 'text/html' } })
    Object.defineProperty(res, 'url', { value: url })
    return res
  } }), /request deadline exceeded/)
  assert.equal(cancelled, true)
  let release, lateCancelled = false
  const pending = avaamo.run({ requestTimeoutMs: 10, collectionBudgetMs: 1000, fetchImpl: async () => new Promise(resolve => { release = resolve }) })
  await assert.rejects(pending, /request deadline exceeded/)
  release(new Response(new ReadableStream({ cancel() { lateCancelled = true } })))
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(lateCancelled, true)
})

test('Avaamo checks monotonic deadlines after synchronous fetch and final source-clock work', async () => {
  const busy = ms => { const end = performance.now() + ms; while (performance.now() < end) {} }
  await assert.rejects(avaamo.run({ requestTimeoutMs: 5, collectionBudgetMs: 1000, fetchImpl: async () => { busy(12); return response(opening) } }), /request deadline exceeded/)
  await assert.rejects(avaamo.run({ collectionBudgetMs: 5, requestTimeoutMs: 1000, fetchImpl: async () => { busy(12); return response(opening) } }), /source deadline exceeded/)
  await assert.rejects(avaamo.run({ collectionBudgetMs: 2000, fetchImpl: fetchFixture(), now: () => { busy(2100); return sourceClock } }), /source deadline exceeded/)
})

test('Avaamo preserves exact opaque and falsey caller cancellation before fetch and during an ignored body read', async () => {
  const opaque = Object.freeze({ get message() { throw Error('opaque cancellation inspected') } })
  for (const reason of [false, 0, '', null, opaque]) {
    const pre = new AbortController(); pre.abort(reason)
    let calls = 0
    await assert.rejects(avaamo.run({ signal: pre.signal, fetchImpl: async () => { calls++; throw Error('must not fetch') } }), value => value === reason)
    assert.equal(calls, 0)
    await assert.rejects(avaamo.run({ signal: pre.signal, maxJobs: 0 }), value => value === reason)
    const current = new AbortController()
    const work = avaamo.run({ signal: current.signal, requestTimeoutMs: 500, fetchImpl: async url => {
      const res = new Response(new ReadableStream({ pull() { current.abort(reason); return new Promise(() => {}) } }), { headers: { 'content-type': 'text/html' } })
      Object.defineProperty(res, 'url', { value: url }); return res
    } })
    await assert.rejects(work, value => value === reason)
  }
})

test('Avaamo cancels an unused synchronously fulfilled response when monotonic request checks reject it', async () => {
  let cancelled = false
  const reader = createAvaamoReader({ requestTimeoutMs: 5, collectionBudgetMs: 1000, fetchImpl: () => {
    const end = performance.now() + 20; while (performance.now() < end) {}
    return { status: 200, url: opening.finalUrl, headers: new Headers({ 'content-type': 'text/html' }),
      body: { cancel() { cancelled = true; return new Promise(() => {}) } } }
  } })
  try {
    await assert.rejects(reader.read(opening.finalUrl), /request deadline exceeded/)
    assert.equal(cancelled, true)
  } finally { reader.close() }
})

test('Avaamo only exempts qualified responsive alternatives and never erases always-hidden Content styles', () => {
  const packet = rolePacket('applied-ai-engineer'), listing = roleListing('applied-ai-engineer')
  for (const rule of [
    '@media(min-width:0px){.hidden-avaamoalways{display:none!important}}',
    '@media(min-width:1200px){.hidden-avaamoalways{display:none!important}}@media(min-width:810px) and (max-width:1199.98px){.hidden-avaamoalways{display:none!important}}@media(max-width:809.98px){.hidden-avaamoalways{display:none!important}}',
  ]) {
    const html = packet.body.replace('</head>', '<style data-framer-breakpoint-css>' + rule + '</style></head>')
      .replace('class="framer-1p0ln7l" data-framer-name="Content"', 'class="framer-1p0ln7l hidden-avaamoalways" data-framer-name="Content"')
    assert.ok(html !== packet.body)
    assert.throws(() => avaamo.parseAvaamoDetail(html, listing), /Content|visibility|breakpoint|responsive/)
  }
  assert.equal(avaamo.parseAvaamoDetail(packet.body, listing).sourceDetailComplete, true)
  assert.equal(avaamo.extractListingCards(opening.body, opening.finalUrl).length, 12)
})
