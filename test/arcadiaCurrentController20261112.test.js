import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { readInventoryEvidence, sourceLifecycleCleanupForbidden } from '../scraper-support/utils/inventoryEvidence.js'
import { extractionDetailHealth } from '../scraper-support/utils/extractionDetailHealth.js'

const native = await import('../scraper/arcadia/native.js').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND' && error.url?.endsWith('/scraper/arcadia/native.js')) return {}
  throw error
})
const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/arcadia-current-controller-20261112.json.gz', import.meta.url))))
const CAREERS_URL = 'https://www.arcadia.com/careers'
const LISTING_URL = 'https://www.arcadia.com/api/rippling-jobs'
const component = 'https://www.arcadia.com/_next/static/chunks/4792.8037ed21fe4fcdd2.js'
const routeMap = 'https://www.arcadia.com/_next/static/chunks/pages/%5B...slug%5D-d2de9499420f13d5.js'
const loader = 'https://www.arcadia.com/_next/static/chunks/webpack-5077571903b5b238.js'
const nativeBoard = 'https://ats.rippling.com/arcadiacareers/jobs?pageSize=1000'
const nativeRoute = 'https://ats.us1.rippling.com/_next/static/chunks/pages/%5BjobBoardSlug%5D/jobs-349eb53a50b15de1.js'
const nativeComponent = 'https://ats.us1.rippling.com/_next/static/chunks/387-80356090a770fa21.js'
const roleURL = 'https://ats.rippling.com/arcadiacareers/jobs/d8187038-aa9f-4d9c-8de0-08a476f2cf8c'
const duplicateURL = 'https://ats.rippling.com/arcadiacareers/jobs/c7cca818-4816-4c7b-b35a-2fc9df2b6198'
const evidence = jobs => jobs[Symbol.for('jobverify.native-html-evidence')]

const replay = (mutate, options = {}) => {
  const reads = [], occurrences = new Map()
  const transport = async url => {
    options.signal?.throwIfAborted()
    reads.push(url)
    const index = occurrences.get(url) || 0
    occurrences.set(url, index + 1)
    const candidates = fixture.responses.filter(row => row.url === url)
    assert.ok(candidates.length, 'Only original advertised Arcadia resources may be read: ' + url)
    const row = candidates[Math.min(index, candidates.length - 1)]
    const response = { url, status: row.status, headers: { 'content-type': row.contentType }, bodyComplete: true,
      body: Buffer.from(row.body), requestedAt: row.startedAt, completedAt: row.completedAt }
    mutate?.(response, { url, index })
    return response
  }
  const scraper = () => {
    assert.equal(typeof native.createArcadiaScraper, 'function', 'Arcadia native description and current-inventory adapter is missing')
    return native.createArcadiaScraper()
  }
  return { reads, transport, run: () => scraper().run({ transport, ...options }), collect: () => scraper().collect({ transport, ...options }) }
}
const changedJSON = (response, change) => {
  const payload = JSON.parse(response.body)
  change(payload)
  response.body = Buffer.from(JSON.stringify(payload))
}
const changedNextData = (response, change) => {
  const html = response.body.toString()
  const match = html.match(/<script\b[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  assert.ok(match)
  const data = JSON.parse(match[1])
  change(data)
  response.body = Buffer.from(html.replace(match[1], JSON.stringify(data)))
}
const changedRoleDescription = (response, replacement) => {
  let original
  changedNextData(response, data => {
    const description = data.props.pageProps.apiData.jobPost.description
    original = description.role
    description.role = replacement
  })
  const html = response.body.toString()
  assert.ok(html.includes(original), 'Original visible native description must be present before mutation')
  response.body = Buffer.from(html.replace(original, replacement))
}
const assertHeld = jobs => {
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
  assert.equal(evidence(jobs).sourceScopeComplete, false)
}

test('Arcadia reconciles22 original publisher rows,21 native roles and13 full India descriptions', async () => {
  const source = replay()
  const jobs = await source.run()
  assert.equal(jobs.length, 13)
  assert.equal(new Set(jobs.map(job => job.jobId)).size, 13)
  assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 22)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 13)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), false)
  assert.equal(extractionDetailHealth(jobs).complete, true)
  assert.equal(evidence(jobs).observedListingCount, 22)
  assert.equal(evidence(jobs).listingRecords.length, 21)
  assert.equal(evidence(jobs).exclusions.length, 8)
  assert.equal(evidence(jobs).closingInventoryMatches, true)
  assert.deepEqual(evidence(jobs).failures, [])
  const duplicate = evidence(jobs).exclusions.find(row => row.id === 'c7cca818-4816-4c7b-b35a-2fc9df2b6198')
  assert.equal(duplicate.nativeListingRecord.nativeRecords.length, 2)
  assert.deepEqual(duplicate.nativeVisibleLocationTexts, ['Las Condes, Chile', 'Chile'])
  assert.deepEqual(duplicate.nativeCountryAddresses.map(row => row.country), ['Chile', 'Chile'])
  assert.equal(source.reads.filter(url => /^https:\/\/ats\.rippling\.com\/arcadiacareers\/jobs\/[a-f\d-]{36}$/.test(url)).length, 21)
  assert.deepEqual(source.reads.filter(url => url.includes('/_next/')).sort(), [component, routeMap, loader, nativeRoute, nativeComponent].sort())
  assert.equal(source.reads.filter(url => url === CAREERS_URL).length, 2)
  assert.equal(source.reads.filter(url => url === nativeBoard).length, 2)
  assert.equal(evidence(jobs).nativeBoardInventoryProof.complete, true)
  assert.equal(evidence(jobs).nativeBoardInventoryProof.observedPublisherRows, 22)
  assert.equal(evidence(jobs).nativeBoardInventoryProof.declarationsVerified, true)
  assert.match(readInventoryEvidence(jobs).reason, /native-board-inventory-reconciled/)
  assert.match(readInventoryEvidence(jobs).reason, /native-board-declarations-qualified/)
  assert.ok(jobs.every(job => job.nativePublicationDate === null && job.nativeCreatedOn && job.sourceDetailComplete))
  assert.match(jobs.find(job => job.jobId === 'c171e7d6-aac0-4a67-a99e-0f4f091ca8ea').jobDescription,
    /Degree graduates in BE\/B.Tech/)
  assert.match(jobs.find(job => job.jobId === '463f85ca-3f92-4052-b288-4fda43dfea5e').jobDescription,
    /Our Ideal Candidate Profile/)
})

