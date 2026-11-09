import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { gunzipSync } from 'node:zlib'
import { createCatalogScraper, getScraperCatalog } from '../../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const capture = JSON.parse(gunzipSync(readFileSync(new URL('./test-data/unavailable-role-20261109.json.gz', import.meta.url))))
for (const response of capture.responses) assert.equal(createHash('sha256').update(response.body).digest('hex'), response.sha256)
const provider = getScraperCatalog().find(row => row.source === 'ghxindia')
const phase = (rows, key) => rows.find(row => row.phase === key)
const model = row => {
  const match = row.body.match(/window\.__remixContext\s*=\s*([\s\S]+?);<\/script>/)
  return { match, value: JSON.parse(match[1]) }
}
const changeModel = (row, mutate) => { const parsed = model(row); mutate(parsed.value); row.body = row.body.replace(parsed.match[1], JSON.stringify(parsed.value)) }
const jobsOf = row => JSON.parse(row.body)
const changeNative = (rows, mutate) => { for (const key of ['native-opening', 'native-closing']) { const row = phase(rows, key), value = jobsOf(row); mutate(value); row.body = JSON.stringify(value) } }
const held = jobs => {
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.listingComplete, false)
  assert.notEqual(evidence.status, 'complete-inventory')
}
const replay = async (t, { mutate, maxJobs = null, abortAt = null } = {}) => {
  const rows = structuredClone(capture.responses), pending = [...rows], seen = [], controller = new AbortController()
  const reason = Object.create(null)
  Object.defineProperty(reason, 'message', { get: () => assert.fail('Caller reason inspected') })
  Object.defineProperty(reason, Symbol.toPrimitive, { value: () => assert.fail('Caller reason coerced') })
  mutate?.(rows)
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const index = pending.findIndex(row => row.requestedUrl === url)
    const knownRetry = index === -1 && rows.find(row => row.phase === 'native-closing' && row.requestedUrl === url && row.status === 503)
    assert.ok(index !== -1 || knownRetry && seen.filter(key => key === 'native-closing').length < 3, 'No unobserved/extra network request: ' + url)
    const row = index === -1 ? knownRetry : pending.splice(index, 1)[0]
    seen.push(row.phase)
    if (/^(api|redirect|board)-/.test(row.phase)) {
      assert.equal(options.redirect, 'manual')
      assert.ok(options.signal instanceof AbortSignal)
    }
    if (row.phase === abortAt) controller.abort(reason)
    const headers = {}
    if (row.contentType) headers['content-type'] = row.contentType
    if (row.location) headers.location = row.location
    const response = new Response(row.body, { status: row.status, headers })
    Object.defineProperty(response, 'url', { value: row.finalUrl })
    return response
  })
  let jobs, failure
  try { jobs = await createCatalogScraper(provider).run({ maxJobs, signal: controller.signal }) } catch (error) { failure = error }
  if (abortAt) { assert.equal(failure, reason); assert.equal(seen.at(-1), abortAt); return { seen } }
  if (failure) throw failure
  return { jobs, seen, rows }
}

test('GHX qualifies its exact unavailable advertised role only after opening and closing native/public observations', async t => {
  const { jobs, seen } = await replay(t)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'complete-inventory')
  assert.equal(evidence.listingComplete, true)
  assert.equal(evidence.reportedTotal, 30)
  assert.equal(evidence.indiaFacetCount, 14)
  assert.equal(jobs.length, 14)
  assert.ok(jobs.every(job => job.sourceDetailComplete === true && job.country === 'India'
    && job.sourceScopeComplete !== false && job.lifecycleCleanupAllowed !== false))
  assert.deepEqual(seen, capture.responses.map(row => row.phase))
  const proof = jobs[0].sourceNativeInventoryEvidence
  assert.deepEqual(proof.unmatchedOfficialJobIds, ['4730895005'])
  assert.deepEqual(proof.unreconciledOfficialJobIds, [])
  assert.equal(proof.unavailableAdvertisedRoles[0].jobId, '4730895005')
  assert.equal(proof.unavailableAdvertisedRoles[0].opening.api.status, 404)
  assert.equal(proof.unavailableAdvertisedRoles[0].closing.api.status, 404)
  assert.equal(proof.unavailableAdvertisedRoles[0].opening.publicRole.status, 302)
  assert.equal(proof.unavailableAdvertisedRoles[0].closing.publicBoard.nativeCount, 30)
  assert.match(evidence.reason, /advertised-unavailable-verified:4730895005/)
})

