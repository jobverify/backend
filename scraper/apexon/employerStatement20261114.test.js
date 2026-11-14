import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {getScraperCatalog, createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readNativeRole} from './nativeInventory.js'

const capture = JSON.parse(gunzipSync(readFileSync(new URL('./test-data/native-employer-20261114.json.gz', import.meta.url))))
const firstURL = 'https://www.apexon.com/career-job-detail/?id=0&jobid=7561'
const first = capture.packets.find(packet => packet.requestedUrl === firstURL).body
const sentence = 'Apexon is a technology services firm specializing in accelerating business transformation and engineering intelligent enterprises.'
const doc = readNativeDocument(first)
const about = doc.nodes(node => node.tag === 'p' && doc.text(node).startsWith(sentence))
assert.equal(about.length, 1)

const replay = async (mutate = (html) => html) => {
  const calls = []
  const scraper = createCatalogScraper(getScraperCatalog().find(provider => provider.source === 'apexon'))
  const jobs = await scraper.run({now: () => capture.completedAt, fetchText: async (url, options) => {
    assert.equal(options.includeResponseMetadata, true)
    calls.push(url)
    const packet = capture.packets.find(row => row.requestedUrl === url)
    if (!packet) throw Object.assign(new Error('Recorded response boundary; further role not captured'), {abortRetries: true})
    return {status: packet.status, url: packet.url, html: mutate(packet.body, url)}
  }})
  return {jobs, calls}
}

test('November14 Apexon fixture retains complete original response bytes', () => {
  assert.equal(capture.packets.length, 10)
  for (const packet of capture.packets) {
    assert.equal(Buffer.byteLength(packet.body), packet.bytes)
    assert.equal(createHash('sha256').update(packet.body).digest('hex'), packet.sha256)
  }
})

test('current first-party employer statement qualifies the complete original Client Partner role', () => {
  const role = readNativeRole(first)
  assert.equal(role.title, 'Client Partner')
  assert.equal(role.requisitionId, '7561')
  assert.equal(role.location, 'Bengaluru, Karnataka, India')
  assert.ok(role.employerStatement.startsWith(sentence))
  assert.match(role.description, /10\+ years of proven experience/)
  assert.match(role.description, /Bachelor/)
  assert.ok(role.description.length > 4000)
  assert.equal(new URL(role.applyUrl).hostname, 'apexon.talentrecruit.com')
})

test('registered Apexon acquisition retains two verified India roles at the recorded boundary', async () => {
  const {jobs, calls} = await replay()
  assert.deepEqual(jobs.map(job => job.requisitionId), ['7561', '7476'])
  assert.deepEqual(jobs.map(job => job.title), ['Client Partner', 'Java Developer'])
  assert.ok(jobs.every(job => job.company === 'Apexon' && job.country === 'India' && job.sourceDetailComplete))
  assert.ok(jobs.every(job => job.jobDescription.length > 4000 && !job.sourceScopeComplete && !job.lifecycleCleanupAllowed))
  assert.equal(jobs[0].nativeCollectionFailures[0].requisitionId, '7506')
  assert.match(jobs[0].nativeCollectionFailures[0].reason, /Recorded response boundary/)
  assert.equal(calls.length, 6)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

for (const [name, change] of [
  ['another employer', html => html.replace(sentence, sentence.replace('Apexon', 'Other Company'))],
  ['an unreviewed employer formulation', html => html.replace(sentence, 'Apexon is a staffing intermediary that hires for an unrelated employer.')],
  ['duplicate employer evidence', html => html.replace(sentence, sentence + '</p><p>' + sentence)],
  ['another application tenant', html => html.replaceAll('https://apexon.talentrecruit.com/career-page/apply/', 'https://other.talentrecruit.com/career-page/apply/')],
]) {
  test('current employer statement still rejects ' + name, () => {
    assert.throws(() => readNativeRole(change(first)), /native employer, application or full criteria changed/)
  })
}

test('registered current employer evidence cannot override a conflicting role country', async () => {
  await assert.rejects(replay((html, url) => url === firstURL
    ? html.replaceAll('Bengaluru, Karnataka, India', 'Bengaluru, Karnataka, Canada') : html),
  /native detail requisition, title or country identity changed/)
})