for (const [label, url, edit] of [
  ['native unfiltered enumeration', component, body => body.replace('/api/rippling-jobs', '/api/unreviewed-jobs')],
  ['recruiting component delegation', routeMap, body => body.replace('a.bind(a,84792)', 'a.bind(a,84791)')],
  ['recruiting chunk loader mapping', loader, body => body.replace('4792:"8037ed21fe4fcdd2"', '4792:"0000000000000000"')],
]) test('Arcadia preserves full known roles but withholds cleanup after changed ' + label, async () => {
  const jobs = await replay((response, state) => { if (state.url === url) response.body = Buffer.from(edit(response.body.toString())) }).run()
  assert.equal(jobs.length, 13)
  assertHeld(jobs)
  assert.ok(evidence(jobs).failures.some(failure => failure.stage === 'public-inventory-proof'))
})

for (const [label, mutate] of [
  ['new recruiting slice', response => changedNextData(response, data => { data.props.pageProps.page.data.slices.push({ slice_type: 'unreviewed_jobs' }) })],
  ['active blank iframe', response => { response.body = Buffer.from(response.body.toString().replace('</body>', '<iframe></iframe></body>')) }],
  ['active srcdoc iframe', response => { response.body = Buffer.from(response.body.toString().replace('</body>', '<iframe srcdoc="New hiring channel"></iframe></body>')) }],
  ['additional recruiting link', response => { response.body = Buffer.from(response.body.toString().replace('</body>', '<a href="https://example.invalid/jobs">View all jobs</a></body>')) }],
]) test('Arcadia retains known roles but rejects unreviewed current careers change: ' + label, async () => {
  const jobs = await replay((response, state) => { if (state.url === CAREERS_URL) mutate(response) }).run()
  assert.equal(jobs.length, 13)
  assertHeld(jobs)
})

for (const [label, mutate] of [
  ['truncated controller', response => { response.bodyComplete = false }],
  ['denied controller', response => { response.status = 403 }],
  ['HTML instead of JavaScript', response => { response.headers['content-type'] = 'text/html' }],
  ['old controller observation', response => { response.requestedAt = '2026-11-12T14:00:00.000Z'; response.completedAt = '2026-11-12T14:00:01.000Z' }],
]) test('Arcadia holds current source scope for ' + label, async () => {
  const jobs = await replay((response, state) => { if (state.url === component) mutate(response) }).run()
  assert.equal(jobs.length, 13)
  assertHeld(jobs)
})

