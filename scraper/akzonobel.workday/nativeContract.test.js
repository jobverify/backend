import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import assert from 'node:assert/strict'
import test from 'node:test'
import { run } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { analyzePublishableJobs } from '../../scraper-support/utils/publishableJobMetrics.js'
import { extractNativeModel, extractPhAppDdo } from '../../scraper-support/phenom/engine.js'
import { document } from '../../scraper-support/shared/rmkNativePairHtml.js'

const ORIGIN = 'https://careers.akzonobel.com'
const CORPORATE = 'https://www.akzonobel.com/en/careers', HOME = ORIGIN + '/gb/en'
const SEARCH = HOME + '/search-results', BOARD = ORIGIN + '/widgets?from=0'
const now = () => '2026-10-23T08:00:00.000Z'
const load = () => JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/native-20261023.json.gz', import.meta.url))))
const roleModels = html => {
  const dom = document(html)
  return { app: extractNativeModel(html, 'app'), ddo: extractPhAppDdo(html),
    schema: JSON.parse(dom.nodes(n => n.tag === 'script' && n.attrs.type === 'application/ld+json')
      .find(n => JSON.parse(n.raw)['@type'] === 'JobPosting').raw) }
}
const roleHTML = (url, { app, ddo, schema }) => Buffer.from('<link rel="canonical" href="' + url + '">'
  + '<script>var phApp=phApp||' + JSON.stringify(app) + ';phApp.ddo=' + JSON.stringify(ddo) + ';</script>'
  + '<script type="application/ld+json">' + JSON.stringify(schema) + '</script>')
const editRole = (packet, action) => {
  const models = roleModels(packet.body.toString('utf8'))
  action(models.ddo.jobDetail.data.job, models.schema, models.app)
  return { ...packet, body: roleHTML(packet.url, models) }
}
const editSearch = (packet, action) => {
  const data = JSON.parse(packet.body)
  action(data.refineSearch)
  return { ...packet, body: Buffer.from(JSON.stringify(data)) }
}
function mock({ synthetic = 0, edge = false, mutate = packet => packet } = {}) {
  const fixture = load(), listing = fixture.requests.find(p => p.name === 'akzonobel-India-widget-cursor')
  if (edge) fixture.requests.push(...JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/native-edgecases-20261023.json.gz', import.meta.url)))).requests)
  const data = JSON.parse(Buffer.from(listing.rawBodyBase64, 'base64'))
  data.refineSearch.data.jobs = data.refineSearch.data.jobs.filter(j => (edge ? ['56580', '56331'] : ['56226', '48066', '43271']).includes(j.jobId))
  data.refineSearch.hits = data.refineSearch.totalHits = data.refineSearch.data.jobs.length
  if (synthetic) {
    const base = data.refineSearch.data.jobs[0]
    data.refineSearch.data.jobs = Array.from({ length: synthetic }, (_, i) => ({ ...base,
      jobId: String(90000 + i), reqId: String(90000000 + i), jobSeqNo: 'ANDANAGB' + (90000 + i) + 'EXTERNALENGB' }))
    data.refineSearch.totalHits = synthetic
  }
  const calls = []
  return { calls, async transport(url, request) {
    calls.push({ url, method: request.method, body: request.body ?? null })
    let body, type
    if (url.startsWith(ORIGIN + '/widgets?')) {
      assert.equal(request.method, 'POST')
      const query = JSON.parse(request.body)
      assert.deepEqual(query.selected_fields, { country: ['IND'] })
      assert.equal(query.lang, 'en_gb'); assert.equal(query.country, 'gb')
      assert.equal(query.from, Number(new URL(url).searchParams.get('from')))
      const page = structuredClone(data)
      page.refineSearch.data.jobs = page.refineSearch.data.jobs.slice(query.from, query.from + 100)
      page.refineSearch.hits = page.refineSearch.data.jobs.length
      body = Buffer.from(JSON.stringify(page)); type = 'application/json'
    } else {
      assert.equal(request.method, 'GET')
      if (synthetic && url.includes('/job/')) {
        const row = data.refineSearch.data.jobs.find(j => url.includes('/' + j.jobSeqNo + '/'))
        assert.ok(row, url)
        const models = roleModels(Buffer.from(fixture.requests.find(p => p.name === 'akzonobel-public-role-56226').rawBodyBase64, 'base64').toString('utf8'))
        const job = models.ddo.jobDetail.data.job
        Object.assign(job, { jobId: row.jobId, jobReqId: row.jobId, reqId: row.reqId, jobCode: row.reqId, jobSeqNo: row.jobSeqNo })
        models.schema.identifier.value = row.jobId
        body = roleHTML(url, models)
      } else {
        const stored = fixture.requests.find(p => p.url === url)
        assert.ok(stored, url)
        body = Buffer.from(stored.rawBodyBase64, 'base64')
      }
      type = 'text/html'
    }
    return mutate({ url, status: 200, headers: { 'content-type': type }, body, bodyComplete: true }, calls)
  } }
}

test('AkzoNobel sentinel becomes native India extraction with full original ATS content and inactive exclusions', async () => {
  const m = mock(), jobs = await run({ transport: m.transport, now })
  assert.equal(jobs.length, 2)
  const job = jobs.find(j => j.jobId === '56226')
  assert.equal(job.requisitionId, '30001450')
  assert.equal(job.nativePhenomSequenceID, 'ANDANAGB56226EXTERNALENGB')
  assert.equal(job.country, 'India'); assert.equal(job.city, 'Pune')
  assert.equal(job.sourceDescription, job.nativeFacts.nativeAPIRecord.description)
  assert.ok(job.sourceDescription.length > 5000)
  assert.equal(job.nativeVisibleDescriptionHTML, null)
  assert.equal(job.postingDate, '2026-10-21T07:18:40.000Z')
  assert.equal(job.nativeATSPostedDate, '2026-10-21T07:18:40.000+0000')
  assert.equal(job.nativeSchemaDatePosted, '2026-10-07')
  assert.equal(job.nativeCountryAddresses[0].nativeCountryRaw, 'IND')
  assert.equal(job.applyUrl, HOME + '/job/ANDANAGB56226EXTERNALENGB/Asset-and-License-Management-Specialist')
  const evidence = jobs[0].nativeCollectionEvidence
  assert.equal(evidence.exclusions.length, 1)
  assert.equal(evidence.exclusions[0].id, '43271')
  assert.equal(evidence.exclusions[0].exclusionReason, 'native-requisition-on-hold')
  assert.equal(evidence.failures.length, 0)
  assert.equal(evidence.listingPaginationComplete, true)
  assert.equal(evidence.closingInventoryMatches, true)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 3)
  assert.ok(jobs.every(j => !j.lifecycleCleanupAllowed && !j.applicationVisited))
  const analysis = analyzePublishableJobs(jobs, { now: new Date(now()) })
  assert.equal(analysis.eligibleJobs.length, 1)
  assert.equal(analysis.filterCounts.old, 1)
})

