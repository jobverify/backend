import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { document } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { run } from './script.js'

const original = JSON.parse(gunzipSync(readFileSync(new URL('./test-data/native-20261103.json.gz', import.meta.url))))
const native = JSON.parse(gunzipSync(readFileSync(new URL('./test-data/positive-native-20261106/native-dom.json.gz', import.meta.url))))
const search = 'https://careers.airindia.com/aix/search/?q=&locationsearch='
const continuation = 'https://careers.airindia.com/aix/tile-search-results/?q=&sortColumn=referencedate&sortDirection=desc&startrow=1'
const ids = ['52901044', '56097544']
const d = document(native.listing.body), list = d.nodes(node => node.attrs.id === 'job-tile-list')[0]
const tiles = ids.map((id, index) => d.outer(d.nodes(node => d.hasClass(node, 'job-id-' + id))[0])
  .replace(/data-row-index="\d+"/, 'data-row-index="' + (index + 1) + '"')
  .replace(/job-row-index-\d+/, 'job-row-index-' + (index + 1)))

// These are counterfactual unit-test inputs, never live India evidence: retain
// genuine native tile/detail DOM, but bind the listing to AIX and type IN.
function controlledListing(pageSize = 2) {
  return native.listing.body.replace(d.inner(list), tiles.slice(0, pageSize).join('\n'))
    .replace(/(<body\b[^>]*class=")([^"]*)"/, '$1$2 bodyaix"')
    .replace(/("brand"\s*:\s*)""/, '$1"aix"')
    .replaceAll('action="/search/"', 'action="/aix/search/"')
    .replace('href="https://careers.airindia.com/search/"', 'href="https://careers.airindia.com/aix/search/"')
    .replaceAll('Showing 1 to 12 of 12 Jobs', 'Showing 1 to ' + pageSize + ' of 2 Jobs')
    .replace('data-per-page="25"', 'data-per-page="' + pageSize + '"')
    .replace('data-record-returned="12"', 'data-record-returned="' + pageSize + '"')
    .replace('jobRecordsPerPage: parseInt("25")', 'jobRecordsPerPage: parseInt("' + pageSize + '")')
    .replace('jobRecordsFound: parseInt("12")', 'jobRecordsFound: parseInt("2")')
}

function fixture({ pageSize = 2, rawCountries = false, change = () => {} } = {}) {
  const base = new Map(original.map(packet => [packet.requestedUrl, packet]))
  const visits = new Map(), requests = []
  const fetchPage = async url => {
    const visit = (visits.get(url) || 0) + 1
    visits.set(url, visit); requests.push(url)
    let packet
    if (url === search) packet = { status: 200, url, body: controlledListing(pageSize) }
    else if (url === continuation && pageSize === 1) packet = { status: 200, url, body: tiles[1] }
    else if (native.details.some(detail => detail.url === url)) {
      const detail = native.details.find(detail => detail.url === url)
      packet = { status: 200, url, body: rawCountries ? detail.body
        : detail.body.replace(/itemprop="addressCountry" content="(?:No|HO)"/, 'itemprop="addressCountry" content="IN"') }
    } else {
      assert.ok(base.has(url), 'Only corporate-declared or native-listed URLs may be read: ' + url)
      packet = structuredClone(base.get(url))
    }
    change(packet, { url, visit })
    return packet
  }
  let audit
  return { requests, run: async () => ({ jobs: await run({ fetchPage, now: () => '2026-11-06T12:00:00.000Z', onAudit: value => { audit = value } }), audit }) }
}

test('controlled native AIX tiles with valid typed India details emit full roles and retain incomplete company scope', async () => {
  const f = fixture(), { jobs, audit } = await f.run()
  assert.deepEqual(jobs.map(job => job.nativePublicJobId).sort(), ids)
  assert.deepEqual(jobs.map(job => job.requisitionId).sort(), ['18451', '20113'])
  assert.ok(jobs.every(job => job.country === 'India' && job.company === 'Air India Express'
    && job.jobDescription.includes('Stages of Selection') && job.jobDescription.includes('eGCA-id')
    && job.sourceDetailComplete && job.sourceListingComplete === false
    && job.sourceScopeComplete === false && job.lifecycleCleanupAllowed === false))
  assert.equal(jobs[0].postingDate, '2026-10-10T02:00:00.000Z')
  assert.equal(jobs[0].applyUrl, 'https://careers.airindia.com/talentcommunity/apply/52901044/?locale=en_US')
  assert.equal(audit.observedListingCount, 2)
  assert.equal(audit.sourceCompanyWideScopeComplete, false)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'coverage-gap')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
})

test('controlled native load-more pages reconcile indices, IDs and closing membership', async () => {
  const f = fixture({ pageSize: 1 }), { jobs, audit } = await f.run()
  assert.equal(jobs.length, 2)
  assert.equal(f.requests.filter(url => url === continuation).length, 3)
  assert.equal(audit.closingInventoryMatches, true)
  assert.equal(audit.listingPaginationComplete, true)
})

for (const [index, code] of [[0, 'No'], [1, 'HO']]) test('the actual ' + code + ' typed country cannot be inferred as India or treated as verified foreign', async () => {
  await assert.rejects(fixture({ change: (packet, { url }) => {
    if (url === native.details[index].url) packet.body = native.details[index].body
  } }).run(), /country|ISO/i)
})

