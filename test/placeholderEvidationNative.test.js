import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { getScraperCatalog, createCatalogScraper } from '../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'

const folder = new URL('../scraper/evidation/fixtures/current-20261030/', import.meta.url)
const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', folder), 'utf8'))
const records = manifest.requests.map(row => {
  const body = gunzipSync(fs.readFileSync(new URL(row.filename, folder)))
  assert.equal(createHash('sha256').update(body).digest('hex'), row.bodySHA256)
  return { ...row, body }
})
const CORP = 'https://evidation.com/open-positions'
const WIDGET = 'https://static-assets.ripplingcdn.com/ats/embeds/job-board.v1.js'
const FRAME = 'https://ats.rippling.com/embed/evidation/jobs?s=https%3A%2F%2Fevidation.com%2Fopen-positions'
const FIRST = '5654dc34-f45e-43d0-bf2a-753061739b64'
const DETAIL = 'https://ats.rippling.com/en-US/evidation/jobs/'
const PROOF = Symbol.for('jobverify.official-ats-discovery')
const run = options => createCatalogScraper(getScraperCatalog().find(row => row.source === 'evidation'))
  .run({ now: () => manifest.capturedAt, ...options })
const replace = (row, old, value) => ({ ...row, body: Buffer.from(row.body.toString().replaceAll(old, value)) })
function native(row, change) {
  const body = row.body.toString().replace(/(<script\b[^>]*\bid="__NEXT_DATA__"[^>]*>)([\s\S]*?)(<\/script>)/,
    (_, before, raw, after) => {
      const data = JSON.parse(raw)
      change(data)
      return before + JSON.stringify(data).replaceAll('<', '\\u003c') + after
    })
  return { ...row, body: Buffer.from(body) }
}
const query = data => data.props.pageProps.dehydratedState.queries.find(q => q.queryKey[2] === 'job-posts')
function replay(t, change) {
  const calls = [], counts = new Map()
  t.mock.method(globalThis, 'fetch', async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.href || input.url
    assert.equal(init.method || 'GET', 'GET')
    assert.equal(init.body, undefined)
    const row = records.find(r => r.requestedURL === url)
    assert.ok(row, 'Uncaptured HTTP forbidden: ' + url)
    const occurrence = (counts.get(url) || 0) + 1
    counts.set(url, occurrence); calls.push(url)
    const current = change ? change({ ...row, body: Buffer.from(row.body) }, occurrence) : row
    const response = new Response(current.body, { status: current.status, headers: current.headers })
    Object.defineProperty(response, 'url', { value: current.finalURL })
    return response
  })
  return calls
}
// These country changes exercise future India mapping; they are not recorded
// Evidation India openings. Full captured payloads and rendered markup remain.
function syntheticIndia(row) {
  for (const [old, value] of [
    ['Santa Barbara, CA', 'Bengaluru, India'], ['"country":"United States"', '"country":"India"'],
    ['"countryCode":"US"', '"countryCode":"IN"'], ['"city":"Santa Barbara"', '"city":"Bengaluru"'],
    ['"state":"California"', '"state":"Karnataka"'], ['"stateCode":"CA"', '"stateCode":"KA"'],
  ]) row = replace(row, old, value)
  return row
}
function expandedLocations(row, expiry) {
  if (row.requestedURL.startsWith(FRAME)) {
    let replaced
    row = native(row, data => {
      const payload = query(data).state.data
      if (!payload.items.length) return
      const [first, second] = payload.items, expanded = structuredClone(first)
      replaced = { id: second.id, name: second.name, firstId: first.id, firstName: first.name }
      expanded.locations[0].name = 'San Francisco, CA'
      expanded.locations[0].city = 'San Francisco'
      if (expiry) expanded.validThrough = expiry
      payload.items[1] = expanded
    })
    if (replaced) row = replace(replace(row, replaced.id, replaced.firstId), replaced.name, replaced.firstName)
  }
  if (row.requestedURL === DETAIL + FIRST) row = native(row, data => {
    data.props.pageProps.apiData.jobPost.workLocations.push('San Francisco, CA')
    data.props.pageProps.apiData.workLocations.push('San Francisco, CA')
  })
  return row
}

