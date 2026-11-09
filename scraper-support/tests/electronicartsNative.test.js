import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { execFileSync } from 'node:child_process'
import { run } from '../../scraper/electronicarts/script.js'
import { document } from '../shared/rmkNativePairHtml.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const root = new URL('../../scraper/electronicarts/fixtures/', import.meta.url)
const read = name => {
  const zipped = new URL(name + '.json.gz', root)
  return JSON.parse(existsSync(zipped) ? gunzipSync(readFileSync(zipped)) : readFileSync(new URL(name + '.json', root)))
}
const listings = read('listing-responses'), firstDetail = read('first-detail-response')
const details = read('detail-responses')
const page = row => ({ status: row.status, url: row.finalUrl || row.url, html: row.body })
const oneRoleListing = () => {
  let html = listings[0].body
  const d = document(html)
  const cards = d.nodes(node => node.tag === 'article' && d.hasClass(node, 'article--result'))
  for (const card of cards.slice(1)) html = html.replace(d.outer(card), '')
  for (const next of d.nodes(node => node.tag === 'a' && d.hasClass(node, 'paginationNextLink'))) html = html.replace(d.outer(next), '')
  return html.replaceAll('1-20', '1-1').replaceAll('345 results', '1 results').replaceAll('of 345', 'of 1')
}
const runOneRole = (body = firstDetail.body, listing = oneRoleListing()) => run({ fetchPage: async url =>
  url.includes('/Home/') ? { ...page(listings[0]), url, html: listing } : { ...page(firstDetail), url, html: body } })

test('EA reconciles all 345 native role details including structured secondary location datasets', async () => {
  assert.equal(details.length, 345)
  assert.equal(new Set(details.map(row => row.url)).size, 345)
  const responses = new Map([...listings, ...details].map(row => [row.url, row]))
  const requested = []
  const jobs = await run({ fetchPage: async url => {
    requested.push(url); assert.ok(responses.has(url))
    if (url === firstDetail.url) await new Promise(resolve => setImmediate(resolve))
    return page(responses.get(url))
  } })
  assert.equal(requested.length, 363)
  assert.equal(jobs.length, 14)
  const expectedIndiaUrls = JSON.parse(readFileSync(new URL('india-detail-urls.json', root)))
  assert.deepEqual(jobs.map(job => job.sourceUrl), expectedIndiaUrls)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 345)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.ok(jobs.every(job => job.country === 'India' && job.postingDate === null && job.jobDescription))
})

test('EA retains a real employer role body, native identity and unknown publication date', async () => {
  const jobs = await runOneRole()
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, '215941')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].postingDate, null)
  assert.match(jobs[0].jobDescription, /Software Engineer Intern/)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})

test('EA checks secondary native countries even when the primary listing location is foreign', async () => {
  const listing = oneRoleListing().replace('Hyderabad, India', 'Vancouver, Canada')
  const secondary = '<ul class="MultipleDataSetFields"><li class="MultipleDataSetField"><span class="MultipleDataSetFieldLabel">Location:</span><span class="MultipleDataSetFieldValue">Hyderabad</span></li><li class="MultipleDataSetField"><span class="MultipleDataSetFieldLabel">State:</span><span class="MultipleDataSetFieldValue">Telangana</span></li><li class="MultipleDataSetField"><span class="MultipleDataSetFieldLabel">Country:</span><span class="MultipleDataSetFieldValue">India</span></li></ul>'
  const body = firstDetail.body.replace('Hyderabad, Telangana, India&nbsp;', 'Vancouver, British Columbia, Canada&nbsp;' + secondary)
  assert.notEqual(body, firstDetail.body)
  const jobs = await runOneRole(body, listing)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].city, 'Hyderabad')
  assert.deepEqual(jobs[0].locations, ['Hyderabad, Telangana, India'])
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  await assert.rejects(runOneRole(body.replace('>India</span>', '>Unknown</span>'), listing), /secondary country/)
  await assert.rejects(runOneRole(body.replace('>Country:</span>', '>Unverified:</span>'), listing), /secondary location field/)
})

test('EA retains missing, hidden and heading-only core bodies as partial India roles', async () => {
  const d = document(firstDetail.body)
  const article = d.nodes(node => node.tag === 'article' && d.hasClass(node, 'article--details'))[1]
  const core = d.nodes(node => d.hasClass(node, 'article__content__view__field__value'), article)[2]
  for (const content of ['', '<h3>Requirements</h3><p>&nbsp;</p>', '<strong>Requirements</strong><p>&nbsp;</p>', '<div hidden>Build our next generation games</div>']) {
    const jobs = await runOneRole(firstDetail.body.replace(d.inner(core), content))
    assert.equal(jobs.length, 1)
    assert.equal(jobs[0].jobDescription, null)
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  }
})

