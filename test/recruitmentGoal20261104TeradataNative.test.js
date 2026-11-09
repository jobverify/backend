import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import * as source from '../scraper/teradata/script.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'

const packet = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/recruitmentGoal20261104/teradata-native-quality.json.gz', import.meta.url))))
const originals = packet.packets.filter(p => p.requestedURL.endsWith('/graphql'))
const nativeRows = originals.flatMap(p => JSON.parse(p.bodyText).data.searchJobs.results.nodes)
const india = nativeRows.filter(r => JSON.parse(r.structuredDataJSON).jobLocation.address.addressCountry === 'India')
const now = () => '2026-11-05T08:00:00.000Z'
const decode = p => JSON.parse(p.bodyText)
const editRows = (p, edit) => {const data = decode(p); data.data.searchJobs.results.nodes.forEach(edit); p.bodyText = JSON.stringify(data)}
const replay = async (t, edit = () => {}, options = {}) => {
  const calls = [], fetchImpl = async (url, init = {}) => {
    const found = packet.packets.find(p => p.requestedURL === String(url) && (p.method || 'GET') === (init.method || 'GET')
      && (p.method !== 'POST' || JSON.parse(p.body).variables.start === JSON.parse(init.body).variables.start))
    assert.ok(found, 'Uncaptured native Teradata request: ' + url)
    assert.equal(createHash('sha256').update(found.bodyText).digest('hex'), found.bodySHA256)
    const copy = structuredClone(found)
    edit(copy, calls, init)
    calls.push({url: String(url), method: init.method || 'GET', body: init.body, status: copy.status})
    const response = new Response(copy.bodyText, {status: copy.status, headers: {'content-type': copy.contentType}})
    Object.defineProperty(response, 'url', {value: copy.finalURL})
    options.observeResponse?.(response, copy)
    return response
  }
  t.mock.method(globalThis, 'fetch', fetchImpl)
  let jobs, error
  try {jobs = await source.createTeradataScraper().run({fetchImpl, minIntervalMs: 0, now, ...options})} catch (e) {error = e}
  return {jobs, error, calls}
}

test('Teradata reads both current connection pages and closes all 86 full native India models', async t => {
  assert.equal(nativeRows.length, 181)
  assert.equal(india.length, 86)
  const {jobs, error, calls} = await replay(t)
  assert.ifError(error)
  assert.equal(jobs.length, 86)
  assert.deepEqual(jobs.map(j => j.jobId).sort(), india.map(r => r.key).sort())
  assert.deepEqual(calls.filter(c => c.method === 'POST').map(c => JSON.parse(c.body).variables.start), [0, 100, 0, 100])
  for (const job of jobs) {
    const row = nativeRows.find(r => r.key === job.jobId), schema = JSON.parse(row.structuredDataJSON)
    assert.deepEqual(job.nativeSourceRecord.posting, row)
    assert.deepEqual(job.nativeSourceRecord.jobPosting, schema)
    assert.equal(job.country, 'India')
    assert.equal(job.postingDate, row.postedOn)
    assert.equal(job.sourcePostedDateRaw, row.postedOn)
    assert.equal(job.requisitionId, null)
    assert.equal(job.legalEmployer, null)
    assert.equal(job.firstEverPublication, null)
    assert.ok(job.jobDescription.length > 1000)
    assert.equal(job.sourceDetailComplete, true)
    assert.equal(job.nativeRoleClosingReconciled, true)
    assert.equal(job.sourceScopeComplete, false)
    assert.equal(job.lifecycleCleanupAllowed, false)
    assert.equal(job.applicationVisited, false)
  }
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Teradata preserves every own native location, country-only workplaces and the current client URL transformation', async t => {
  const {jobs, error} = await replay(t)
  assert.ifError(error)
  assert.equal(jobs.length, 86)
  const multi = jobs.find(j => j.jobId === '220747')
  assert.equal(multi.country, 'India')
  assert.deepEqual(multi.locations.map(p => p.country), ['India', 'Mexico', 'Czechia', 'Poland'])
  assert.equal(jobs.find(j => j.jobId === '220835').city, null)
  assert.match(jobs.find(j => j.jobId === '220759').sourceUrl, /director-product-management-core-database-engine-and-ai$/)
})

