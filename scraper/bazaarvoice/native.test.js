import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { run, readBazaarvoiceProof, fetchBazaarvoicePacket } from './native.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { inventoryCleanupOptions } from '../../scraper-support/utils/scraperOutcome.js'
import { extractionDetailHealth } from '../../scraper-support/utils/extractionDetailHealth.js'
import { buildScrapers } from '../../scraper-support/providers/index.js'

const root = new URL('./native-captures/', import.meta.url)
const manifest = JSON.parse(readFileSync(new URL('manifest.json', root)))
const API = 'https://api.lever.co/v0/postings/bazaarvoice?mode=json'
const CAREERS = 'https://www.bazaarvoice.com/company/careers/'
const ACCOUNT = '714170d1-1117-4943-89d7-fa08f7e6af25'
const hash = value => createHash('sha256').update(value).digest('hex')
const captured = entry => {
  const body = gunzipSync(readFileSync(new URL(entry.file, root))).toString('utf8')
  assert.equal(hash(body), entry.sha256)
  return { ...entry, body }
}
const rewrite = (packet, body, headers = packet.headers) => ({ ...packet, body, headers, bytes: Buffer.byteLength(body), sha256: hash(body) })
const sourceRows = () => JSON.parse(captured(manifest.find(entry => entry.file === 'native.gz')).body)
const mockPackets = ({ rows, primary, loader, detail, application, closing, headers } = {}) => {
  let listingReads = 0, terminalReads = 0
  return async url => {
    if (url === API) listingReads++
    if (url.startsWith(API + '&limit=10&skip=')) terminalReads++
    const entry = url.startsWith(API + '&limit=10&skip=')
      ? manifest.find(item => item.file === (terminalReads === 1 ? 'opening-terminal.gz' : 'closing-terminal.gz')) : url === API
      ? manifest.find(item => item.file === (listingReads === 1 ? 'native.gz' : 'closing-native.gz'))
      : manifest.find(item => item.url === url)
    assert.ok(entry, 'Unexpected request: ' + url)
    let packet = captured(entry)
    if (url === CAREERS && primary) packet = rewrite(packet, primary(packet.body))
    if (url.includes('/wp-content/') && loader) packet = rewrite(packet, loader(packet.body))
    if (url === API) {
      const values = rows ? rows(sourceRows()) : sourceRows()
      packet = rewrite(packet, JSON.stringify(listingReads > 1 && closing ? closing(values) : values), headers ? { ...packet.headers, ...headers } : packet.headers)
    }
    if (/jobs\.lever\.co/.test(url) && !url.endsWith('/apply') && detail) packet = rewrite(packet, detail(packet.body, url))
    if (url.endsWith('/apply') && application) packet = rewrite(packet, application(packet.body, url))
    return { ...packet, url }
  }
}
const evidence = jobs => readInventoryEvidence(jobs)
const htmlEscape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;')
const indiaRow = () => ({ ...sourceRows()[8], country: 'IN', categories: { ...sourceRows()[8].categories, location: 'Bengaluru, India', allLocations: ['Bengaluru, India'] } })
const indiaContent = row => row.description + row.lists.map(list => '<h3>' + list.text + '</h3>' + list.content).join('') + (row.salaryDescription || '') + row.additional
const indiaDetail = row => {
  const content = indiaContent(row)
  const schema = { '@context': 'http://schema.org', '@type': 'JobPosting', title: row.text, hiringOrganization: { name: 'Bazaarvoice' },
    jobLocation: { address: { addressLocality: 'Bengaluru, India', addressCountry: 'IN' } }, description: content, datePosted: '2026-10-29' }
  return '<html><head><title>Bazaarvoice - ' + row.text + '</title><script type="application/ld+json">' + JSON.stringify(schema) + '</script></head><body><h2>' + htmlEscape(row.text) + '</h2>'
    + '<div class="posting-category location">Bengaluru, India</div><a class="postings-btn template-btn-submit" href="' + row.applyUrl + '">Apply for this job</a>'
    + '<div class="section page-centered" data-qa="job-description">' + content + '</div></body></html>'
}
const indiaApplication = row => '<html><head><title>Bazaarvoice - ' + row.text + '</title></head><body><h2>' + htmlEscape(row.text) + '</h2><div class="posting-category location">Bengaluru, India</div>'
  + '<form id="application-form" method="POST"><input type="hidden" name="accountId" value="' + ACCOUNT + '"><input name="name"><input name="email"><button id="btn-submit" type="button">Submit application</button></form></body></html>'