test('EA rejects contradictory India state fields and visibly closed native roles', async () => {
  for (const state of ['CA', 'California']) {
    await assert.rejects(runOneRole(firstDetail.body.replace('Hyderabad, Telangana, India&nbsp;', `Bengaluru, ${state}, India&nbsp;`)), /contradictory.*geography/i)
  }
  const secondary = '<ul class="MultipleDataSetFields"><li class="MultipleDataSetField"><span class="MultipleDataSetFieldLabel">Location:</span><span class="MultipleDataSetFieldValue">Bengaluru</span></li><li class="MultipleDataSetField"><span class="MultipleDataSetFieldLabel">State:</span><span class="MultipleDataSetFieldValue">CA</span></li><li class="MultipleDataSetField"><span class="MultipleDataSetFieldLabel">Country:</span><span class="MultipleDataSetFieldValue">India</span></li></ul>'
  await assert.rejects(runOneRole(firstDetail.body.replace('Hyderabad, Telangana, India&nbsp;', 'Hyderabad, Telangana, India&nbsp;' + secondary)), /contradictory.*geography/i)
  await assert.rejects(runOneRole(firstDetail.body.replace('</body>', '<p>This job is no longer available</p></body>')), /closed|available/i)
})

test('EA verifies all 18 counted native listing pages before classifying detail locations', async () => {
  const listingCalls = []
  await assert.rejects(run({ fetchPage: async url => {
    const row = listings.find(row => row.url === url)
    if (row) { listingCalls.push(url); return page(row) }
    throw Error('EA detail capture required')
  } }), /EA detail capture required/)
  assert.equal(listingCalls.length, 18)
  assert.equal(new Set(listingCalls).size, 18)
})

test('EA refuses truncated envelopes, conflicting native counts and unsupported filter state', async () => {
  for (const [change, expected] of [
    [body => body.replace('</body>', ''), /unclosed/],
    [body => body.replace('of 345', 'of 346'), /count|range|total/i],
    [body => body.replace('value dir="auto"', 'value="Injected filter" dir="auto"'), /filter/i],
  ]) {
    const changed = change(listings[0].body)
    assert.notEqual(changed, listings[0].body)
    await assert.rejects(run({ fetchPage: async url => {
    const row = listings.find(row => row.url === url)
    if (!row) throw Error('Uncaptured detail')
    return page(row === listings[0] ? { ...row, body: changed } : row)
    } }), expected)
  }
})

test('EA rejects wrong native detail identity instead of treating unavailable roles as empty', async () => {
  await assert.rejects(run({ fetchPage: async url => {
    const row = listings.find(row => row.url === url)
    if (row) return page(row)
    return page({ ...firstDetail, finalUrl: url, body: firstDetail.body.replaceAll('215941', '999999') })
  } }), /identity|Role ID|canonical/i)
})

test('EA enforces listing page and aggregate request budgets including noncooperative body reads', async t => {
  await assert.rejects(run({ timeoutMs: 900001 }), /invalid source request budget/)
  await assert.rejects(run({ timeoutMs: 900000, fetchPage: async () => { throw Error('EA fifteen minute budget accepted') } }), /fifteen minute budget accepted/)
  await assert.rejects(run({ maxPages: 1, fetchPage: async () => page(listings[0]) }), /page|incomplete|budget/i)
  await assert.rejects(run({ timeoutMs: 20, fetchPage: () => new Promise(() => {}) }), /timed out/i)
  t.mock.method(globalThis, 'fetch', async url => ({ status: 200, url, text: () => new Promise(() => {}) }))
  await assert.rejects(run({ timeoutMs: 20 }), /timed out/i)
})

test('EA collects every secondary-location detail with bounded concurrency', async () => {
  let active = 0, maximum = 0
  const pending = []
  await assert.rejects(run({ timeoutMs: 1000, fetchPage: async url => {
    const listing = listings.find(row => row.url === url)
    if (listing) return page(listing)
    active++; maximum = Math.max(maximum, active)
    await new Promise(resolve => {
      pending.push(resolve)
      if (pending.length === 8) for (const release of pending) release()
    })
    active--
    throw Error('EA eight detail requests observed')
  } }), /eight detail requests observed/)
  assert.equal(maximum, 8)
  assert.equal(active, 0)
})

test('EA caller cancellation interrupts noncooperative detail requests without advancing the queue', async () => {
  const controller = new AbortController()
  let detailCalls = 0
  await assert.rejects(run({ signal: controller.signal, fetchPage: async url => {
    const listing = listings.find(row => row.url === url)
    if (listing) return page(listing)
    detailCalls++
    if (detailCalls === 8) controller.abort(Error('EA caller cancelled during details'))
    return new Promise(() => {})
  } }), /caller cancelled during details/)
  assert.equal(detailCalls, 8)
})

test('EA advances the continuous queue and aborts all workers on the first detail failure', async () => {
  const signals = [], requested = []
  await assert.rejects(run({ timeoutMs: 1000, fetchPage: async (url, { signal }) => {
    const listing = listings.find(row => row.url === url)
    if (listing) return page(listing)
    requested.push(url); signals.push(signal)
    if (requested.length === 1) return page(firstDetail)
    if (requested.length === 9) throw Error('EA next queued detail failed')
    return new Promise(() => {})
  } }), /next queued detail failed/)
  assert.equal(requested.length, 9)
  assert.ok(signals.every(signal => signal.aborted))
})

test('EA import with a parent dry-run flag performs no network or file writes', () => {
  const url = new URL('../../scraper/electronicarts/script.js', import.meta.url).href
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', `
    import fs from 'node:fs';
    fs.writeFileSync = () => { throw Error('unexpected import write'); };
    globalThis.fetch = () => { throw Error('unexpected import fetch'); };
    process.argv.push('--dry-run'); await import(${JSON.stringify(url)}); console.log('imported');
  `], { encoding: 'utf8', timeout: 5000 })
  assert.equal(output.trim(), 'imported')
})