test('Teradata applies a positive cap after native pagination and closing proof', async t => {
  const {jobs, error, calls} = await replay(t, () => {}, {maxJobs: 1})
  assert.ifError(error)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].nativeRoleClosingReconciled, true)
  assert.deepEqual(calls.filter(c => c.method === 'POST').map(c => JSON.parse(c.body).variables.start), [0, 100, 0, 100])
})

test('Teradata zero cap and pre-cancellation do not make requests', async t => {
  let r = await replay(t, () => {}, {maxJobs: 0})
  assert.ifError(r.error)
  assert.equal(r.jobs.length, 0)
  assert.equal(r.calls.length, 0)
  assert.equal(readInventoryEvidence(r.jobs).reportedTotal, null)
  const controller = new AbortController(), reason = Error('Caller stopped the source')
  controller.abort(reason)
  r = await replay(t, () => {}, {signal: controller.signal})
  assert.equal(r.error, reason)
  assert.equal(r.calls.length, 0)
})

for (const [name, change] of [
  ['missing own country', row => {const s = JSON.parse(row.structuredDataJSON); delete s.jobLocation.address.addressCountry; row.structuredDataJSON = JSON.stringify(s)}],
  ['other native employer', row => {const s = JSON.parse(row.structuredDataJSON); s.hiringOrganization.name = 'Other'; row.structuredDataJSON = JSON.stringify(s)}],
  ['incomplete native description', row => {row.descriptionHTML = '<p>Preview only</p>'}],
  ['hidden native criteria', row => {row.descriptionHTML += '<p hidden>New mandatory qualification</p>'; const s = JSON.parse(row.structuredDataJSON); s.description = row.descriptionHTML; row.structuredDataJSON = JSON.stringify(s)}],
]) test('Teradata holds the affected record for ' + name + ' without inferring a replacement', async t => {
  const {jobs, error} = await replay(t, p => {if (p.method === 'POST') editRows(p, row => {if (row.key === '220198') change(row)})})
  assert.ifError(error)
  assert.equal(jobs.length, 85)
  assert.ok(jobs.every(j => j.jobId !== '220198'))
})

test('Teradata withholds a native model whose full closing criteria change', async t => {
  const {jobs, error} = await replay(t, (p, calls) => {
    if (p.method === 'POST' && calls.filter(c => c.method === 'POST').length >= 2) editRows(p, row => {
      if (row.key === '220198') {row.descriptionHTML += '<p>Updated qualification.</p>'; const s = JSON.parse(row.structuredDataJSON); s.description = row.descriptionHTML; row.structuredDataJSON = JSON.stringify(s)}
    })
  })
  assert.ifError(error)
  assert.equal(jobs.length, 85)
  assert.ok(jobs.every(j => j.jobId !== '220198'))
})

for (const [field, markup] of [
  ['descriptionHTML', '<p aria-hidden=true>Sentinel mandatory qualification</p>'],
  ['descriptionHTML', '<p style="visibility: collapse">Sentinel mandatory qualification</p>'],
  ['descriptionHTML', '<p style="display: /* pending */ none">Sentinel mandatory qualification</p>'],
  ['descriptionHTML', '<p style="content-visibility: hidden">Sentinel mandatory qualification</p>'],
  ['descriptionHTML', '<p style="opacity: .0">Sentinel mandatory qualification</p>'],
  ['eeoText', '<p hidden>Sentinel mandatory eligibility</p>'],
  ['eeoText', '<p aria-hidden=true>Sentinel mandatory eligibility</p>'],
]) test('Teradata withholds unreviewed visibility in ' + field + ': ' + markup, async t => {
  const {jobs, error} = await replay(t, p => {if (p.method === 'POST') editRows(p, row => {
    if (row.key !== '220198') return
    row[field] = (row[field] || '') + markup
    if (field === 'descriptionHTML') {
      const schema = JSON.parse(row.structuredDataJSON)
      schema.description = row.descriptionHTML
      row.structuredDataJSON = JSON.stringify(schema)
    }
  })})
  assert.ifError(error)
  assert.equal(jobs.length, 85)
  assert.ok(jobs.every(j => j.jobId !== '220198'), 'Incomplete displayed criteria cannot close as a complete role')
})

