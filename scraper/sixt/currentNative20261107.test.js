import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { getScraperCatalog, createCatalogScraper } from '../../scraper-support/providers/index.js'
import { isFreshCompleteInventoryEvidence, readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const packets = JSON.parse(gunzipSync(readFileSync(new URL('./test-data-20261107/current-native-inventory.json.gz', import.meta.url))))
const provider = getScraperCatalog().find(row => row.source === 'sixt')
const listUrl = packets[0].requestUrl
const mutatePosting = (html, mutate) => html.replace(/(<script\b[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/g, (all, start, raw, end) => {
  const data = JSON.parse(raw)
  if (data['@type'] !== 'JobPosting') return all
  mutate(data)
  return start + JSON.stringify(data).replace(/</g, '\\u003c') + end
})
function replay({ mutation, closingChange = false, foreignRedirect = false } = {}) {
  let listReads = 0
  const options = { async fetchPage(url) {
    const packet = packets.find(row => row.requestUrl === url)
    assert.ok(packet, 'unexpected native URL: ' + url)
    let html = packet.body
    if (url === listUrl) {
      listReads++
      if (closingChange && listReads > 1) html = html.replaceAll('ba3edec5-2b62-4eed-8f1b-96d57edd4d8d', 'ba3edec5-2b62-4eed-8f1b-96d57edd4d80')
    } else if (mutation) html = mutatePosting(html, mutation)
    return { status: 200, url: foreignRedirect && url !== listUrl ? 'https://foreign.example/jobs' : packet.url, html }
  } }
  options.fetchText = async url => (await options.fetchPage(url)).html
  return options
}

test('registered SIXT source reads all seven current full native India descriptions and closes the list', async () => {
  const jobs = await createCatalogScraper(provider).run(replay())
  assert.equal(jobs.length, 7)
  assert.ok(jobs.every(job => job.country === 'India' && job.jobDescription.length > 1000))
  assert.ok(jobs.every(job => /^REF\d+[A-Z]$/.test(job.requisitionId)))
  assert.ok(jobs.every(job => job.lifecycleCleanupAllowed === false))
  assert.equal(isFreshCompleteInventoryEvidence(readInventoryEvidence(jobs)), true)
})

for (const [name, mutation] of [
  ['foreign employer', row => { row.hiringOrganization.name = 'Another employer' }],
  ['foreign country', row => { row.jobLocation.address.addressCountry = 'United States' }],
  ['wrong role URL', row => { row.url = row.url.replace(/.$/, '0') }],
  ['changed title identity', row => { row.title += ' changed' }],
  ['missing full criteria', row => { row.description = '' }],
  ['unrelated hidden criteria', row => { row.description += ' Not published in the visible role.' }],
]) test('current SIXT inventory rejects ' + name, async () => {
  await assert.rejects(createCatalogScraper(provider).run(replay({ mutation })), /SIXT current/)
})

test('a foreign response redirect cannot qualify the native role', async () => {
  await assert.rejects(createCatalogScraper(provider).run(replay({ foreignRedirect: true })), /SIXT current/)
})

test('a changed closing native list does not establish completion', async () => {
  await assert.rejects(createCatalogScraper(provider).run(replay({ closingChange: true })), /SIXT current.*closing/i)
})

test('a requested cap returns qualified roles with incomplete inventory evidence', async () => {
  const jobs = await createCatalogScraper(provider).run({ ...replay(), maxJobs: 2 })
  assert.equal(jobs.length, 2)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})