for (const [label, change] of [
  ['additional native envelope metadata', data => { data.hasMore = false }],
  ['unresolved pagination', data => { data.totalPages = 2; data.totalItems = 1001 }],
  ['mismatched publisher total', data => { data.totalItems += 1 }],
  ['unknown country on a foreign office', data => { data.items.find(row => row.id === 'c7cca818-4816-4c7b-b35a-2fc9df2b6198').locations[0].countryCode = 'ZZ' }],
  ['contradictory written country', data => { data.items.find(row => row.id === 'c7cca818-4816-4c7b-b35a-2fc9df2b6198').locations[0].country = 'India' }],
  ['conflicting duplicated role title', data => { data.items.filter(row => row.id === 'c7cca818-4816-4c7b-b35a-2fc9df2b6198')[1].name = 'Unreconciled different role' }],
]) test('Arcadia recovers full India roles while refusing ' + label, async () => {
  const jobs = await replay((response, state) => { if (state.url === LISTING_URL) changedJSON(response, change) }).run()
  assert.equal(jobs.length, 13)
  assertHeld(jobs)
})

test('Arcadia detects worldwide opening/closing feed drift while retaining current known India details', async () => {
  const jobs = await replay((response, state) => {
    if (state.url === LISTING_URL && state.index === 1) changedJSON(response, data => { data.items[1].name += ' changed' })
  }).run()
  assert.equal(jobs.length, 13)
  assertHeld(jobs)
  assert.equal(evidence(jobs).closingInventoryMatches, false)
})

test('Arcadia closing careers document must still advertise the same recruiting surface', async () => {
  const jobs = await replay((response, state) => {
    if (state.url === CAREERS_URL && state.index === 1) response.body = Buffer.from(response.body.toString().replace('job_listing_new', 'retired_jobs'))
  }).run()
  assert.equal(jobs.length, 13)
  assertHeld(jobs)
})

for (const [label, change] of [
  ['foreign native board', data => { data.props.pageProps.apiData.jobBoard.slug = 'different-employer' }],
  ['native role ID mismatch', data => { data.query.jobId = '00000000-0000-0000-0000-000000000000' }],
  ['unlisted role', data => { data.props.pageProps.apiData.jobPost.unlistedFromSearch = true }],
  ['missing native application', data => { data.props.pageProps.apiData.jobPost.activeJobApplication = null }],
]) test('Arcadia rejects one India detail with ' + label, async () => {
  const jobs = await replay((response, state) => { if (state.url === roleURL) changedNextData(response, change) }).run()
  assert.equal(jobs.length, 12)
  assertHeld(jobs)
  assert.ok(evidence(jobs).failures.some(failure => failure.stage === 'native-detail'))
})

for (const [label, replacement] of [
  ['missing qualifications despite long duties', '<h2>What You’ll Do</h2><p>' + 'Carry out accounting operations and financial reporting for assigned business workflows. '.repeat(8) + '</p>'],
  ['missing duties despite long requirements', '<h2>Required Qualifications</h2><p>' + 'Bring accounting experience, clear communication skills, and operational reporting knowledge. '.repeat(8) + '</p>'],
  ['hidden duties and criteria', '<div hidden><h2>Responsibilities</h2><p>' + 'Perform accounting operations. '.repeat(8) + '</p><h2>Requirements</h2><p>' + 'Professional accounting knowledge. '.repeat(8) + '</p></div>'],
]) test('Arcadia cannot mark a role complete with ' + label, async () => {
  const jobs = await replay((response, state) => { if (state.url === roleURL) changedRoleDescription(response, replacement) }).run()
  assert.equal(jobs.length, 12)
  assertHeld(jobs)
  assert.ok(evidence(jobs).failures.some(failure => failure.stage === 'native-detail'))
})

test('Arcadia cannot reconcile a duplicated native role after either explicit office is omitted', async () => {
  const jobs = await replay((response, state) => {
    if (state.url === duplicateURL) changedNextData(response, data => {
      data.props.pageProps.apiData.workLocations.pop()
      data.props.pageProps.apiData.jobPost.workLocations.pop()
    })
  }).run()
  assert.equal(jobs.length, 13)
  assertHeld(jobs)
  assert.equal(evidence(jobs).exclusions.length, 7)
})

test('Arcadia caller cancellation during controller proof preserves its exact abort reason', async () => {
  const controller = new AbortController(), reason = new Error('Cancel Arcadia current proof')
  const source = replay((_response, state) => { if (state.url === component) controller.abort(reason) }, { signal: controller.signal })
  await assert.rejects(source.run(), error => error === reason)
})