test('registered Evidation enumerates and reconciles all three current US roles without certifying company or India emptiness', async t => {
  const calls = replay(t), jobs = await run()
  assert.equal(jobs.length, 0)
  assert.equal(calls.length, 16)
  assert.equal(calls.filter(url => url.startsWith(DETAIL)).length, 6)
  assert.equal(calls.filter(url => url === FRAME + '&page=1').length, 2)
  const proof = jobs[PROOF]
  assert.deepEqual(proof.nativeInventory, {
    observedNativeRows: 3, observedUniqueRoles: 3, observedIndiaRoles: 0,
    snapshots: 2, pagesPerSnapshot: 2, allDetailsValidated: true,
  })
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'coverage-gap')
  assert.equal(evidence.firstParty, true)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
  assert.equal(getScraperCatalog().find(row => row.source === 'evidation').backfillMode, 'live-parser')
})

test('synthetic India native location replay retains full employer sections and creation metadata without inventing a publication date', async t => {
  replay(t, syntheticIndia)
  const jobs = await run()
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].jobId, FIRST)
  assert.equal(jobs[0].nativeCreatedOn, '2025-11-18T13:56:36.054000-08:00')
  for (const job of jobs) {
    assert.equal(job.company, 'Evidation')
    assert.equal(job.country, 'India')
    assert.equal(job.city, 'Bengaluru')
    assert.equal(job.postingDate, null)
    assert.equal(job.nativeLegalEmployer, null)
    assert.equal(job.nativeEmployerBrand, 'Evidation')
    assert.ok(job.nativeDescriptionHtml.company.length > 1000)
    assert.ok(job.nativeDescriptionHtml.role.length > 5000)
    assert.ok(job.sourceDescription.includes('About Evidation'))
    assert.equal(job.sourceDetailComplete, true)
    assert.equal(job.sourceScopeComplete, false)
    assert.equal(job.sourceListingComplete, false)
    assert.equal(job.lifecycleCleanupAllowed, false)
    assert.equal(job.applicationSubmitted, false)
    assert.equal(job.sourceUrl, 'https://ats.rippling.com/evidation/jobs/' + job.jobId)
  }
})

test('Evidation follows real captured two-record pages through the empty terminal page and validates every role', async t => {
  const calls = replay(t), jobs = await run({ pageSize: 2 })
  assert.equal(jobs.length, 0)
  assert.equal(calls.length, 18)
  assert.equal(calls.filter(url => url === FRAME + '&pageSize=2&page=1').length, 2)
  assert.equal(calls.filter(url => url === FRAME + '&pageSize=2&page=2').length, 2)
  assert.equal(jobs[PROOF].nativeInventory.observedNativeRows, 3)
  assert.equal(jobs[PROOF].nativeInventory.pagesPerSnapshot, 3)
})

test('Evidation cannot silently truncate a paginated native inventory at a page cap', async t => {
  replay(t)
  await assert.rejects(run({ pageSize: 2, maxPages: 1 }), /page|incomplete/i)
})

test('Evidation output limits retain incomplete lifecycle guards after both complete native snapshots', async t => {
  const calls = replay(t, syntheticIndia), jobs = await run({ maxJobs: 1 })
  assert.equal(jobs.length, 1)
  assert.equal(calls.length, 16)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Evidation requires a current visible corporate widget before reading the native board', async t => {
  const calls = replay(t, row => row.requestedURL === CORP ? replace(row, 'id="rr-job-board"', 'id="rr-job-board" hidden') : row)
  await assert.rejects(run(), /widget|handoff/i)
  assert.deepEqual(calls, [CORP])
})

test('Evidation rejects an explicit corporate widget base override', async t => {
  replay(t, row => row.requestedURL === CORP ? replace(row, '</body>', '<script>window.RR_BASE_URL="https://unrelated.example"</script></body>') : row)
  await assert.rejects(run(), /override|widget/i)
})