test('explicit valid foreign countries yield an incomplete positive inventory rather than a company India zero', async () => {
  const { jobs, audit } = await fixture({ change: (packet, { url }) => {
    if (native.details.some(detail => detail.url === url)) packet.body = packet.body.replace('itemprop="addressCountry" content="IN"', 'itemprop="addressCountry" content="US"')
  } }).run()
  assert.equal(jobs.length, 0)
  assert.equal(audit.observedListingCount, 2)
  assert.equal(audit.excludedRoles.length, 2)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
})

for (const [name, change] of [
  ['listing count mismatch', (packet, { url }) => { if (url === search) packet.body = packet.body.replaceAll('of 2 Jobs', 'of 3 Jobs') }],
  ['contradictory responsive title', (packet, { url }) => { if (url === search) packet.body = packet.body.replace('A320 Type Rated Co-Pilots (First Officer / Senior First Officer)', 'Different role') }],
  ['unbound search initializer', (packet, { url }) => { if (url === search) packet.body = packet.body.replace('j2w.SearchResults.init({', 'if(false) j2w.SearchResults.init({') }],
  ['filtered pagination query', (packet, { url }) => { if (url === search) packet.body = packet.body.replace('searchQuery: "?q=&', 'searchQuery: "?q=engineer&') }],
  ['canonical public identity mismatch', (packet, { url }) => { if (url === native.details[0].url) packet.body = packet.body.replace('rel="canonical" href="' + url + '"', 'rel="canonical" href="https://careers.airindia.com/job/Other/12345/"') }],
  ['application identity mismatch', (packet, { url }) => { if (url === native.details[0].url) packet.body = packet.body.replaceAll('/talentcommunity/apply/52901044/', '/talentcommunity/apply/12345/') }],
  ['application query injection', (packet, { url }) => { if (url === native.details[0].url) packet.body = packet.body.replaceAll('?locale=en_US', '?locale=en_US&amp;redirect=https://other.example/') }],
  ['wrong employer', (packet, { url }) => { if (url === native.details[0].url) packet.body = packet.body.replace('itemprop="hiringOrganization" content="Air India Careers"', 'itemprop="hiringOrganization" content="Other Airline"') }],
  ['missing explicit AIX opportunity', (packet, { url }) => { if (url === native.details[0].url) packet.body = packet.body.replace('This opportunity is with Air India Express.', 'This opportunity is with Air India.') }],
  ['country from an unrelated city', (packet, { url }) => { if (url === native.details[0].url) packet.body = packet.body.replace('itemprop="addressLocality" content="Gurugram"', 'itemprop="addressLocality" content="London"') }],
  ['explicit foreign listing country', (packet, { url }) => { if (url === search) packet.body = packet.body.replaceAll('Gurugram, Gurugram, Northern', 'Gurugram, United States').replaceAll('Gurugram, Gurugram, HO', 'Gurugram, United States') }],
  ['visible detail city conflict', (packet, { url }) => { if (url === native.details[0].url) packet.body = packet.body.replace(/(data-careersite-propertyid="city"[^>]*>)\s*Gurugram/, '$1London') }],
  ['unreviewed typed street address country', (packet, { url }) => { if (url === native.details[0].url) packet.body = packet.body.replace('itemprop="addressCountry" content="IN">', 'itemprop="addressCountry" content="IN"><meta itemprop="streetAddress" content="London, United Kingdom">') }],
  ['missing full description', (packet, { url }) => { if (url === native.details[0].url) packet.body = packet.body.replace('itemprop="description"', 'itemprop="summary"') }],
  ['invalid native date weekday', (packet, { url }) => { if (url === native.details[0].url) packet.body = packet.body.replace('Sat Oct 10 02:00:00 UTC 2026', 'Sun Oct 10 02:00:00 UTC 2026') }],
  ['future native date', (packet, { url }) => { if (url === native.details[0].url) packet.body = packet.body.replace('Sat Oct 10 02:00:00 UTC 2026', 'Wed Nov 10 02:00:00 UTC 2027') }],
  ['closing full-description edit', (packet, { url, visit }) => { if (url === native.details[0].url && visit === 2) packet.body = packet.body.replace('Maximum Age Limit', 'Changed Age Limit') }],
  ['closing listing requisition edit', (packet, { url, visit }) => { if (url === search && visit === 2) packet.body = packet.body.replaceAll('18451', '99999') }],
  ['final listing edit after closing details', (packet, { url, visit }) => { if (url === search && visit === 3) packet.body = packet.body.replaceAll('18451', '99999') }],
]) test('controlled positive AIX rejects ' + name, async () => {
  await assert.rejects(fixture({ change }).run(), /AIX|native|listing|role|posting|canonical|application|employer|country|date|closing|initializer|query/i)
})

test('controlled continuation cannot repeat a native public identity', async () => {
  await assert.rejects(fixture({ pageSize: 1, change: (packet, { url }) => {
    if (url === continuation) packet.body = tiles[0].replaceAll('job-row-index-1', 'job-row-index-2').replace('data-row-index="1"', 'data-row-index="2"')
  } }).run(), /duplicate|identity/i)
})

test('a native positive search initializer without its role tiles cannot certify zero', async () => {
  const positiveScript = d.outer(d.nodes(node => node.tag === 'script' && (node.raw || '').includes('j2w.SearchResults.init'))[0])
  const packets = new Map(original.map(packet => [packet.requestedUrl, packet]))
  await assert.rejects(run({ fetchPage: async url => {
    const packet = structuredClone(packets.get(url))
    if (url === search) packet.body = packet.body.replace('</body>', positiveScript + '</body>')
    return packet
  } }), /positive|initializer|count/i)
})
