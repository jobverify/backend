import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import test from 'node:test'
import {gunzipSync} from 'node:zlib'

import {createCatalogScraper, getScraperCatalog} from '../../scraper-support/providers/index.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/corporate-styling-20261128.json.gz', import.meta.url))))
const current = fixture.packets
const retainedNative = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/native-20261113.json.gz', import.meta.url))))
const retainedStyling = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/corporate-styling-20261121.json.gz', import.meta.url)))).packets
const HOME = 'https://amicable.io/', CAREERS = HOME + 'careers', BOARD = 'https://app.screenloop.com/careers/amicable'
const CSS = current.find(row => row.requestedUrl.includes('314dd54bb')).requestedUrl
const SWIPER = 'https://cdn.jsdelivr.net/npm/swiper@8/swiper-bundle.min.css'
const provider = () => getScraperCatalog().find(row => row.source === 'amicableai')
function replay(change = () => {}, {stopAtBoard = false} = {}) {
  const calls = [], visits = new Map(), boundary = Object.freeze({unacquiredCurrentInventory: true})
  return {calls, visits, boundary, run: () => createCatalogScraper(provider()).run({fetchPage: async url => {
    calls.push(url)
    const visit = (visits.get(url) ?? 0) + 1
    visits.set(url, visit)
    if (stopAtBoard && url === BOARD) throw boundary
    const original = current.find(row => row.requestedUrl === url) ?? retainedNative.find(row => row.requestedUrl === url)
    assert.ok(original, 'Only genuine current styling or explicitly retained native-role controls may be read: ' + url)
    const packet = structuredClone(original)
    change(packet, url, visit)
    return packet
  }})}
}

test('four genuine current corporate/style bodies retain their full hashes and published stylesheet integrity', () => {
  assert.equal(fixture.source, 'amicableai')
  assert.equal(current.length, 4)
  for (const packet of current) {
    assert.equal(packet.method, 'GET')
    assert.equal(packet.status, 200)
    assert.equal(packet.url, packet.requestedUrl)
    assert.equal(packet.bodyOriginalUnmodified, true)
    assert.equal(createHash('sha256').update(packet.html).digest('hex'), packet.sha256)
  }
  const css = current.find(row => row.requestedUrl === CSS)
  assert.equal(Buffer.byteLength(css.html), 290050)
  assert.equal(css.sha256, '08f91e867847d0a0118a138f4fe3e8bcdaf1867273c116a3186e0f2e0035f98b')
  assert.equal('sha384-' + createHash('sha384').update(css.html).digest('base64'), 'sha384-MU3VS79nT00WOepnu5FlL5OeVQUPU2miQ5YDVq42jpUiRfpPUEKfCZJvxmWxmPUG')
  assert.equal(current.find(row => row.requestedUrl === SWIPER).sha256, '322d15d99efb792c941a5202fa8fc7ee9e932847227383ff9605163338a08eac')
  assert.ok(current.filter(row => [CSS,SWIPER].includes(row.requestedUrl)).every(row => !/@import\b/i.test(row.html)))
})

test('genuine current declarations and complete styles reach the public board boundary without inventing current inventory', async () => {
  const r = replay(() => {}, {stopAtBoard: true})
  await assert.rejects(r.run(), error => error === r.boundary)
  assert.deepEqual(r.calls, [HOME, CAREERS, CSS, SWIPER, BOARD])
})

test('current styling with explicitly retained native controls preserves every full UK criterion and company-scope hold', async () => {
  // Only corporate/CSS originals are current here. Role models remain the
  // genuine November13 cohort, explicitly a compatibility control, not live proof.
  const r = replay(), jobs = await r.run(), audit = jobs.nativeCollectionEvidence
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 8)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed, false)
  assert.equal(audit.sourceCompanyWideScopeComplete, false)
  assert.equal(audit.sourceLifecycleCleanupVerified, false)
  assert.equal(audit.corporateStylingDeployment, 'current-20261128')
  assert.equal(audit.observedDetails.length, 8)
  for (const job of audit.observedDetails) {
    const packet = retainedNative.find(row => row.requestedUrl === job.sourceUrl)
    const doc = readNativeDocument(packet.html)
    const props = JSON.parse(doc.nodes(node => node.attrs['data-react-class'] === 'applicant_tracking/Jobs/JobPostPage')[0].attrs['data-react-props'])
    assert.equal(job.jobDescription, props.jobPostHtmlString)
    assert.equal(job.sourceDescription, props.jobPostHtmlString)
    assert.equal(job.country, 'United Kingdom')
    assert.equal(job.postingDate, null)
    assert.equal(job.sourcePostingDateUnavailable, true)
    assert.equal(job.sourceScopeComplete, false)
    assert.equal(job.lifecycleCleanupAllowed, false)
  }
  assert.equal(r.visits.get(CSS), 2)
  assert.equal(r.visits.get(SWIPER), 2)
})