const withIndia = options => {
  const row = indiaRow()
  const base = mockPackets({ ...options, rows: values => values.map(value => value.id === row.id ? row : value) })
  return async url => {
    const packet = await base(url)
    return url === row.hostedUrl ? rewrite(packet, indiaDetail(row)) : url === row.applyUrl ? rewrite(packet, indiaApplication(row)) : packet
  }
}

test('current retained public source reconciles nine roles and zero India without inventing a reported total or empty source', async () => {
  const jobs = await run({ readPacket: mockPackets() })
  assert.equal(jobs.length, 0)
  assert.deepEqual(evidence(jobs), {
    status: 'complete-inventory', surface: API, firstParty: true, listingComplete: true, pagesFetched: 1,
    reportedTotal: null, indiaFacetCount: 0, verifiedAt: manifest.find(item => item.file === 'closing-terminal.gz').completedAt,
    reason: 'current-unfiltered-bazaarvoice-public-inventory-and-native-location-identities-reconciled',
  })
  const proof = readBazaarvoiceProof(jobs)
  assert.equal(proof.observedListingCount, 9)
  assert.equal(proof.sourceScopeComplete, true)
  assert.equal(proof.retainedResponses.length, 24)
  assert.equal(proof.countryRelations.find(value => value.locationId === '1c5655f8-e728-4eb8-8051-ea29b21c40ff').country, 'United States')
  assert.equal(proof.wholeCompanyScopeComplete, false)
  assert.equal(proof.legalEmployer, null)
})

test('secondary city labels require the same native location UUID to have an independent typed primary country', async () => {
  const jobs = await run({ readPacket: mockPackets({ rows: values => values.filter(row => row.id !== '79343030-69a8-48c4-8637-dc626163c268') }) })
  assert.equal(evidence(jobs).listingComplete, false)
  assert.equal(evidence(jobs).indiaFacetCount, null)
  assert.match(evidence(jobs).reason, /unresolved-native-location-country/)
  assert.deepEqual(inventoryCleanupOptions({ inventoryEvidence: evidence(jobs) }), { replaceExisting: false })
})

test('a changed secondary location UUID cannot inherit a country from the city label', async () => {
  const jobs = await run({ readPacket: mockPackets({ application: (body, url) => url.includes('a46c197d') ? body.replace('1c5655f8-e728-4eb8-8051-ea29b21c40ff', '99999999-9999-4999-8999-999999999999') : body }) })
  assert.equal(evidence(jobs).listingComplete, false)
  assert.match(evidence(jobs).reason, /unresolved-native-location-country/)
})

test('a future India posting preserves full native description, explicit country, actual apply URL and schema publication precision', async () => {
  const jobs = await run({ readPacket: withIndia() })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].location, 'Bengaluru, India')
  assert.equal(jobs[0].applyUrl, indiaRow().applyUrl)
  assert.equal(jobs[0].postingDate, '2026-10-29T00:00:00.000Z')
  assert.equal(jobs[0].sourcePostedDatePrecision, 'day')
  assert.equal(jobs[0].closingDate, null)
  assert.ok(jobs[0].jobDescription.includes('First point of contact'))
  assert.ok(jobs[0].jobDescription.includes('Who You Are'))
  assert.equal(jobs[0].sourceDetailComplete, true)
  assert.equal(jobs[0].sourceListingComplete, true)
  assert.equal(jobs[0].sourceScopeComplete, true)
  assert.equal(jobs[0].lifecycleCleanupAllowed, true)
  assert.equal(extractionDetailHealth(jobs).complete, true)
  assert.equal(evidence(jobs).indiaFacetCount, 1)
})