for (const status of [202, 401, 403, 429, 451]) test('Teradata stops the source on closing HTTP ' + status + ' and retains unclosed earlier models', async t => {
  const {jobs, error, calls} = await replay(t, (p, calls) => {
    if (p.method === 'POST' && calls.filter(c => c.method === 'POST').length === 2) p.status = status
  })
  assert.ifError(error)
  assert.equal(jobs.length, 86)
  const blocked = calls.findIndex(c => c.status === status)
  assert.equal(calls.length, blocked + 1)
  assert.ok(jobs.every(j => !j.sourceDetailComplete && !j.nativeRoleClosingReconciled && !j.sourceScopeComplete && !j.lifecycleCleanupAllowed))
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
})

for (const what of ['publisher', 'visible field configuration', 'declared client']) test('Teradata rejects a changed ' + what, async t => {
  const {jobs, error} = await replay(t, p => {
    if (what === 'declared client' && p.requestedURL.includes('/pages/_app-')) p.bodyText += '\n// changed client'
    if (p.requestedURL === 'https://careers.teradata.com/jobs' && what !== 'declared client') {
      p.bodyText = p.bodyText.replace(/(<script[^>]*id="__NEXT_DATA__"[^>]*>)([\s\S]*?)(<\/script>)/, (_, a, b, c) => {
        const data = JSON.parse(b)
        if (what === 'publisher') data.props.pageProps.client.name = 'Other'
        else data.props.pageProps.jobPostingSettings.visibleFields.push('UNREVIEWED_MANDATORY_FIELD')
        return a + JSON.stringify(data) + c
      })
    }
  })
  assert.ok(error)
  assert.equal(jobs, undefined)
})

test('Teradata permits only the exact reviewed read-only persisted search body', async () => {
  assert.equal(typeof source.isTeradataSearchRequest, 'function')
  const original = source.buildSearchJobsRequestBody()
  assert.equal(source.isTeradataSearchRequest(original), true)
  for (const edit of [b => {b.operationName = 'submitApplication'}, b => {b.extensions.trustedDocument.id = 'apply'},
    b => {b.query = 'mutation { submit }'}, b => {b.variables.first = 1000000}, b => {b.variables.start = -1},
    b => {b.variables.filters.location = ['unreviewed']}, b => {b.variables.hasUserDefined1 = true}]) {
    const body = structuredClone(original); edit(body)
    assert.equal(source.isTeradataSearchRequest(body), false)
  }
})

test('Teradata retains full earlier native facts when its second opening page is denied', async t => {
  const {jobs, error, calls} = await replay(t, (p, calls) => {
    if (p.method === 'POST' && calls.filter(c => c.method === 'POST').length === 1) p.status = 403
  })
  assert.ifError(error)
  assert.equal(jobs.length, 53)
  assert.ok(jobs.every(j => j.nativeSourceRecord.posting && !j.nativeRoleClosingReconciled && !j.sourceDetailComplete))
  assert.equal(calls.at(-1).status, 403)
  assert.equal(calls.filter(c => c.method === 'POST').length, 2)
})

test('Teradata cancels an interrupted response body before leaving the stopped source', async t => {
  let cancelled = 0
  const {jobs, error} = await replay(t, (p, calls) => {
    if (p.method === 'POST' && calls.filter(c => c.method === 'POST').length === 2) p.status = 202
  }, {observeResponse(response, p) {
    if (p.status !== 200) {
      const original = response.body.cancel.bind(response.body)
      t.mock.method(response.body, 'cancel', async (...args) => {cancelled++; return original(...args)})
    }
  }})
  assert.ifError(error)
  assert.equal(jobs.length, 86)
  assert.equal(cancelled, 1)
})