test('Evidation treats corporate HTTP denial as a failed check', async t => {
  replay(t, row => row.requestedURL === CORP ? { ...row, status: 403 } : row)
  await assert.rejects(run(), /HTTP.*403/i)
})

test('Evidation requalifies a changed current native widget executable', async t => {
  replay(t, row => row.requestedURL === WIDGET ? replace(row, 'https://ats.rippling.com', 'https://unrelated.example') : row)
  await assert.rejects(run(), /widget.*contract|delegation/i)
})

test('Evidation requalifies a changed pagination client', async t => {
  replay(t, row => row.requestedURL.includes('/7387-') ? replace(row, 'pageSize:20', 'pageSize:2') : row)
  await assert.rejects(run(), /client|pagination/i)
})

for (const [field, value] of [['companyName', 'Unrelated Employer'], ['slug', 'unrelated'], ['isTest', true]]) {
  test('Evidation rejects native board identity change: ' + field, async t => {
    replay(t, row => row.requestedURL.startsWith(FRAME) ? native(row, data => { data.props.pageProps.apiData.jobBoard[field] = value }) : row)
    await assert.rejects(run(), /board|employer|identity/i)
  })
}

test('Evidation rejects contradictory country fields before excluding foreign roles', async t => {
  replay(t, row => row.requestedURL === FRAME ? native(row, data => { query(data).state.data.items[0].locations[0].countryCode = 'IN' }) : row)
  await assert.rejects(run(), /country|geography/i)
})

test('Evidation rejects a successful HTTP response carrying a failed native listing query', async t => {
  replay(t, row => row.requestedURL === FRAME ? native(row, data => { query(data).state.error = { message: 'unavailable' }; query(data).state.status = 'error' }) : row)
  await assert.rejects(run(), /query|error/i)
})

test('Evidation cannot certify coverage when a native rendered role description disappears', async t => {
  replay(t, row => row.requestedURL === DETAIL + FIRST ? native(row, data => { data.props.pageProps.apiData.jobPost.description.role = '' }) : row)
  await assert.rejects(run(), /description|content/i)
})

test('Evidation rejects a native role that becomes unlisted', async t => {
  replay(t, row => row.requestedURL === DETAIL + FIRST ? native(row, data => { data.props.pageProps.apiData.jobPost.unlistedFromSearch = true }) : row)
  await assert.rejects(run(), /public|status|unlisted|identity/i)
})

test('Evidation rejects native role and rendered title disagreement', async t => {
  replay(t, row => row.requestedURL === DETAIL + FIRST ? native(row, data => { data.props.pageProps.apiData.jobPost.name = 'Different role' }) : row)
  await assert.rejects(run(), /title|identity/i)
})

test('Evidation reconciles full native detail content in the closing snapshot', async t => {
  replay(t, (row, occurrence) => row.requestedURL === DETAIL + FIRST && occurrence === 2
    ? replace(row, 'About Evidation', 'About the Evidation team') : row)
  await assert.rejects(run(), /changed|reconcil|drift/i)
})

test('Evidation honors caller cancellation before any HTTP request', async t => {
  const calls = replay(t), controller = new AbortController()
  controller.abort(new Error('caller cancelled Evidation'))
  await assert.rejects(run({ signal: controller.signal }), /caller cancelled Evidation/)
  assert.deepEqual(calls, [])
})

test('Evidation rejects an explicit detail country that contradicts native listed locations', async t => {
  replay(t, row => row.requestedURL === DETAIL + FIRST ? native(row, data => { data.props.pageProps.apiData.jobPost.countryCode = 'IN' }) : row)
  await assert.rejects(run(), /country|geography/i)
})

test('Evidation rejects a native listing record explicitly marked internal', async t => {
  replay(t, row => row.requestedURL === FRAME ? native(row, data => { query(data).state.data.items[0].isInternal = true }) : row)
  await assert.rejects(run(), /public|internal|status/i)
})