for (const [name, mutate] of [
  ['API403', rows => { phase(rows, 'api-opening').status = 403 }],
  ['API429', rows => { phase(rows, 'api-opening').status = 429 }],
  ['unknown404 text', rows => { phase(rows, 'api-opening').body = '{"status":404,"error":"Not found"}' }],
  ['404 carrying a job', rows => { phase(rows, 'api-opening').body = '{"status":404,"error":"Job not found","job":{"id":4730895005}}' }],
  ['foreign API response URL', rows => { phase(rows, 'api-opening').finalUrl = 'https://different.example/response' }],
  ['HTML API404', rows => { phase(rows, 'api-opening').contentType = 'text/html' }],
  ['public active response at role URL', rows => { phase(rows, 'redirect-opening').status = 200 }],
  ['cross-board public redirect', rows => { phase(rows, 'redirect-opening').location = '/foreign?error=true' }],
  ['insecure public redirect', rows => { phase(rows, 'redirect-opening').location = 'http://job-boards.greenhouse.io/globalhealthcareexchangeinc?error=true' }],
  ['credentialed public redirect', rows => { phase(rows, 'redirect-opening').location = 'https://other@job-boards.greenhouse.io/globalhealthcareexchangeinc?error=true' }],
  ['public response on a foreign board', rows => { phase(rows, 'board-opening').finalUrl = 'https://job-boards.greenhouse.io/foreign?error=true' }],
  ['public board403', rows => { phase(rows, 'board-opening').status = 403 }],
  ['public active role model', rows => changeModel(phase(rows, 'board-opening'), m => { m.state.loaderData.root.isJobPost = true })],
  ['foreign public board token', rows => changeModel(phase(rows, 'board-opening'), m => { m.state.loaderData.root.urlToken = 'foreign' })],
  ['foreign public employer', rows => changeModel(phase(rows, 'board-opening'), m => { m.state.loaderData['routes/$url_token'].board.name = 'Foreign Employer' })],
  ['public page continuation', rows => changeModel(phase(rows, 'board-opening'), m => { m.state.loaderData['routes/$url_token'].jobPosts.total_pages = 2 })],
  ['public truncated page', rows => changeModel(phase(rows, 'board-opening'), m => { m.state.loaderData['routes/$url_token'].jobPosts.data.pop() })],
  ['public duplicate role', rows => changeModel(phase(rows, 'board-opening'), m => { const data=m.state.loaderData['routes/$url_token'].jobPosts.data; data[1]=structuredClone(data[0]) })],
  ['public changed title', rows => changeModel(phase(rows, 'board-opening'), m => { m.state.loaderData['routes/$url_token'].jobPosts.data[0].title = 'Other role' })],
  ['public foreign role URL', rows => changeModel(phase(rows, 'board-opening'), m => { m.state.loaderData['routes/$url_token'].jobPosts.data[0].absolute_url = 'https://job-boards.greenhouse.io/foreign/jobs/1' })],
  ['public extra active role state', rows => changeModel(phase(rows, 'board-opening'), m => { m.state.loaderData['routes/$url_token_.jobs_.$job_post_id']={jobPostId:'4730895005',jobPost:{id:4730895005}} })],
  ['public JobPosting schema', rows => { phase(rows, 'board-opening').body += '<script type="application/ld+json">{"@type":"JobPosting","identifier":{"value":"4730895005"}}</script>' }],
  ['inert public state only', rows => { const row=phase(rows,'board-opening'); row.body=row.body.replace(/<script\b[^>]*>window\.__remixContext[\s\S]*?<\/script>/,'<template>$&</template>') }],
  ['duplicate active public state', rows => { const row=phase(rows,'board-opening'); row.body+=row.body.match(/<script\b[^>]*>window\.__remixContext[\s\S]*?<\/script>/)[0] }],
  ['changed closing native state', rows => { const row=phase(rows,'native-closing'), p=jobsOf(row);p.jobs[0].title+=' changed';row.body=JSON.stringify(p) }],
  ['truncated closing native state', rows => { const row=phase(rows,'native-closing'),p=jobsOf(row);p.jobs.pop();row.body=JSON.stringify(p) }],
  ['closing native503', rows => { phase(rows,'native-closing').status=503 }],
  ['closing API200', rows => { phase(rows,'api-closing').status=200 }],
  ['closing unknown404', rows => { phase(rows,'api-closing').body='{"status":404,"error":"Unknown"}' }],
  ['closing public continuation', rows => changeModel(phase(rows,'board-closing'),m=>{m.state.loaderData['routes/$url_token'].jobPosts.total_pages=2})],
  ['closing foreign official handoff', rows => { phase(rows,'official-closing').body+='<a href="https://job-boards.greenhouse.io/foreign">View jobs</a>' }],
  ['oversized public response', rows => { phase(rows,'board-opening').body=' '.repeat(3*1024*1024+1) }],
]) test('GHX keeps advertised-role reconciliation incomplete on ' + name, async t => {
  const { jobs, seen } = await replay(t,{mutate})
  held(jobs)
  assert.ok(jobs.every(job=>job.sourceScopeComplete===false&&job.lifecycleCleanupAllowed===false))
  assert.ok(seen.length<=10)
})

