import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { createCatalogScraper, getScraperCatalog } from '../../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./native-captures/native-20261101.json.gz', import.meta.url))))
const apiURL = 'https://www.thoughtspot.com/api/getCareersListing'
const roleId = 'ffd134bf-a6d7-4ece-bbd7-22106a07d47a'
const roleURL = 'https://ats.rippling.com/thoughtspot/jobs/' + roleId
const apiBody = fixture.packets[apiURL].body
const roleBody = fixture.packets[roleURL].body
const replay = (overrides = {}) => {
  const requests = []
  return { requests, transport: async url => {
    requests.push(url)
    const packet = fixture.packets[url]
    assert.ok(packet, 'Unexpected native request: ' + url)
    const body = overrides[url] ?? packet.body
    if (body instanceof Error) throw body
    return { url, status: packet.status, headers: { 'content-type': packet.contentType }, body: Buffer.from(body),
      bodyComplete: true, requestedAt: packet.at, completedAt: packet.at }
  } }
}
let registeredProvider
const run = async options => {
  const provider = registeredProvider ||= getScraperCatalog().find(item => item.source === 'thoughtspot')
  // The existing Workday adapter cannot consume the observed native feed. Stop
  // here on RED rather than send an uncontrolled Workday request from this test.
  assert.equal(provider.adapter, 'script')
  return createCatalogScraper(provider).run(options)
}
const mutateDetail = fn => {
  const match = [...roleBody.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .find(match => match[1].includes('__NEXT_DATA__'))
  const data = JSON.parse(match[2])
  fn(data)
  return roleBody.replace(match[0], match[0].replace(match[2], JSON.stringify(data)))
}

test('ThoughtSpot registered extraction recovers 14 typed India roles through its current feed', async () => {
  const input = replay()
  const jobs = await run(input)
  assert.equal(jobs.length, 14)
  const intern = jobs.find(job => job.jobId === roleId)
  assert.equal(intern.title, 'Intern-HR Operations')
  assert.equal(intern.company, 'ThoughtSpot')
  assert.equal(intern.country, 'India')
  assert.equal(intern.city, 'Bengaluru')
  assert.equal(intern.link, roleURL)
  assert.match(intern.sourceDescription, /Onboarding/)
  assert.match(intern.sourceDescription, /What You Bring/)
  assert.equal(intern.postingDate, null)
  assert.equal(intern.nativeCreatedOn, '2026-09-18T02:02:58.667000-07:00')
  assert.equal(intern.lifecycleCleanupAllowed, false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(input.requests.filter(url => url === apiURL).length, 2)
  assert.equal(input.requests.length, 17)
})

for (const [label, modify] of [
  ['foreign board', data => { data.props.pageProps.apiData.jobBoard.slug = 'another-employer' }],
  ['foreign employer', data => { data.props.pageProps.apiData.jobPost.companyName = 'Another employer' }],
  ['another role identity', data => { data.query.jobId = 'another-role' }],
  ['contradictory work locations', data => { data.props.pageProps.apiData.jobPost.workLocations = ['Toronto, Canada'] }],
  ['unlisted job', data => { data.props.pageProps.apiData.jobPost.unlistedFromSearch = true }],
  ['missing application', data => { data.props.pageProps.apiData.jobPost.activeJobApplication = null }],
]) {
  test(`ThoughtSpot excludes a detail with ${label} while retaining the other 13 roles`, async () => {
    const jobs = await run(replay({ [roleURL]: mutateDetail(modify) }))
    assert.equal(jobs.length, 13)
    assert.equal(jobs.some(job => job.jobId === roleId), false)
  })
}

test('ThoughtSpot rejects contradictory first-party country codes instead of guessing from a city', async () => {
  const payload = JSON.parse(apiBody)
  payload.data.find(row => row.id === roleId).locations[0].countryCode = 'CA'
  const jobs = await run(replay({ [apiURL]: JSON.stringify(payload) }))
  assert.equal(jobs.length, 13)
  assert.equal(jobs.some(job => job.jobId === roleId), false)
})

test('ThoughtSpot cannot use a hidden native role or an unreviewed visible title as proof', async () => {
  for (const html of [roleBody.replace('id="main-content"', 'id="main-content" hidden'),
    roleBody.replace('<h1 class="css-y51iej">Intern-HR Operations</h1>', '<h1 class="css-y51iej">Another role</h1>')]) {
    assert.notEqual(html, roleBody)
    const jobs = await run(replay({ [roleURL]: html }))
    assert.equal(jobs.length, 13)
    assert.equal(jobs.some(job => job.jobId === roleId), false)
  }
})

test('ThoughtSpot unavailable/empty feed remains unresolved, not a successful empty company inventory', async () => {
  for (const body of ['{"error":"unavailable"}', '{"data":[]}', '{"data":[],"hasMore":true}']) {
    await assert.rejects(run(replay({ [apiURL]: body })))
  }
})

test('ThoughtSpot caller cancellation survives an in-flight native request', async () => {
  const controller = new AbortController()
  const reason = Object.freeze(new Error('stop ThoughtSpot'))
  await assert.rejects(run({ signal: controller.signal, fetchImpl: async (_url, { signal }) => {
    controller.abort(reason)
    signal.throwIfAborted()
  } }), error => error === reason)
})

test('ThoughtSpot combines native location rows belonging to the same unchanged role identity', async () => {
  const { parseThoughtSpotListing } = await import('./native.js')
  const listing = parseThoughtSpotListing(apiBody)
  assert.equal(listing.observedRows, 61)
  assert.equal(listing.records.length, 55)
  assert.deepEqual(listing.errors, [])
  const role = listing.records.find(row => row.id === 'c445d7e8-267a-40ea-85fe-ff8537aed379')
  assert.equal(role.nativeRecords.length, 2)
})

test('ThoughtSpot never chooses one of two conflicting publisher records for the same role', async () => {
  const payload = JSON.parse(apiBody)
  const original = payload.data.find(row => row.id === roleId)
  payload.data.push({ ...original, name: 'A different role' })
  const jobs = await run(replay({ [apiURL]: JSON.stringify(payload) }))
  assert.equal(jobs.length, 13)
  assert.equal(jobs.some(job => job.jobId === roleId), false)
})

const changeRendered = fn => {
  const match = [...roleBody.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .find(match => match[1].includes('__NEXT_DATA__'))
  return fn(roleBody.slice(0, match.index)) + match[0] + fn(roleBody.slice(match.index + match[0].length))
}

test('ThoughtSpot requires the actual visible workplace, even when native data arrays still match', async () => {
  const { parseThoughtSpotListing, parseThoughtSpotDetail } = await import('./native.js')
  const row = parseThoughtSpotListing(apiBody).records.find(row => row.id === roleId)
  for (const replacement of ['Toronto, Canada', '']) {
    const html = changeRendered(text => text.replaceAll('Bengaluru, India', replacement))
    assert.throws(() => parseThoughtSpotDetail(html, row))
  }
})

test('ThoughtSpot does not trust India typed fields against an explicit foreign country label', async () => {
  const { parseThoughtSpotListing } = await import('./native.js')
  const payload = JSON.parse(apiBody)
  payload.data.find(row => row.id === roleId).locations[0].name = 'Toronto, Canada'
  assert.equal(parseThoughtSpotListing(JSON.stringify(payload)).records.some(row => row.id === roleId), false)
})

test('ThoughtSpot preserves a California abbreviation without treating the label as Canada', async () => {
  const { parseThoughtSpotListing } = await import('./native.js')
  const listing = parseThoughtSpotListing(apiBody)
  const row = listing.records.find(row => row.id === '67fd7aa2-b374-4346-a0b7-d234146c9b00')
  assert.ok(row)
  assert.equal(row.nativeRecord.locations[0].name, 'CA')
  assert.equal(row.nativeRecord.locations[0].countryCode, 'US')
})

test('ThoughtSpot rejects a visible closed notice and disabled native application controls', async () => {
  const { parseThoughtSpotListing, parseThoughtSpotDetail } = await import('./native.js')
  const row = parseThoughtSpotListing(apiBody).records.find(row => row.id === roleId)
  const closed = roleBody.replace(/(<main\b[^>]*id="main-content"[^>]*>)/,
    '$1<p>This job is no longer available.</p>')
  assert.notEqual(closed, roleBody)
  assert.throws(() => parseThoughtSpotDetail(closed, row))
  const disabled = roleBody.replaceAll('data-testid="Apply now"', 'aria-disabled="true" data-testid="Apply now"')
  assert.throws(() => parseThoughtSpotDetail(disabled, row))
})

for (const kind of ['extra-invalid-row', 'pagination-incomplete']) {
  test(`ThoughtSpot does not certify closing reconciliation after ${kind}`, async () => {
    const input = replay()
    const originalTransport = input.transport
    let listingReads = 0
    input.transport = async url => {
      const response = await originalTransport(url)
      if (url === apiURL && ++listingReads === 2) {
        const payload = JSON.parse(apiBody)
        if (kind === 'extra-invalid-row') payload.data.push({ id: 'invalid', name: 'Unqualified current row' })
        else payload.hasMore = true
        return { ...response, body: Buffer.from(JSON.stringify(payload)) }
      }
      return response
    }
    const jobs = await run(input)
    assert.equal(jobs.length, 14)
    const evidence = jobs[0].nativeCollectionEvidence
    assert.equal(evidence.closingInventoryMatches, false)
    assert.ok(evidence.failures.some(failure => failure.stage === 'closing-inventory'))
    assert.equal(jobs[0].sourceScopeComplete, false)
  })
}
