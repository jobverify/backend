import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { createEyScraper, extractJobDetail } from './script.js'
import { sourceLifecycleCleanupForbidden } from '../../scraper-support/utils/inventoryEvidence.js'

const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('../../test/fixtures/ey-closures-20261112.json.gz', import.meta.url))))
const session = JSON.parse(gunzipSync(fs.readFileSync(new URL('../../test/fixtures/ey-session-20261112.json.gz', import.meta.url))))
const closed = fixture.packets[0]
const active = session.packets.find(packet => packet.requestedUrl.includes('/ey/job/'))
const proof = (body = closed.body, listing = closed.listing) => extractJobDetail(body, listing).nativeClosure ?? null
// Controlled one-advertisement transport contract, using the retained native role.
const listingPage = listing => `<span class="paginationLabel">1 to 1 of 1</span><span class="srHelp">Page 1 of 1</span>
  <tr class="data-row"><a class="jobTitle-link" href="${listing.sourceUrl}">${listing.title}</a><span class="jobLocation">${listing.location}</span></tr>`

test('all four retained EY missing-detail pages have exact native closure evidence', () => {
  assert.equal(fixture.packets.length, 4)
  for (const packet of fixture.packets) {
    assert.equal(createHash('sha256').update(packet.body).digest('hex'), packet.hash)
    const result = extractJobDetail(packet.body, packet.listing)
    assert.equal(result.nativeClosure?.method, 'native-role-page-explicit-unavailable')
    assert.equal(result.nativeClosure?.jobId, packet.listing.jobId)
    assert.equal(result.nativeClosure?.sourceUrl, packet.requestedUrl)
    assert.equal(result.nativeClosure?.bodySha256, packet.hash)
    assert.equal(result.nativeClosure?.message, 'The Job is no longer available.')
  }
})

test('EY omits only the proven closed advertisement and preserves its closure audit', async () => {
  const jobs = await createEyScraper().run({ fetchText: async url => url.includes('/search/')
    ? listingPage(closed.listing) : closed.body })
  assert.equal(jobs.length, 0)
  const audit = jobs[Symbol.for('jobverify.ey-native-closures')]
  assert.equal(audit?.closedCount, 1)
  assert.equal(audit?.records[0]?.jobId, closed.listing.jobId)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
})

test('an unavailable EY role has no invented /null application URL', () => {
  assert.equal(extractJobDetail(closed.body, closed.listing).applyUrl, null)
})

for (const [name, alter] of [
  ['hidden native message', body => body.replace('<div class="job">', '<div class="job" hidden>')],
  ['stylesheet-hidden native message', body => body.replace('</head>', '<style>.job { display:none }</style></head>')],
  ['additional hidden body', body => body.replace('</head>', '<style>body { display:none }</style></head>')],
  ['missing native top-level reveal script', body => body.replace(/<script type="text\/javascript" id="antiClickJackScript">[\s\S]*?<\/script>/, '')],
  ['changed native top-level reveal condition', body => body.replace('if (self === top)', 'if (false)')],
  ['inert native reveal carrier', body => body.replace('type="text/javascript" id="antiClickJackScript"', 'type="application/json" id="antiClickJackScript"')],
  ['external native reveal carrier', body => body.replace('id="antiClickJackScript"', 'id="antiClickJackScript" src="/unused.js"')],
  ['nomodule native reveal carrier', body => body.replace('id="antiClickJackScript"', 'id="antiClickJackScript" nomodule')],
  ['template-only native message', body => body.replace('<div class="job">', '<div class="job"><template>').replace('The Job is no longer available.</strong></p>', 'The Job is no longer available.</strong></p></template>')],
  ['wrong native canonical identity', body => body.replace(`rel="canonical" href="${closed.requestedUrl}"`, 'rel="canonical" href="https://careers.ey.com/ey/job/Different-role/9999999999/"')],
  ['foreign canonical authority', body => body.replace(`rel="canonical" href="${closed.requestedUrl}"`, `rel="canonical" href="${closed.requestedUrl.replace('careers.ey.com', 'outside.example')}"`)],
  ['wrong native title', body => body.replace(/<title>[\s\S]*?<\/title>/, '<title>Other role Job Details | EY</title>')],
  ['missing native canonical', body => body.replace(/<link rel="canonical"[^>]*>/, '')],
  ['ambiguous native canonical', body => body.replace('</head>', `<link rel="canonical" href="${closed.requestedUrl}"></head>`) ],
]) {
  test(`EY does not treat ${name} as a role closure`, () => {
    const body = alter(closed.body)
    assert.notEqual(body, closed.body)
    assert.equal(proof(body), null)
  })
}

test('EY cannot bind closure proof to a foreign requested role authority', () => {
  assert.equal(proof(closed.body, { ...closed.listing, sourceUrl: closed.requestedUrl.replace('careers.ey.com', 'outside.example') }), null)
})

test('an active full native description containing a quoted closure message remains active', () => {
  const body = active.body.replace(/(itemprop="description"[^>]*>)/, '$1<p>The Job is no longer available.</p>')
  assert.notEqual(body, active.body)
  assert.equal(proof(body, { ...closed.listing, sourceUrl: active.requestedUrl }), null)
  assert.match(extractJobDetail(body).jobDescription, /Guidewire|JUTRO/i)
})

test('empty and challenge role responses remain unresolved jobs with cleanup forbidden', async () => {
  for (const body of ['', '<html><title>Verify you are human</title><main>Checking your browser</main></html>']) {
    const jobs = await createEyScraper().run({ fetchText: async url => url.includes('/search/') ? listingPage(closed.listing) : body })
    assert.equal(jobs.length, 1)
    assert.equal(jobs[0].jobDescription, null)
    assert.equal(jobs[0].lifecycleCleanupAllowed, false)
    assert.equal(jobs[Symbol.for('jobverify.ey-native-closures')]?.closedCount ?? 0, 0)
  }
})