test('Arcadia forwards cancellation to a cooperative supplied controller transport', async () => {
  const controller = new AbortController(), reason = new Error('Abort pending Arcadia controller transport')
  const source = replay()
  const transport = (url, request) => {
    if (url !== component) return source.transport(url)
    assert.ok(request?.signal, 'The pending public transport must receive the active collection signal')
    return new Promise((_resolve, reject) => {
      request.signal.addEventListener('abort', () => reject(request.signal.reason), { once: true })
      controller.abort(reason)
    })
  }
  await assert.rejects(native.createArcadiaScraper().run({ transport, signal: controller.signal }), error => error === reason)
})

test('Arcadia rejects an oversized public controller without discarding full known roles', async () => {
  const jobs = await replay((response, state) => {
    if (state.url === component) response.body = Buffer.alloc(2 * 1024 * 1024 + 1, ' ')
  }).run()
  assert.equal(jobs.length, 13)
  assertHeld(jobs)
  assert.ok(evidence(jobs).failures.some(row => /body budget/.test(row.message)))
  assert.ok(evidence(jobs).retainedResponses.every(row => row.bodyBytes <= 2 * 1024 * 1024))
})

test('Arcadia rejects an oversized native role while retaining the other12 India descriptions', async () => {
  const jobs = await replay((response, state) => {
    if (state.url === roleURL) response.body = Buffer.alloc(2 * 1024 * 1024 + 1, ' ')
  }).run()
  assert.equal(jobs.length, 12)
  assertHeld(jobs)
  assert.ok(evidence(jobs).failures.some(row => row.stage === 'native-detail' && /aggregate\/body bound/.test(row.message)))
})

test('Arcadia native aggregate limit holds cleanup and retains details read before the limit', async () => {
  const jobs = await replay((response, state) => {
    if (state.url.startsWith('https://ats.rippling.com/')) response.body = Buffer.concat([
      response.body, Buffer.alloc(640 * 1024 - response.body.length, ' '),
    ])
  }).run()
  assert.ok(jobs.length > 0 && jobs.length < 13)
  assertHeld(jobs)
  assert.ok(evidence(jobs).failures.some(row => /aggregate\/body bound/.test(row.message)))
  assert.ok(evidence(jobs).retainedResponses.reduce((sum, row) => sum + row.bodyBytes, 0) < 16 * 1024 * 1024)
})

test('Arcadia real HTTP transport deadlines return incomplete evidence for pending upstream reads', { timeout: 3000 }, async () => {
  const fetchImpl = (_url, request) => new Promise((_resolve, reject) => {
    request.signal.addEventListener('abort', () => reject(request.signal.reason), { once: true })
  })
  await assert.rejects(native.createArcadiaScraper().run({ fetchImpl, timeoutMs: 20 }), error =>
    error.failureKind === 'coverage_gap' && error.nativeEvidence.publicInventoryProof.complete === false
    && error.nativeEvidence.failures.some(row => /timeout/i.test(row.message)))
})

const boardQuery = data => data.props.pageProps.dehydratedState.queries.find(query => query.queryKey[2] === 'job-posts')
for (const [label, change] of [
  ['extra native published row', data => { const payload = boardQuery(data).state.data; payload.items.push(structuredClone(payload.items[0])); payload.totalItems += 1 }],
  ['missing native published row', data => { const payload = boardQuery(data).state.data; payload.items.pop(); payload.totalItems -= 1 }],
  ['native unresolved continuation', data => { const payload = boardQuery(data).state.data; payload.totalPages = 2; payload.totalItems = 1001 }],
  ['native country filter', data => { boardQuery(data).queryKey[4].country = 'IN' }],
  ['native written country contradiction', data => { const payload = boardQuery(data).state.data; payload.items[0].locations[0].country = 'United States' }],
  ['foreign native board identity', data => { data.props.pageProps.apiData.jobBoard.slug = 'different-company' }],
]) test('Arcadia keeps recovery partial for native board ' + label, async () => {
  const jobs = await replay((response, state) => { if (state.url === nativeBoard) changedNextData(response, change) }).run()
  assert.equal(jobs.length, 13)
  assertHeld(jobs)
})

test('Arcadia requires the complete closing native board inventory after its opening observation', async () => {
  const jobs = await replay((response, state) => {
    if (state.url === nativeBoard && state.index === 1) changedNextData(response, data => { boardQuery(data).state.data.items[0].name += ' changed' })
  }).run()
  assert.equal(jobs.length, 13)
  assertHeld(jobs)
})