for (const [name, changes, reason] of [
  ['filtered careers component', { primary: body => body.replace('data-location="All locations"', 'data-location="Austin"') }, /unfiltered/],
  ['changed active loader request', { loader: body => body.replace('?mode=json', '?mode=json&limit=1') }, /controller/],
  ['additional active ATS', { primary: body => body.replace('</body>', '<a href="https://boards.greenhouse.io/another-employer">Current job openings</a></body>') }, /additional-recruiting/],
  ['additional first party job inventory', { primary: body => body.replace('</body>', '<a href="/other-open-roles/">Apply for our open roles</a></body>') }, /additional-recruiting/],
  ['new unreviewed executable inventory', { primary: body => body.replace('</body>', '<script>fetch("/public-hiring/").then(renderHiring)</script></body>') }, /additional-recruiting/],
  ['additional in-page job inventory', { primary: body => body.replace('</body>', '<a href="#another-list">Current job openings</a><section id="another-list">Extra roles</section></body>') }, /additional-recruiting/],
  ['unconsumed native pagination', { headers: { link: '<https://api.lever.co/v0/postings/bazaarvoice?skip=9>; rel="next"' } }, /continuation/],
  ['closing identity change', { closing: values => values.slice(1) }, /closing/],
]) test(name + ' retains independent positive India evidence and disables cleanup', async () => {
  const jobs = await run({ readPacket: withIndia(changes) })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].sourceListingComplete, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
  assert.equal(evidence(jobs).listingComplete, false)
  assert.match(evidence(jobs).reason, reason)
  assert.deepEqual(inventoryCleanupOptions({ inventoryEvidence: evidence(jobs) }), { replaceExisting: false })
})

for (const [name, transform] of [
  ['hidden detail content', body => body.replace('data-qa="job-description"', 'style="display:none" data-qa="job-description"')],
  ['wrong employer', body => body.replace('"name":"Bazaarvoice"', '"name":"Another Employer"')],
  ['wrong role apply URL', body => body.replace('/384c449d-9625-47a6-afd6-70323a46dbb8/apply', '/99999999-9999-4999-8999-999999999999/apply')],
  ['visible closed notice', body => body.replace('</body>', '<p>This job is no longer available.</p></body>')],
]) test(name + ' never becomes a publishable India posting', async () => {
  const base = withIndia()
  const jobs = await run({ readPacket: async url => { const packet = await base(url); return url === indiaRow().hostedUrl ? rewrite(packet, transform(packet.body)) : packet } })
  assert.equal(jobs.length, 0)
  assert.equal(evidence(jobs).listingComplete, false)
  assert.equal(evidence(jobs).indiaFacetCount, null)
})

test('missing publication date stays unknown instead of using API createdAt or replay time', async () => {
  const base = withIndia()
  const jobs = await run({ readPacket: async url => { const packet = await base(url); return url === indiaRow().hostedUrl ? rewrite(packet, packet.body.replace(',"datePosted":"2026-10-29"', '')) : packet } })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].postingDate, null)
  assert.equal(jobs[0].nativeCreatedAt, indiaRow().createdAt)
  assert.equal(jobs[0].sourcePostedDatePrecision, null)
  assert.equal(evidence(jobs).verifiedAt, manifest.find(item => item.file === 'closing-terminal.gz').completedAt)
})

test('a closing response failure keeps an already verified positive and its captured raw bodies', async () => {
  const base = withIndia(); let reads = 0
  const jobs = await run({ readPacket: async url => { if (url === API && ++reads === 2) throw new Error('Closing unavailable'); return base(url) } })
  assert.equal(jobs.length, 1)
  assert.equal(evidence(jobs).listingComplete, false)
  assert.match(evidence(jobs).reason, /closing/)
  assert.ok(readBazaarvoiceProof(jobs).retainedResponses.every(packet => packet.body && hash(packet.body) === packet.sha256))
})

test('a genuinely empty full native public source has an independently reconciled empty state', async () => {
  const jobs = await run({ readPacket: mockPackets({ rows: () => [] }) })
  assert.equal(evidence(jobs).status, 'verified-empty')
  assert.equal(evidence(jobs).reportedTotal, null)
  assert.equal(evidence(jobs).indiaFacetCount, 0)
})

test('exact caller cancellation survives pre-abort and an injected reader that ignores its signal', async () => {
  for (const pre of [true, false]) {
    const controller = new AbortController(), reason = { cancelledByCaller: pre }
    if (pre) controller.abort(reason)
    const pending = run({ signal: controller.signal, readPacket: () => new Promise(() => {}) })
    if (!pre) setTimeout(() => controller.abort(reason), 10)
    await assert.rejects(pending, error => error === reason)
  }
})

