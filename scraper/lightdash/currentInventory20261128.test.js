import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run, CAREERS_URL} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const capture = JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-public-20261127.json.gz', import.meta.url))))
const employer = capture.packets.find(packet => packet.requestedUrl === CAREERS_URL)
const native = capture.packets.find(packet => packet.requestedUrl === 'https://api.ashbyhq.com/posting-api/job-board/Lightdash')
const payload = JSON.parse(native.body)
const fixture = ({mutatePage, mutatePayload} = {}) => {
  let pages = 0, reads = 0
  return {
  fetchPage: async url => {
    const packet = capture.packets.find(packet => packet.requestedUrl === url)
    assert.ok(packet, `Uncaptured public page ${url}`)
    const page = {status: packet.status, url: packet.url, html: packet.body}
    return mutatePage ? mutatePage(page, ++pages) : page
  },
  fetchJson: async url => {
    const packet = capture.packets.find(packet => packet.requestedUrl === url)
    assert.ok(packet, `Uncaptured native API ${url}`)
    const result = JSON.parse(packet.body)
    return mutatePayload ? mutatePayload(result, ++reads) : result
  },
  }
}

test('genuine current Lightdash employer handoff and full Ashby inventory prove two UK roles and zero India', async () => {
  const jobs = await run(fixture())
  assert.equal(jobs.length, 0)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.listingComplete, true)
  assert.equal(evidence.reportedTotal, 2)
  assert.equal(evidence.indiaFacetCount, 0)
  assert.deepEqual(jobs.nativeCollectionEvidence.openingNativePayload, payload)
  assert.deepEqual(jobs.nativeCollectionEvidence.closingNativePayload, payload)
})

test('Lightdash unrelated employer blog navigation does not withhold a fully reconciled inventory', async () => {
  const jobs = await run(fixture({mutatePage: p => p.url === CAREERS_URL ? ({...p,
    html: p.html + '<a href="/blog/engineering-update">Engineering update</a>'}) : p}))
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 0)
  assert.deepEqual(jobs.nativeCollectionEvidence.closingNativePayload, payload)
})

for (const [label, mutatePayload] of [
  ['a missing country', p => { p.jobs[0].address.postalAddress.addressCountry = ''; return p }],
  ['missing full criteria', p => { p.jobs[0].descriptionHtml = ''; p.jobs[0].descriptionPlain = ''; return p }],
  ['hidden-only criteria', p => { p.jobs[0].descriptionHtml = '<div hidden>Required qualifications</div>'; p.jobs[0].descriptionPlain = ''; return p }],
  ['a closing membership change', (p, count) => { if (count === 2) p.jobs.pop(); return p }],
  ['a closing criteria change', (p, count) => { if (count === 2) p.jobs[0].descriptionHtml += '<p>New required qualification.</p>'; return p }],
]) test(`Lightdash retains an incomplete inventory for ${label}`, async () => {
  const jobs = await run(fixture({mutatePayload}))
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
  assert.equal(jobs.nativeCollectionEvidence.lifecycleCleanupAllowed, false)
})

for (const [label, options] of [
  ['a denied employer response', {mutatePage: p => ({...p, status: 403})}],
  ['a foreign employer redirect', {mutatePage: p => ({...p, url: 'https://foreign.invalid/careers'})}],
  ['hidden employer handoff', {mutatePage: (p, count) => count === 1 ? ({...p, html: `<div hidden>${p.html}</div>`}) : p}],
  ['a changed canonical case account', {mutatePage: p => p.url.includes('ashbyhq.com') ? ({...p, html: p.html.replaceAll('https://jobs.ashbyhq.com/Lightdash', 'https://jobs.ashbyhq.com/Foreign')}) : p}],
  ['foreign native role authority', {mutatePayload: p => { p.jobs[0].jobUrl = p.jobs[0].jobUrl.replace('/Lightdash/', '/Foreign/'); return p }}],
  ['repeated native identities', {mutatePayload: p => { p.jobs.push(structuredClone(p.jobs[0])); return p }}],
  ['a truncated response requiring another page', {mutatePayload: p => ({...p, hasMore: true})}],
]) test(`Lightdash rejects ${label}`, async () => {
  await assert.rejects(run(fixture(options)), /binding|employer|handoff|identity|inventory|scope|duplicate/i)
})

test('Lightdash retains original native records when an additional employer recruiting surface appears', async () => {
  const jobs = await run(fixture({mutatePage: p => p.url === CAREERS_URL ? ({...p, html: p.html + '<a href="https://jobs.lever.co/foreign">Careers</a>'}) : p}))
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.deepEqual(jobs.nativeCollectionEvidence.closingNativePayload, payload)
})

for (const [label, html] of [
  ['employer India careers link', '<a href="/careers/india">Jobs in India</a>'],
  ['unrecognized fragment channel', '<a href="#india-jobs">India roles</a>'],
  ['recruiting label on a known marketing URL', '<a href="/pricing">Open India roles</a>'],
  ['employer search form', '<form action="/jobs" method="get"><input name="location" value="India"><button>Search jobs</button></form>'],
  ['same-page resume form', '<form method="post"><input type="file" name="resume"><button>Apply</button></form>'],
  ['employer iframe', '<iframe src="/careers/india"></iframe>'],
  ['inline recruiting iframe', '<iframe srcdoc="&lt;a href=/careers/india&gt;Jobs&lt;/a&gt;"></iframe>'],
  ['employer object', '<object data="/careers/india"></object>'],
  ['employer embed', '<embed src="/careers/india">'],
  ['scripted employer navigation', '<button onclick="window.location.href=\'/careers/india\'">Jobs in India</button>'],
]) test(`Lightdash withholds source completion for ${label}`, async () => {
  const jobs = await run(fixture({mutatePage: p => p.url === CAREERS_URL ? ({...p, html: p.html + html}) : p}))
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
  assert.equal(jobs.nativeCollectionEvidence.lifecycleCleanupAllowed, false)
  assert.deepEqual(jobs.nativeCollectionEvidence.closingNativePayload, payload)
})