for (const maxJobs of [0,1]) test('GHX unavailable-role proof cannot override cap'+maxJobs, async t=>{
 const {jobs}=await replay(t,{maxJobs});held(jobs);assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
})

test('GHX unavailable-role proof cannot invent India from an unqualified city',async t=>{
 const mutate=rows=>{changeNative(rows,p=>{const row=p.jobs.find(row=>row.id===4750311005);row.location.name='Hyderabad';row.offices=[{id:99999,name:'Hyderabad',location:'Hyderabad',parent_id:null,child_ids:[]}]});for(const key of ['board-opening','board-closing'])changeModel(phase(rows,key),m=>{m.state.loaderData['routes/$url_token'].jobPosts.data.find(row=>row.id===4750311005).location='Hyderabad'})}
 const {jobs}=await replay(t,{mutate});held(jobs);assert.equal(jobs.find(job=>job.jobId===4750311005).country,null)
})

test('GHX unavailable-role proof cannot override thin selected native detail',async t=>{
 const {jobs}=await replay(t,{mutate:rows=>changeNative(rows,p=>{p.jobs.find(row=>row.id===4750311005).content='<p>Apply now</p>'})});held(jobs);assert.equal(jobs.find(job=>job.jobId===4750311005).sourceDetailComplete,false)
})

for(const abortAt of ['api-opening','native-closing','board-closing'])test('GHX unavailable-role audit preserves opaque cancellation at '+abortAt,async t=>{await replay(t,{abortAt})})

for(const target of ['api-opening','board-opening'])test('GHX holds duplicate decoded identity keys in '+target,async t=>{
 const {jobs}=await replay(t,{mutate:rows=>{const row=phase(rows,target);row.body=target==='api-opening'?'{"status":404,"error":"Other response","error":"Job not found"}':row.body.replace('"urlToken":"globalhealthcareexchangeinc"','"urlToken":"foreign","urlToken":"globalhealthcareexchangeinc"')}})
 held(jobs);assert.ok(jobs.every(job=>job.sourceScopeComplete===false&&job.lifecycleCleanupAllowed===false))
})

test('GHX does not extend the unavailable-role exception to an unreviewed advertised ID',async t=>{
 const {jobs,seen}=await replay(t,{mutate:rows=>{for(const key of ['official-opening','official-closing'])phase(rows,key).body=phase(rows,key).body.replaceAll('4730895005','4999999999')}})
 held(jobs);assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,false);assert.deepEqual(seen,['official-opening','native-opening'])
})
test('GHX declared native empty cannot suppress current corporate advertised roles',async t=>{
 const {jobs,seen}=await replay(t,{mutate:rows=>changeNative(rows,p=>{p.jobs=[];p.meta.total=0})})
 assert.equal(jobs.length,0);held(jobs);assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,false);assert.deepEqual(seen,['official-opening','native-opening'])
})
test('GHX closing CSS-hidden modal handoff keeps company scope incomplete',async t=>{
 const {jobs}=await replay(t,{mutate:rows=>{phase(rows,'official-closing').body+='<style>button[data-bs-joburl]{opacity:0}</style>'}});held(jobs)
 assert.ok(jobs.every(job=>job.sourceScopeComplete===false&&job.lifecycleCleanupAllowed===false))
})
test('GHX unknown public listed flag cannot qualify an unavailable-role inventory',async t=>{
 const {jobs}=await replay(t,{mutate:rows=>{for(const key of ['board-opening','board-closing'])changeModel(phase(rows,key),m=>{m.state.loaderData['routes/$url_token'].jobPosts.data[0].isListed='unknown'})}})
 held(jobs);assert.ok(jobs.every(job=>job.sourceScopeComplete===false&&job.lifecycleCleanupAllowed===false))
})

