import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { makeZohoFixture, zohoFixtureOptions } from '../../scraper-support/tests/fixtures/zohoNativeOptions.js'

const loadYellowMessengerModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Yellow Messenger scraper module at ./script.js')
  }
}

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Shape the future of conversations</h1>
      <section>Life at Yellow.ai</section>
      <section>The Yellow Code</section>
      <a href="#we-re-hiring">Explore open positions</a>
      <p>Chief Executive Officer and Co-founder, Yellow.ai</p>
      <div id="we-re-hiring">
        <div id="rec_job_listing_div"></div>
        <script src="https://static.zohocdn.com/recruit/embed_careers_site/javascript/v1.1/embed_jobs.js"></script>
        <script>
          rec_embed_js.load({
            widget_id:"rec_job_listing_div",
            page_name:"Careers",
            source:"CareerSite",
            site:"https://careers.yellow.ai",
            empty_job_msg:"No current Openings"
          });
        </script>
      </div>
    </main>
  </body>
</html>
`

test('Yellow Messenger validates the current embedded Zoho loader contract', async () => {
  const yellowMessenger = await loadYellowMessengerModule()
  const data = makeZohoFixture('yellowmessenger')
  data.homepage = officialCareersHtml
  // Existing family values form synthetic native envelopes, not a current public observation.
  const jobs = await yellowMessenger.createYellowMessengerScraper().run(zohoFixtureOptions(data))
  assert.equal(yellowMessenger.SOURCE, 'yellowmessenger')
  assert.equal(yellowMessenger.COMPANY, 'Yellow Messenger')
  assert.equal(yellowMessenger.OFFICIAL_BRAND, 'Yellow.ai')
  assert.equal(data.meta.org_info.company_name, 'Yellow.ai')
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'yellowmessenger')
  assert.equal(jobs[0].company, 'Yellow Messenger')
  assert.equal(jobs[0].jobId, data.rows[0].id)
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].postingDate, '2026-10-24')
  assert.equal(jobs[0].nativeEmployerEntity, null)
  assert.match(jobs[0].sourceDescription, /payment infrastructure.*Requirements.*distributed systems/)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 1)
  assert.equal(data.requests.filter(url => url === data.spec.board).length, 2)
})

test('Yellow Messenger rejects an unavailable native board without certifying empty inventory', async () => {
  const yellowMessenger = await loadYellowMessengerModule(), data = makeZohoFixture('yellowmessenger')
  data.homepage = officialCareersHtml
  const base = zohoFixtureOptions(data)
  await assert.rejects(yellowMessenger.createYellowMessengerScraper().run({
    loadLiveCareersContract: async () => ({ careersHtml: officialCareersHtml }),
    ...base,
    fetchPage: async (url, init) => {
      const page = await base.fetchPage(url, init)
      return url === data.spec.board ? { ...page, status: 404 } : page
    },
  }), /employer page or redirect identity unavailable/)
  assert.deepEqual(data.requests, [yellowMessenger.CAREERS_URL, data.spec.board])
})

test('Yellow Messenger replays retained native HTTP inventory without dead-board empty inference', async t => {
  const yellowMessenger = await loadYellowMessengerModule()
  const captured = JSON.parse(gunzipSync(readFileSync(new URL('../../scraper-support/tests/fixtures/next-native-20261026/yellowmessenger.json.gz', import.meta.url))))
  const original = structuredClone(captured), requestedUrls = [], legacyRequests = []
  const oldestObservedAt = captured.packets.reduce((oldest, packet) => Date.parse(packet.observedAt) < Date.parse(oldest) ? packet.observedAt : oldest, captured.packets[0].observedAt)
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    const packet = captured.packets[requestedUrls.length]
    assert.ok(packet, 'No extra native request is allowed')
    assert.equal(String(url), packet.url)
    assert.equal(options.method || 'GET', 'GET')
    assert.equal(packet.status, 200)
    assert.equal(packet.finalUrl, packet.url)
    assert.equal(createHash('sha256').update(packet.body).digest('hex'), packet.sha256)
    requestedUrls.push(String(url))
    const response = new Response(packet.body, { status: packet.status, headers: { 'content-type': packet.contentType } })
    Object.defineProperty(response, 'url', { value: packet.finalUrl })
    return response
  })
  const jobs = await yellowMessenger.createYellowMessengerScraper().run({
    now: () => oldestObservedAt,
    fetchText: async url => { legacyRequests.push(url); return officialCareersHtml },
  })
  assert.deepEqual(requestedUrls, captured.packets.map(packet => packet.url))
  assert.equal(requestedUrls.length, 5)
  assert.deepEqual(legacyRequests, [])
  assert.deepEqual(jobs, [])
  const native = JSON.parse(captured.packets.find(packet => packet.url.includes('/public/Job_Openings?')).body).data
  assert.equal(native.length, 1)
  assert.equal(native[0].id, '157454000000803145')
  assert.equal(native[0].Publish, false)
  assert.equal(native[0].Is_Locked, true)
  assert.equal(native[0].Date_Opened, '04/02/2025')
  const inventory = readInventoryEvidence(jobs)
  assert.equal(inventory.status, 'complete-inventory')
  assert.equal(inventory.listingComplete, true)
  assert.equal(inventory.reportedTotal, 1)
  assert.equal(inventory.indiaFacetCount, 0)
  assert.equal(inventory.verifiedAt, oldestObservedAt)
  assert.deepEqual(captured, original, 'All original packet bodies, IDs, states, dates and clocks remain unchanged')
})

test('legacy or absent loader objects cannot replace current native HTTP provenance', async t => {
  const yellowMessenger = await loadYellowMessengerModule(), reason = Object.freeze(new Error('Actual native HTTP boundary was not supplied'))
  const calls = []; let legacyCalls = 0
  t.mock.method(globalThis, 'fetch', async url => { calls.push(String(url)); throw reason })
  for (const value of [null, {}, { careersHtml: officialCareersHtml }]) {
    await assert.rejects(yellowMessenger.createYellowMessengerScraper().run({ loadLiveCareersContract: async () => { legacyCalls++; return value } }), error => error === reason)
  }
  assert.deepEqual(calls, [yellowMessenger.CAREERS_URL, yellowMessenger.CAREERS_URL, yellowMessenger.CAREERS_URL])
  assert.equal(legacyCalls, 0)
})

for (const [name, before, after] of [
  ['missing active loader', '<script src="https://static.zohocdn.com/recruit/embed_careers_site/javascript/v1.1/embed_jobs.js"></script>', ''],
  ['absent widget identity', 'widget_id:"rec_job_listing_div"', 'widget_id:"missing_widget"'],
  ['foreign embed site', 'site:"https://careers.yellow.ai"', 'site:"https://other.yellow.ai"'],
]) test('original Yellow careers fixture rejects ' + name, async () => {
  const yellowMessenger = await loadYellowMessengerModule(), data = makeZohoFixture('yellowmessenger')
  data.homepage = officialCareersHtml.replace(before, after)
  assert.notEqual(data.homepage, officialCareersHtml)
  await assert.rejects(yellowMessenger.createYellowMessengerScraper().run(zohoFixtureOptions(data)), /active exact employer careers handoff unavailable/)
  assert.deepEqual(data.requests, [yellowMessenger.CAREERS_URL])
})