test('all 101 synthetic roles cross the native 100-row cursor boundary and reconcile closing inventory', async () => {
  const m = mock({ synthetic: 101 }), jobs = await run({ transport: m.transport, now })
  assert.equal(jobs.length, 101)
  assert.equal(new Set(jobs.map(j => j.jobId)).size, 101)
  assert.equal(jobs[0].nativeCollectionEvidence.pagesFetched, 2)
  assert.deepEqual(m.calls.filter(r => r.method === 'POST').map(r => JSON.parse(r.body).from), [0, 100, 0])
})

test('ATS dates preserve old roles despite later CMS and observation dates', async () => {
  const jobs = await run({ transport: mock().transport, now })
  const old = jobs.find(j => j.jobId === '48066')
  assert.equal(old.postingDate, '2025-09-01T17:31:15.000Z')
  assert.notEqual(old.nativeSchemaDatePosted, old.postingDate.slice(0, 10))
  assert.equal(old.nativeFacts.schemaDateUsedForPostingAge, false)
  assert.equal(jobs[0].nativeCollectionEvidence.exclusions[0].nativeATSPostedDate, '2024-11-06T05:26:06.000+0000')
})

test('missing original descriptions, identities, country conflicts, dates and upstream errors retain other valid roles', async () => {
  for (const kind of ['description', 'schema-description', 'id', 'req', 'sequence', 'tenant', 'country', 'typed-country',
    'native-country', 'address', 'postal-code', 'date', 'future', 'status', 'HTTP']) {
    const m = mock({ mutate: packet => !packet.url.includes('/ANDANAGB56226EXTERNALENGB/') ? packet
      : kind === 'HTTP' ? { ...packet, status: 503 } : editRole(packet, (job, schema, app) => {
        if (kind === 'description') job.description = ''
        if (kind === 'schema-description') schema.description += 'Contradictory employer text'
        if (kind === 'id') schema.identifier.value = '99999'
        if (kind === 'req') job.reqId = '99999999'
        if (kind === 'sequence') job.jobSeqNo = 'ANDANAGB99999EXTERNALENGB'
        if (kind === 'tenant') app.refNum = 'OTHER'
        if (kind === 'country') job.country = 'USA'
        if (kind === 'typed-country') schema.jobLocation.address.addressCountry = 'USA'
        if (kind === 'native-country') job.multi_location[0].country = 'USA'
        if (kind === 'address') job.multi_location[0].city = 'Delhi'
        if (kind === 'postal-code') schema.jobLocation.address.postalCode = '411001'
        if (kind === 'date') job.atsPostedDate = '2026-10-20 07:18:40'
        if (kind === 'future') job.postedDate = '2099-01-01T00:00:00.000+0000'
        if (kind === 'status') job.sfJobStatus = job.postingStatus = 'Unknown'
      }) })
    const jobs = await run({ transport: m.transport, now })
    assert.equal(jobs.length, 1, kind)
    assert.equal(jobs[0].nativeCollectionEvidence.failures.length, 1, kind)
    assert.equal(jobs[0].nativeCollectionEvidence.unknownRawFailures.length, 1, kind)
    assert.equal(jobs[0].nativeCollectionEvidence.exclusions.length, 1, kind)
    assert.equal(jobs[0].lifecycleCleanupAllowed, false)
  }
})