test('an ignored packet-reader deadline ends the source without a complete claim', async () => {
  const jobs = await run({ readPacket: () => new Promise(() => {}), requestTimeoutMs: 10 })
  assert.equal(evidence(jobs).listingComplete, false)
  assert.match(evidence(jobs).reason, /timeout/)
})

for (const status of [403, 429, 302]) test('manual transport retains HTTP ' + status + ' without retries or redirect bypass', async () => {
  let calls = 0
  await assert.rejects(fetchBazaarvoicePacket(CAREERS, { fetchImpl: async (url, options) => {
    calls++; assert.equal(options.redirect, 'manual'); assert.equal(options.method, 'GET')
    return new Response('native denial', { status, headers: { 'content-type': 'text/html', 'retry-after': '31', location: 'https://other.invalid/' } })
  } }), error => error.status === status && error.abortRetries === true && error.retainedResponse.body === 'native denial')
  assert.equal(calls, 1)
})

test('body read cancellation preserves the exact caller reason and cancels the stream', async () => {
  const controller = new AbortController(), reason = new Error('caller body cancellation'); let cancelled = false
  const pending = fetchBazaarvoicePacket(CAREERS, { signal: controller.signal, fetchImpl: async () => new Response(new ReadableStream({
    start(stream) { stream.enqueue(new TextEncoder().encode('partial')); setTimeout(() => controller.abort(reason), 10) },
    cancel(value) { cancelled = value === reason },
  }), { headers: { 'content-type': 'text/html' } }) })
  await assert.rejects(pending, error => error === reason)
  assert.equal(cancelled, true)
})

test('response and aggregate byte limits disable completeness instead of parsing a truncated body', async () => {
  await assert.rejects(fetchBazaarvoicePacket(CAREERS, { maximumBytes: 2, fetchImpl: async () => new Response('oversized') }), /byte/)
  const jobs = await run({ readPacket: mockPackets(), maxAggregateBytes: 160000 })
  assert.equal(evidence(jobs).listingComplete, false)
  assert.match(evidence(jobs).reason, /byte/)
})

test('registered run preserves its runner contract and exports retained proof to an audit sink', async () => {
  let proof
  const scraper = buildScrapers().find(value => value.name === 'bazaarvoice')
  const jobs = await scraper.run({ readPacket: mockPackets(), onProof: value => { proof = value } })
  assert.equal(evidence(jobs).status, 'complete-inventory')
  assert.equal(proof.retainedResponses.length, 24)
  assert.equal(proof.facts.every(value => value.sourceScopeComplete && value.lifecycleCleanupAllowed), true)
})

test('unknown foreign primary country retains independent India evidence and disables zero and cleanup claims', async () => {
  const row = indiaRow(), base = withIndia()
  const jobs = await run({ readPacket: async url => {
    const packet = await base(url)
    if (url !== API) return packet
    const values = JSON.parse(packet.body); values[2].country = 'XX'
    return rewrite(packet, JSON.stringify(values))
  } })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, row.id)
  assert.equal(evidence(jobs).listingComplete, false)
  assert.match(evidence(jobs).reason, /unknown-native-primary-country/)
})

test('conflicting native primary UUID countries never borrow a country across accounts or labels', async () => {
  const base = withIndia()
  const jobs = await run({ readPacket: async url => {
    let packet = await base(url)
    if (url === API) { const values = JSON.parse(packet.body); values[7].country = 'IN'; packet = rewrite(packet, JSON.stringify(values)) }
    if (url.includes('79343030') && url.endsWith('/apply')) packet = rewrite(packet, packet.body.replaceAll('1c5655f8-e728-4eb8-8051-ea29b21c40ff', '115ebae7-5b56-418d-98b6-bc5ce067142c'))
    return packet
  } })
  assert.equal(jobs.length, 1)
  assert.equal(evidence(jobs).listingComplete, false)
  assert.match(evidence(jobs).reason, /conflicting-native-location-country/)
})

for (const [name, transform] of [
  ['foreign application account', body => body.replace(ACCOUNT, '99999999-9999-4999-8999-999999999999')],
  ['disabled native form', body => body.replace('id="btn-submit"', 'disabled id="btn-submit"')],
]) test(name + ' cannot publish an otherwise valid India role', async () => {
  const base = withIndia()
  const jobs = await run({ readPacket: async url => { const packet = await base(url); return url === indiaRow().applyUrl ? rewrite(packet, transform(packet.body)) : packet } })
  assert.equal(jobs.length, 0)
  assert.equal(evidence(jobs).listingComplete, false)
})

