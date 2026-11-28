import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run, CAREERS_URL} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const capture = JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-public-20261127.json.gz', import.meta.url))))
const employer = capture.packets.find(packet => packet.requestedUrl === CAREERS_URL)
const native = capture.packets.find(packet => packet.requestedUrl.startsWith('https://api.lever.co/'))
const payload = JSON.parse(native.body)
const fixture = ({mutatePage, mutatePayload} = {}) => {
  let pages = 0, reads = 0
  return {
  fetchPage: async url => {
    assert.equal(url, CAREERS_URL)
    const page = {status: employer.status, url: employer.url, html: employer.body}
    return mutatePage ? mutatePage(page, ++pages) : page
  },
  fetchJson: async url => {
    assert.equal(url, native.requestedUrl)
    const result = structuredClone(payload)
    return mutatePayload ? mutatePayload(result, ++reads) : result
  },
  }
}

test('genuine current Keboola employer role set and full Lever inventory prove five Czechia roles and zero India', async () => {
  const jobs = await run(fixture())
  assert.equal(jobs.length, 0)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.listingComplete, true)
  assert.equal(evidence.reportedTotal, 5)
  assert.equal(evidence.indiaFacetCount, 0)
  assert.deepEqual(jobs.nativeCollectionEvidence.openingNativePayload, payload)
  assert.deepEqual(jobs.nativeCollectionEvidence.closingNativePayload, payload)
})

test('Keboola unrelated employer blog navigation does not withhold a fully reconciled inventory', async () => {
  const jobs = await run(fixture({mutatePage: p => ({...p,
    html: p.html + '<a href="/blog/engineering-update">Engineering update</a>'})}))
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 0)
  assert.deepEqual(jobs.nativeCollectionEvidence.closingNativePayload, payload)
})

for (const [label, mutatePayload] of [
  ['a missing country', rows => { rows[0].country = ''; rows[0].categories.location = 'Remote'; rows[0].categories.allLocations = ['Remote']; return rows }],
  ['missing full criteria', rows => { for (const key of ['description', 'descriptionPlain', 'descriptionBody', 'descriptionBodyPlain', 'additional', 'additionalPlain']) rows[0][key] = ''; rows[0].lists = []; return rows }],
  ['hidden-only criteria', rows => { for (const key of ['description', 'descriptionPlain', 'descriptionBody', 'descriptionBodyPlain', 'additional', 'additionalPlain']) rows[0][key] = '<div hidden>Required qualifications</div>'; rows[0].lists = []; return rows }],
  ['a closing membership change', (rows, count) => { if (count === 2) rows.pop(); return rows }],
  ['a closing criteria change', (rows, count) => { if (count === 2) rows[0].lists[0].content += '<li>New requirement.</li>'; return rows }],
  ['a new independent opening section', rows => { rows[0].opening = '<p>Additional conditions of employment</p>'; return rows }],
]) test(`Keboola retains an incomplete inventory for ${label}`, async () => {
  const jobs = await run(fixture({mutatePayload}))
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
  assert.equal(jobs.nativeCollectionEvidence.lifecycleCleanupAllowed, false)
})

for (const [label, options] of [
  ['a denied employer response', {mutatePage: p => ({...p, status: 403})}],
  ['a foreign employer redirect', {mutatePage: p => ({...p, url: 'https://foreign.invalid/careers'})}],
  ['hidden employer role links', {mutatePage: p => ({...p, html: `<div hidden>${p.html}</div>`})}],
  ['foreign native role authority', {mutatePayload: rows => { rows[0].hostedUrl = rows[0].hostedUrl.replace('jobs.lever.co/keboola', 'jobs.lever.co/foreign'); return rows }}],
  ['repeated native identities', {mutatePayload: rows => { rows.push(structuredClone(rows[0])); return rows }}],
  ['a truncated response requiring another page', {mutatePayload: rows => { rows.hasMore = true; return rows }}],
]) test(`Keboola rejects ${label}`, async () => {
  await assert.rejects(run(fixture(options)), /binding|employer|handoff|identity|inventory|scope|duplicate/i)
})

test('Keboola retains every original native row when additional employer recruiting scope appears', async () => {
  const jobs = await run(fixture({mutatePage: p => ({...p, html: p.html + '<a href="https://jobs.lever.co/foreign">Careers</a>'})}))
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
]) test(`Keboola withholds source completion for ${label}`, async () => {
  const jobs = await run(fixture({mutatePage: p => ({...p, html: p.html + html})}))
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
  assert.equal(jobs.nativeCollectionEvidence.lifecycleCleanupAllowed, false)
  assert.deepEqual(jobs.nativeCollectionEvidence.closingNativePayload, payload)
})