test('Teradata does not assign a country-shaped city name to an unreferenced secondary workplace', async t => {
  const {jobs, error} = await replay(t, p => {if (p.method === 'POST') editRows(p, row => {
    for (const place of row.places.nodes) if (place.name === 'Mumbai, Maharashtra, India') place.name = 'Georgia'
  })})
  assert.ifError(error)
  assert.equal(jobs.length, 84)
  assert.ok(jobs.every(j => !['220613', '220612'].includes(j.jobId)))
})

test('Teradata rejects a secondary workplace whose own typed country references conflict', async t => {
  const {jobs, error} = await replay(t, p => {if (p.method === 'POST') editRows(p, row => {
    if (row.key === '220601') {const s = JSON.parse(row.structuredDataJSON); s.jobLocation.address.addressCountry = 'Canada'; row.structuredDataJSON = JSON.stringify(s)}
  })})
  assert.ifError(error)
  assert.equal(jobs.length, 85)
  assert.ok(jobs.every(j => j.jobId !== '220747'))
})

test('Teradata preserves caller cancellation while an injected transport does not cooperate', async () => {
  const controller = new AbortController(), reason = Error('Stop pending native transport')
  const result = source.createTeradataScraper().run({signal: controller.signal, fetchImpl: () => new Promise(() => {})})
  controller.abort(reason)
  await assert.rejects(result, error => error === reason)
})

test('Teradata cannot restore known changed opening models after a later closing client denial', async t => {
  const {jobs, error, calls} = await replay(t, (p, calls) => {
    if (p.method === 'POST' && calls.filter(c => c.method === 'POST').length >= 2) editRows(p, row => {
      const schema = JSON.parse(row.structuredDataJSON)
      if (schema.jobLocation?.address?.addressCountry === 'India') {
        row.descriptionHTML += '<p>Known changed qualification.</p>'
        schema.description = row.descriptionHTML
        row.structuredDataJSON = JSON.stringify(schema)
      }
    })
    if (p.requestedURL.includes('/pages/_app-') && calls.some(c => c.url === p.requestedURL)) p.status = 403
  })
  assert.ok(error, 'Known changed closing models must stay excluded after the later failed read')
  assert.equal(jobs, undefined)
  assert.equal(error.inventoryEvidence.listingComplete, false)
  assert.equal(error.recruitmentObservations.heldNativeRows.filter(r => /complete closing native model changed/.test(r.reason)).length, 86)
  assert.equal(calls.at(-1).status, 403)
})

for(const failure of ['later denied page','earlier malformed row'])test('Teradata excludes observed changed closing rows before '+failure,async t=>{
 const first=decode(originals[0]).data.searchJobs.results.nodes
 const target=first.find(r=>india.some(i=>i.key===r.key)&&r!==first[0]).key
 const {jobs,error,calls}=await replay(t,(p,calls)=>{
  if(p.method==='POST'&&calls.filter(c=>c.method==='POST').length>=2){
   const data=decode(p),page=data.data.searchJobs.results
   if(JSON.parse(p.body).variables.start===0){
    page.nodes.find(r=>r.key===target).descriptionHTML+='<p>Observed changed mandatory qualification.</p>'
    if(failure==='earlier malformed row')page.nodes[0].key=null
    p.bodyText=JSON.stringify(data)
   }else if(failure==='later denied page')p.status=403
  }
 })
 assert.ifError(error);assert.ok(jobs.length<86);assert.ok(jobs.every(j=>j.jobId!==target&&!j.sourceDetailComplete&&!j.nativeRoleClosingReconciled))
 assert.ok(calls.at(-1).status===(failure==='later denied page'?403:200))
})