for(const type of ['https://schema.org/JobPosting','http://schema.org/JobPosting',['Thing','https://schema.org/JobPosting'],['WebPage','http://schema.org/JobPosting']])test('GHX qualified active JobPosting type stays held: '+JSON.stringify(type),async t=>{
 const {jobs}=await replay(t,{mutate:rows=>{phase(rows,'board-opening').body+='<script type="application/ld+json">'+JSON.stringify({'@context':'https://schema.org','@type':type,identifier:{value:'4730895005'},url:'https://job-boards.greenhouse.io/globalhealthcareexchangeinc/jobs/4730895005'})+'</script>'}})
 held(jobs);assert.ok(jobs.every(job=>job.sourceScopeComplete===false&&job.lifecycleCleanupAllowed===false))
})

for(const [name,type,value,attributes=''] of [
 ['new Organization carrier','application/ld+json',{'@context':'https://schema.org','@type':'Organization'}],
 ['prefixed context type','application/ld+json',{'@context':{schema:'https://schema.org/'},'@type':'schema:JobPosting'}],
 ['aliased context type','application/ld+json',{'@context':{Vacancy:'https://schema.org/JobPosting'},'@type':'Vacancy'}],
 ['new graph carrier','application/ld+json',{'@graph':[{'@type':'WebPage'}]}],
 ['uppercase MIME','APPLICATION/LD+JSON',{'@type':'JobPosting'}],
 ['whitespace MIME',' application/ld+json ',{'@type':'JobPosting'}],
 ['parameterized MIME','application/ld+json;charset=UTF-8',{'@type':'JobPosting'}],
 ['mixed MIME and parameters',' Application/LD+JSON ; charset=utf-8 ',{'@type':'JobPosting'}],
 ['external structured-data carrier','application/ld+json',{},' src="https://different.example/schema.json"'],
])test('GHX holds an unreviewed active structured-data carrier: '+name,async t=>{
 const {jobs}=await replay(t,{mutate:rows=>{phase(rows,'board-opening').body+='<script type="'+type+'"'+attributes+'>'+JSON.stringify(value)+'</script>'}})
 held(jobs);assert.ok(jobs.every(job=>job.sourceScopeComplete===false&&job.lifecycleCleanupAllowed===false))
})
for(const [before,after] of [['<template>','</template>'],['<!--','-->']])test('GHX inert structured-data control remains excluded: '+before,async t=>{
 const {jobs}=await replay(t,{mutate:rows=>{phase(rows,'board-opening').body+=before+'<script type="application/ld+json">{"@type":"https://schema.org/JobPosting"}</script>'+after}})
 assert.equal(readInventoryEvidence(jobs).status,'complete-inventory');assert.equal(jobs.length,14)
})

for(const [name,before,attributes,after]of [
 ['hidden script','', ' hidden',''],
 ['display:none script','', ' style="display:none"',''],
 ['aria-hidden script','', ' aria-hidden="true"',''],
 ['inert script','', ' inert',''],
 ['display:none ancestor','<div style="display:none">','','</div>'],
])test('GHX retains hidden structured-data carriers as unknown role scope: '+name,async t=>{
 const {jobs}=await replay(t,{mutate:rows=>{phase(rows,'board-opening').body+=before+'<script type="application/ld+json"'+attributes+'>{"@type":"JobPosting","identifier":{"value":"4730895005"}}</script>'+after}})
 held(jobs);assert.ok(jobs.every(job=>job.sourceScopeComplete===false&&job.lifecycleCleanupAllowed===false))
})

test('GHX object fallback structured data is not proved inactive',async t=>{
 const {jobs}=await replay(t,{mutate:rows=>{phase(rows,'board-opening').body+='<object data="https://different.example/view"><script type="application/ld+json">{"@type":"JobPosting","identifier":{"value":"4730895005"}}</script></object>'}})
 held(jobs);assert.ok(jobs.every(job=>job.sourceScopeComplete===false&&job.lifecycleCleanupAllowed===false))
})