test('Evidation cannot return an expired role even when it is still listed with an enabled apply control', async t => {
  replay(t, row => row.requestedURL === DETAIL + FIRST ? native(row, data => { data.props.pageProps.apiData.jobPost.validThrough = '2020-01-01T00:00:00Z' }) : row)
  await assert.rejects(run(), /closing|expired|deadline/i)
})

test('Evidation preserves an explicit future native closing date in synthetic India replay', async t => {
  replay(t, row => {
    row = syntheticIndia(row)
    return row.requestedURL.startsWith(DETAIL) ? native(row, data => { data.props.pageProps.apiData.jobPost.validThrough = '2030-01-01T12:30:00Z' }) : row
  })
  const jobs = await run()
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].closingDate, '2030-01-01T12:30:00.000Z')
  assert.equal(jobs[0].postingDate, null)
})

test('Evidation bounds a response body before interpreting its content', async t => {
  replay(t, row => row.requestedURL === CORP ? { ...row, body: Buffer.alloc(3 * 1024 * 1024 + 1, 65) } : row)
  await assert.rejects(run(), /byte bound/i)
})

test('synthetic India replay retains native compensation and separate board notice metadata alongside full role content', async t => {
  replay(t, syntheticIndia)
  const jobs = await run(), first = jobs[0]
  assert.deepEqual(first.nativePayRangeDetails, [{ location: 'Santa Barbara', currency: 'USD', frequency: 'YEAR', rangeStart: 140000, rangeEnd: 350000, isRemote: false }])
  assert.equal(first.nativeVisiblePayRangeText, 'The pay range for this role is: 140,000 - 350,000 USD per year (Santa Barbara)')
  assert.ok(first.sourceDescription.includes('140,000 - 350,000 USD per year'))
  assert.ok(first.sourceDescription.includes('Evidation Health values diversity'))
  assert.ok(first.nativeBoardLegalNoticeHtml.includes('Evidation Health values diversity'))
})

test('Evidation reconciles visible and native compensation across closing snapshots', async t => {
  replay(t, (row, occurrence) => row.requestedURL === DETAIL + FIRST && occurrence === 2
    ? replace(replace(row, '140000', '141000'), '140,000', '141,000') : row)
  await assert.rejects(run(), /changed|reconcil|drift/i)
})

test('Evidation rejects a rendered compensation range that differs from native amounts', async t => {
  replay(t, row => row.requestedURL === DETAIL + FIRST ? replace(row, '140,000', '141,000') : row)
  await assert.rejects(run(), /compensation|salary|pay range/i)
})

test('Evidation rejects contradictory native page and job compensation records', async t => {
  replay(t, row => row.requestedURL === DETAIL + FIRST ? native(row, data => { data.props.pageProps.apiData.payRangeDetails[0].rangeStart = 141000 }) : row)
  await assert.rejects(run(), /compensation|salary|pay range/i)
})

test('Evidation reconciles separate native board notice metadata even when the rendered role stays stable', async t => {
  replay(t, (row, occurrence) => row.requestedURL === DETAIL + FIRST && occurrence === 2 ? native(row, data => {
    const api = data.props.pageProps.apiData
    api.jobBoard.legalNotice = api.jobBoard.legalNotice.replace('we strive to build', 'we continue to strive to build')
    api.jobPost.board.legalNotice = api.jobBoard.legalNotice
  }) : row)
  await assert.rejects(run(), /changed|reconcil|drift/i)
})

test('Evidation checks deadlines on every native location-expanded row', async t => {
  replay(t, row => expandedLocations(row, '2020-01-01T00:00:00Z'))
  await assert.rejects(run(), /closing|expired|deadline/i)
})

test('Evidation distinguishes three location rows from two unique roles in a coherent synthetic expansion', async t => {
  const calls = replay(t, row => expandedLocations(row)), jobs = await run()
  assert.equal(jobs.length, 0)
  assert.equal(calls.length, 14)
  assert.equal(jobs[PROOF].nativeInventory.observedNativeRows, 3)
  assert.equal(jobs[PROOF].nativeInventory.observedUniqueRoles, 2)
  assert.equal(jobs[PROOF].nativeInventory.allDetailsValidated, true)
})
