import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { parseCurrentIndex, parseCurrentRole, PROFILE } from './currentNative20261119.js'

const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-canonical-20261127.json.gz', import.meta.url))))
const pages = new Map(fixture.records.map(row => [row.requestedUrl, row]))
for (const row of pages.values()) assert.equal(createHash('sha256').update(row.body).digest('hex'), row.sha256)
const listings = parseCurrentIndex(pages.get(PROFILE.indexURL).body)
const url = 'https://jobs.carrier.com/en/job/haryana/associate-manager-commodity-management-and-sourcing/29289/98785688736'
const canonical = 'https://jobs.carrier.com/en/job/gurugram/associate-manager-commodity-management-and-sourcing/29289/98785688736'
const listing = listings.find(row => row.sourceUrl === url)
assert.ok(listing)
const html = pages.get(url).body
const observedAt = '2026-11-27T18:36:00Z'
const changeModel = change => html.replace(/(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/, (_, before, json, after) => {
 const model = JSON.parse(json); change(model); return before + JSON.stringify(model) + after
})

test('the current captured Carrier role retains its published same-role canonical alias and full native authority', () => {
 const fact = parseCurrentRole(html, listing, observedAt)
 assert.equal(fact.publisherJobId, '98785688736')
 assert.equal(fact.sourceUrl, url)
 assert.equal(fact.sourceCanonicalURL, canonical)
 assert.equal(fact.sourceNativeJobPosting.url, url)
 assert.equal(fact.country, 'India')
 assert.equal(fact.nativeEmployerDisplayName, 'Carrier')
 assert.equal(fact.sourceNativeDocumentHTML, html)
 assert.equal(fact.sourceScopeComplete, false)
 assert.equal(fact.lifecycleCleanupAllowed, false)
 assert.equal(fact.backendApplicationActivationVerified, false)
})

for (const [label, replacement] of [
 ['foreign host', canonical.replace('jobs.carrier.com', 'example.org')],
 ['another publisher id', canonical.replace('98785688736', '98785688737')],
 ['another role slug', canonical.replace('associate-manager-commodity-management-and-sourcing', 'another-role')],
 ['unreviewed location alias', canonical.replace('/gurugram/', '/another-location/')],
 ['query', canonical + '?other=1'],
 ['fragment', canonical + '#other'],
]) test('the observed alias does not authorize a ' + label + ' canonical', () => {
 assert.throws(() => parseCurrentRole(html.replace(canonical, replacement), listing, observedAt), /Foreign or ambiguous native canonical/)
})

test('a second canonical remains ambiguous even when the reviewed alias is present', () => {
 assert.throws(() => parseCurrentRole(html.replace('</head>', `<link rel="canonical" href="${canonical}"></head>`), listing, observedAt), /Foreign or ambiguous native canonical/)
})

test('canonical aliasing cannot substitute a different employer, native role URL or workplace country', () => {
 for (const change of [
  model => { model.hiringOrganization.name = 'Other employer' },
  model => { model.url = canonical },
  model => { model.title = 'Other role' },
  model => { model.jobLocation[0].address.addressCountry = 'US' },
 ]) assert.throws(() => parseCurrentRole(changeModel(change), listing, observedAt))
})

test('all eight original captured roles parse without asserting that the remaining listed roles were captured', () => {
 const captured = listings.filter(row => pages.has(row.sourceUrl))
 assert.equal(captured.length, 8)
 assert.ok(listings.length > captured.length, 'The original probe stopped at this guard before the complete first page')
 for (const row of captured) {
  const fact = parseCurrentRole(pages.get(row.sourceUrl).body, row, observedAt)
  assert.equal(fact.country, 'India')
  assert.equal(fact.sourceScopeComplete, false)
  assert.equal(fact.lifecycleCleanupAllowed, false)
 }
})