test('a source deadline bounds a reader that ignores cancellation', async () => {
  const jobs = await run({ sourceTimeoutMs: 10, readPacket: () => new Promise(() => {}) })
  assert.equal(evidence(jobs).listingComplete, false)
  assert.match(evidence(jobs).reason, /source-timeout/)
})

test('an injected HTTP denial is classified and stops all further requests', async () => {
  let requests = 0
  const packet = captured(manifest.find(entry => entry.file === 'current.gz'))
  const jobs = await run({ readPacket: async () => { requests++; return { ...packet, status: 429 } } })
  assert.equal(requests, 1)
  assert.equal(readBazaarvoiceProof(jobs).failures[0].status, 429)
  assert.equal(evidence(jobs).listingComplete, false)
})

for (const [name, markup] of [
  ['hidden raw script', '<script hidden>fetch("/public-hiring/").then(renderHiring)</script>'],
  ['inert ancestor raw script', '<div inert><script>fetch("/public-hiring/").then(renderHiring)</script></div>'],
  ['CSS-hidden ancestor raw script', '<style>.new-hiring {display:none}</style><div class="new-hiring"><script>fetch("/public-hiring/").then(renderHiring)</script></div>'],
  ['mixed case JavaScript MIME', '<script type="Text/JavaScript">fetch("/public-hiring/").then(renderHiring)</script>'],
  ['legacy JavaScript MIME', '<script type="application/x-javascript">fetch("/public-hiring/").then(renderHiring)</script>'],
  ['JavaScript language alias', '<script language="JavaScript1.2">fetch("/public-hiring/").then(renderHiring)</script>'],
  ['mixed case module', '<script type="MoDuLe">fetch("/public-hiring/").then(renderHiring)</script>'],
  ['opaque unreviewed raw script', '<script type="text/unreviewed-script-alias">fetch("/public-hiring/").then(renderHiring)</script>'],
]) test(name + ' cannot conceal an additional controller while retaining an independent India positive', async () => {
  const jobs = await run({ readPacket: withIndia({ primary: body => body.replace('</body>', markup + '</body>') }) })
  assert.equal(jobs.length, 1)
  assert.equal(evidence(jobs).listingComplete, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
})

test('a reviewed controller body in a nonexecuting data script cannot bind the public inventory', async () => {
  const jobs = await run({ readPacket: withIndia({ primary: body => body.replace('id="bazaarvoice-app-js"', 'type="application/json" id="bazaarvoice-app-js"') }) })
  assert.equal(jobs.length, 1)
  assert.equal(evidence(jobs).listingComplete, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
})

for (const [name, css] of [
  ['commented print token', '@media screen { /* @media print { */ [data-qa="job-description"] {display:none} }'],
  ['quoted print token', '.decoration::before {content:"@media print {"} @media screen {[data-qa="job-description"] {display:none}}'],
]) test(name + ' never removes a real screen rule that hides the full description', async () => {
  const base = withIndia()
  const jobs = await run({ readPacket: async url => {
    const packet = await base(url)
    return url === indiaRow().hostedUrl ? rewrite(packet, packet.body.replace('</head>', '<style>' + css + '</style></head>')) : packet
  } })
  assert.equal(jobs.length, 0)
  assert.equal(evidence(jobs).listingComplete, false)
})

for (const [name, markup] of [
  ['unknown language', '<script language="not-a-browser-language">fetch("/public-hiring/").then(renderHiring)</script>'],
  ['template context', '<template><script>fetch("/public-hiring/").then(renderHiring)</script></template>'],
  ['noscript context', '<noscript><script>fetch("/public-hiring/").then(renderHiring)</script></noscript>'],
  ['whitespace type', '<script type=" ">fetch("/public-hiring/").then(renderHiring)</script>'],
  ['MIME parameters', '<script type="text/javascript;charset=utf-8">fetch("/public-hiring/").then(renderHiring)</script>'],
]) test('positively inert ' + name + ' does not hide or create another recruiting source', async () => {
  const jobs = await run({ readPacket: withIndia({ primary: body => body.replace('</body>', markup + '</body>') }) })
  assert.equal(jobs.length, 1)
  assert.equal(evidence(jobs).listingComplete, true)
})