test('failed corporate/tenant/listing checks cannot become a verified zero inventory', async () => {
  for (const target of [CORPORATE, HOME, SEARCH, BOARD]) {
    const m = mock({ mutate: packet => packet.url === target ? { ...packet, status: 503 } : packet })
    await assert.rejects(run({ transport: m.transport, now }), error => {
      assert.equal(error.nativeEvidence.verifiedZeroInventory, false)
      assert.equal(error.nativeEvidence.cleanupAllowed, false)
      return true
    })
  }
})

test('truncated, duplicate, wrong-country and changing listing inventories retain evidence gaps', async () => {
  for (const kind of ['truncated', 'duplicate', 'country', 'closing']) {
    const m = mock({ mutate: (packet, calls) => !packet.url.includes('/widgets?') ? packet
      : editSearch(packet, data => {
        if (kind === 'truncated') data.data.jobs.pop()
        if (kind === 'duplicate') data.data.jobs[2] = data.data.jobs[1]
        if (kind === 'country') data.data.jobs[0].country = 'USA'
        if (kind === 'closing' && calls.filter(p => p.url === BOARD).length === 2) data.totalHits++
      }) })
    if (kind === 'truncated') await assert.rejects(run({ transport: m.transport, now }))
    else {
      const jobs = await run({ transport: m.transport, now })
      assert.equal(jobs.length, kind === 'country' ? 1 : 2, kind)
      assert.ok(jobs[0].nativeCollectionEvidence.failures.length > 0, kind)
      assert.equal(jobs[0].lifecycleCleanupAllowed, false)
    }
  }
})

test('explicit scoped zero preserves reported zero with coverage gap and no deletion authority', async () => {
  const m = mock({ mutate: packet => !packet.url.includes('/widgets?') ? packet
    : editSearch(packet, data => { data.totalHits = data.hits = 0; data.data.jobs = [] }) })
  const jobs = await run({ transport: m.transport, now })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(jobs[Symbol.for('jobverify.native-html-evidence')].verifiedZeroInventory, false)
})

test('bounded native HTTP transport sends only read-only widget POSTs and preserves their method/body', async () => {
  const m = mock(), physical = []
  const jobs = await run({ now, fetchImpl: async (url, request) => {
    physical.push({ url, ...request })
    const packet = await m.transport(url, request)
    return { url, status: packet.status, headers: new Headers(packet.headers),
      body: new ReadableStream({ start(controller) { controller.enqueue(packet.body); controller.close() } }) }
  } })
  assert.equal(jobs.length, 2)
  assert.equal(physical.filter(p => p.method === 'POST').length, 2)
  assert.ok(physical.every(p => p.credentials === 'omit' && p.redirect === 'manual'))
  assert.ok(physical.filter(p => p.method === 'POST').every(p => p.url.startsWith(ORIGIN + '/widgets?')
    && p.headers['Content-Type'] === 'application/json'))
  assert.ok(jobs[0].nativeCollectionEvidence.retainedResponses.filter(p => p.url.startsWith(ORIGIN + '/widgets?'))
    .every(p => p.provenance.nativeReadRequest.method === 'POST'))
})

test('source configuration rejects account/application actions, unlisted details and arbitrary cursors', async () => {
  const { createSourceConfig } = await import('./parser.js'), config = createSourceConfig({ now })
  for (const url of [HOME + '/apply', HOME + '/profile/login', ORIGIN + '/widgets',
    ORIGIN + '/widgets?from=1', ORIGIN + '/widgets?from=00', ORIGIN + '/widgets?from=0&country=USA',
    HOME + '/job/ANDANAGB56226EXTERNALENGB/Asset-and-License-Management-Specialist',
    'https://other.example/widgets?from=0', ORIGIN + '/widgets?from=0#secret',
  ]) assert.throws(() => config.readRequest(url))
})

test('native sequence URL aliases and quoted empty postal codes preserve two current real India roles', async () => {
  const jobs = await run({ transport: mock({ edge: true }).transport, now })
  assert.equal(jobs.length, 2)
  const lead = jobs.find(j => j.jobId === '56580'), analyst = jobs.find(j => j.jobId === '56331')
  assert.equal(lead.nativeCountryAddresses[0].raw.postalCode, '""')
  assert.equal(lead.nativeFacts.nativeAPIRecord.multi_location[0].postalCode, '')
  assert.equal(lead.nativeFacts.nativeQuotedEmptyPostalCode, true)
  assert.equal(lead.nativeSchemaDatePosted, '2026-10-21T07:16:55.000+0000')
  assert.equal(analyst.sourceUrl, HOME + '/job/ANDANAGB56331EXTERNALENGB/ISC-FP-A-Senior-Analyst')
  assert.equal(analyst.nativeFacts.nativeRequestedRoleURL, HOME + '/job/ANDANAGB56331EXTERNALENGB/ISC-FPA-Senior-Analyst')
  assert.equal(jobs[0].nativeCollectionEvidence.failures.length, 0)
  assert.equal(analyzePublishableJobs(jobs, { now: new Date(now()) }).eligibleJobs.length, 2)
})