for (const index of [0, 1]) test('Arcadia cannot certify an incomplete native board observation ' + index, async () => {
  const jobs = await replay((response, state) => { if (state.url === nativeBoard && state.index === index) response.bodyComplete = false }).run()
  assert.equal(jobs.length, 13)
  assertHeld(jobs)
})

test('Arcadia binds current native board controller bytes before accepting its pageSize contract', async () => {
  const jobs = await replay((response, state) => {
    if (state.url === nativeComponent) response.body = Buffer.from(response.body.toString().replace('pageSize:20', 'pageSize:10'))
  }).run()
  assert.equal(jobs.length, 13)
  assertHeld(jobs)
})

test('Arcadia native board must visibly present every typed publisher workplace card', async () => {
  const jobs = await replay((response, state) => {
    if (state.url === nativeBoard) response.body = Buffer.from(response.body.toString().replace('class="css-aapqz6"', 'hidden class="css-aapqz6"'))
  }).run()
  assert.equal(jobs.length, 13)
  assertHeld(jobs)
})

test('Arcadia native board active embedded recruiting surface prevents complete scope', async () => {
  const jobs = await replay((response, state) => {
    if (state.url === nativeBoard) response.body = Buffer.from(response.body.toString().replace('</body>', '<iframe srcdoc="Additional public hiring"></iframe></body>'))
  }).run()
  assert.equal(jobs.length, 13)
  assertHeld(jobs)
})

for (const target of ['/arcadiacareers/jobs/00000000-0000-0000-0000-000000000000', 'https://jobs.example.invalid/openings']) {
  test('Arcadia rejects an additional native board hiring link: ' + target, async () => {
    const jobs = await replay((response, state) => {
      if (state.url === nativeBoard) response.body = Buffer.from(response.body.toString().replace('</body>', '<a href="' + target + '">More open roles</a></body>'))
    }).run()
    assert.equal(jobs.length, 13)
    assertHeld(jobs)
  })
}

for (const [label, declaration] of [
  ['external script', '<script src="https://example.invalid/extra-careers.js"></script>'],
  ['inline script', '<script>window.extraHiringChannel="https://example.invalid/jobs"</script>'],
  ['form', '<form action="https://example.invalid/jobs"><button>More openings</button></form>'],
  ['form-action button', '<button form="new-hiring" formaction="https://example.invalid/jobs">More openings</button>'],
  ['object', '<object data="https://example.invalid/jobs"></object>'],
  ['embed', '<embed src="https://example.invalid/jobs">'],
  ['hidden frame', '<iframe hidden src="https://example.invalid/jobs"></iframe>'],
  ['event handler', '<button onclick="location.href=\'https://example.invalid/jobs\'">More openings</button>'],
  ['meta refresh', '<meta http-equiv="refresh" content="0;url=https://example.invalid/jobs">'],
  ['module preload', '<link rel="modulepreload" href="https://example.invalid/extra-careers.js">'],
]) test('Arcadia native declaration profile rejects unreviewed ' + label, async () => {
  const jobs = await replay((response, state) => {
    if (state.url === nativeBoard) response.body = Buffer.from(response.body.toString().replace('</body>', declaration + '</body>'))
  }).run()
  assert.equal(jobs.length, 13)
  assertHeld(jobs)
})

test('Arcadia native declaration profile binds the reviewed Cloudflare loader code and resource', async () => {
  const jobs = await replay((response, state) => {
    if (state.url === nativeBoard) response.body = Buffer.from(response.body.toString()
      .replace('/cdn-cgi/challenge-platform/scripts/precursor/main.js', '/unreviewed-careers-loader.js'))
  }).run()
  assert.equal(jobs.length, 13)
  assertHeld(jobs)
})

test('Arcadia keeps reviewed native execution separate from changing Next inventory observation data', async () => {
  const jobs = await replay((response, state) => {
    if (state.url === nativeBoard) changedNextData(response, data => { boardQuery(data).state.dataUpdatedAt += 123 })
  }).run()
  assert.equal(jobs.length, 13)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), false)
})

test('Arcadia native declaration profile qualifies attributes on dynamic native role links', async () => {
  const jobs = await replay((response, state) => {
    if (state.url === nativeBoard) response.body = Buffer.from(response.body.toString()
      .replace('href="/arcadiacareers/jobs/ca22b1e9-3c18-4ac3-b9da-d5a034e349ab"',
        'ping="https://example.invalid/jobs" href="/arcadiacareers/jobs/ca22b1e9-3c18-4ac3-b9da-d5a034e349ab"'))
  }).run()
  assert.equal(jobs.length, 13)
  assertHeld(jobs)
})