for (const [name, asset] of [['main stylesheet', CSS], ['preloaded Swiper stylesheet', SWIPER]]) {
  test('altered complete ' + name + ' remains rejected before the native board', async () => {
    const r = replay((packet, url) => {if (url === asset) packet.html += '\n.iframe-wrapper{display:none!important}'})
    await assert.rejects(r.run(), /CSS visibility contract changed/)
    assert.equal(r.calls.includes(asset), true)
    assert.equal(r.calls.includes(BOARD), false)
  })
}

for (const [name, change, rejection = /CSS visibility path changed/] of [
  ['unknown stylesheet URL', html => html.replace(CSS, 'https://amicable.io/unreviewed.css')],
  ['changed integrity', html => html.replace('sha384-MU3VS79nT00WOepnu5FlL5OeVQUPU2miQ5YDVq42jpUiRfpPUEKfCZJvxmWxmPUG', 'sha384-unreviewed')],
  ['changed preload activation', html => html.replace("this.onload=null;this.rel='stylesheet'", "this.onload=null;this.rel='stylesheet';fetch('/unreviewed-jobs')")],
  ['extra stylesheet', html => html.replace('</head>', '<link rel="stylesheet" href="https://amicable.io/unreviewed.css"></head>')],
  ['concealed frame ancestor', html => html.replace('class="iframe-wrapper"', 'class="iframe-wrapper" style="display:none"'), /current active careers native handoff changed/],
]) {
  test(name + ' stays rejected without fetching an unreviewed dependency', async () => {
    const r = replay((packet, url) => {
      if (url !== CAREERS) return
      const changed = change(packet.html)
      assert.notEqual(changed, packet.html)
      packet.html = changed
    })
    await assert.rejects(r.run(), rejection)
    assert.deepEqual(r.calls, [HOME, CAREERS])
  })
}

test('edited inline frame visibility remains unqualified before external CSS reads', async () => {
  const r = replay((packet, url) => {if (url === CAREERS) packet.html = packet.html.replace('.iframe-wrapper {', '.iframe-wrapper {\n display:none;')})
  await assert.rejects(r.run(), /public frame visibility context changed/)
  assert.deepEqual(r.calls, [HOME, CAREERS])
})

test('closing cannot combine this deployment with an independently reviewed previous styling tuple', async () => {
  const r = replay((packet, url, visit) => {
    if (url === CAREERS && visit === 2) packet.html = retainedStyling.find(row => row.requestedUrl === CAREERS).html
  })
  await assert.rejects(r.run(), /corporate styling deployment changed during closing/)
  assert.equal(r.visits.get(CAREERS), 2)
})

test('closing current stylesheet bytes cannot reuse opening integrity qualification', async () => {
  const r = replay((packet, url, visit) => {if (url === CSS && visit === 2) packet.html += '\niframe{opacity:0}'})
  await assert.rejects(r.run(), /CSS visibility contract changed/)
  assert.equal(r.visits.get(CSS), 2)
})

for (const status of [401, 403, 429]) {
  test('current declared CSS HTTP ' + status + ' stops before any board or alternate read', async () => {
    const r = replay((packet, url) => {if (url === CSS) packet.status = status})
    await assert.rejects(r.run(), new RegExp('public HTTP ' + status + '; stopped without retry'))
    assert.deepEqual(r.calls, [HOME, CAREERS, CSS])
  })
}

test('default registered source preserves a current CSS-byte rejection without fallback reads', async t => {
  const calls = []
  t.mock.method(globalThis, 'fetch', async input => {
    const url = String(input)
    calls.push(url)
    const packet = current.find(row => row.requestedUrl === url)
    assert.ok(packet, 'No uncaptured alternate source read')
    return Object.defineProperty(new Response(url === CSS ? packet.html + '\niframe{display:none}' : packet.html,
      {status: packet.status, headers: packet.headers}), 'url', {value: packet.url})
  })
  await assert.rejects(createCatalogScraper(provider()).run({signal: AbortSignal.timeout(15000)}), /CSS visibility contract changed/)
  assert.deepEqual(calls, [HOME, CAREERS, CSS])
})

test('default registered genuine prefix reaches the board and preserves the exact caller stop at unacquired inventory', async t => {
  const calls = [], controller = new AbortController(), stop = Object.freeze({unacquiredCurrentBoard: true})
  t.mock.method(globalThis, 'fetch', async input => {
    const url = String(input)
    calls.push(url)
    if (url === BOARD) {controller.abort(stop); throw stop}
    const packet = current.find(row => row.requestedUrl === url)
    assert.ok(packet, 'No uncaptured alternate source read')
    return Object.defineProperty(new Response(packet.html, {status: packet.status, headers: packet.headers}), 'url', {value: packet.url})
  })
  await assert.rejects(createCatalogScraper(provider()).run({signal: controller.signal}), error => error === stop)
  assert.deepEqual(calls, [HOME, CAREERS, CSS, SWIPER, BOARD])
})
