import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { run } from './script.js'

const records = JSON.parse(await readFile(new URL('./fixtures/official-responses.json', import.meta.url), 'utf8'))
const blockedFetch = async url => {
  const row = records.find(item => item.url === url)
  assert.ok(row, 'Only captured official pages may be requested')
  return { status: row.status, url: row.finalUrl, text: async () => row.body }
}

test('actual official 403 captures produce unknown inventory and preserve previous jobs', async () => {
  const jobs = await run({ fetchImpl: blockedFetch, nativeRecovery: false })
  const evidence = readInventoryEvidence(jobs)
  assert.deepEqual(jobs, [])
  assert.equal(evidence?.status, 'coverage-gap')
  assert.equal(evidence?.listingComplete, false)
  assert.equal(evidence?.reportedTotal, null)
  assert.equal(evidence?.indiaFacetCount, null)
  assert.equal(evidence?.pagesFetched, 2)
  assert.match(evidence?.reason, /403/)
})

test('unexpected success requires reviewing new careers content instead of claiming zero', async () => {
  await assert.rejects(run({ fetchImpl: async url => ({status: 200, url, text: async () => '<h1>RenewBuy is hiring</h1>'}) }), /surface changed/i)
})

test('redirected employer authority cannot produce a trusted inventory result', async () => {
  await assert.rejects(run({ fetchImpl: async () => ({status: 403, url: 'https://unrelated.example/', text: async () => 'Forbidden'}) }), /authority/i)
})

test('aggregate deadline bounds fetch even when a transport ignores AbortSignal', async () => {
  await assert.rejects(run({ fetchImpl: () => new Promise(() => {}), timeoutMs: 15 }), error => error.name === 'TimeoutError')
})

test('aggregate deadline includes reading the response body', async () => {
  await assert.rejects(run({ fetchImpl: async url => ({status: 403, url, text: () => new Promise(() => {})}), timeoutMs: 15 }), error => error.name === 'TimeoutError')
})

test('caller abort reason remains the exact object during body reading', async () => {
  const controller = new AbortController(), reason = new Error('caller stopped RenewBuy')
  const operation = run({ signal: controller.signal, fetchImpl: async url => ({status: 403, url, text: () => { controller.abort(reason); return new Promise(() => {}) }}) })
  await assert.rejects(operation, error => error === reason)
})

test('pre-aborted callers perform no network requests', async () => {
  const controller = new AbortController(), reason = new Error('cancelled before start')
  controller.abort(reason)
  await assert.rejects(run({signal: controller.signal, fetchImpl: () => {throw new Error('network must not run')} }), error => error === reason)
})

const nativeCompany = JSON.parse(await readFile(new URL('./fixtures/native-company.json', import.meta.url), 'utf8'))
const nativeBoard = JSON.parse(await readFile(new URL('./fixtures/native-jobs.json', import.meta.url), 'utf8'))
const replay = (extra=[], transform=row=>row) => async url => {
  const row = [...records, nativeCompany, nativeBoard, ...extra].find(row=>row.url===url)
  assert.ok(row, 'Missing captured response for '+url)
  const changed=transform({...row})
  return {status:changed.status,url:changed.finalUrl,text:async()=>changed.body}
}

test('native search schema and visible card inventories must agree before details are read', async () => {
  const fetchImpl=replay([],row=>row.url===nativeBoard.url?{...row,body:row.body.replace('"name":"Sales Manager - Agency Channel - Delhi"','"name":"Unrelated position"')}:row)
  await assert.rejects(run({fetchImpl,maxJobs:1}),/structured inventory conflict/i)
})

test('native employer company filter cannot silently broaden to another publisher', async () => {
  const fetchImpl=replay([],row=>row.url===nativeBoard.url?{...row,body:row.body.replace('value="9350817"','value="1234567"')}:row)
  await assert.rejects(run({fetchImpl,maxJobs:1}),/employer filter changed/i)
})
const nativeDetails=JSON.parse(await readFile(new URL('./fixtures/native-details.json',import.meta.url),'utf8')).responses

test('captured native active India role is recovered as an employer-published partial subset',async()=>{
 const jobs=await run({fetchImpl:replay(nativeDetails),maxJobs:1,now:()=> '2026-10-23T06:20:00.000Z'})
 assert.equal(jobs.length,1)
 assert.equal(jobs[0].jobId,'4457850766')
 assert.equal(jobs[0].title,'ARM/RM - Agency- Bhubaneswar')
 assert.equal(jobs[0].location,'Sambalpur, Odisha, India')
 assert.equal(jobs[0].country,'India')
 assert.equal(jobs[0].postingDate,'2026-08-23T00:00:00.000Z')
 assert.ok(jobs[0].jobDescription.includes('Roles and Responsibility'))
 const evidence=readInventoryEvidence(jobs)
 assert.equal(evidence.firstParty,false)
 assert.equal(evidence.status,'discovery-only')
 assert.equal(evidence.listingComplete,false)
 assert.equal(evidence.reportedTotal,139)
})

test('a rate-limited detail stops new requests while retaining previously verified native roles',async()=>{
 const jobs=await run({fetchImpl:replay(nativeDetails),maxJobs:8,now:()=> '2026-10-23T06:20:00.000Z'})
 assert.equal(jobs.length,7)
 assert.deepEqual(new Set(jobs.map(job=>job.jobId)),new Set(['4457850766','4457857705','4457866682','4457853673','4457863691','4457854693','4457863692']))
 assert.match(readInventoryEvidence(jobs).reason,/429/)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

test('an explicit contradictory country in native schema cannot become an India role',async()=>{
 const fetchImpl=replay(nativeDetails,row=>row.url.endsWith('-4457850766')?{...row,body:row.body.replace('"addressCountry":"IN"','"addressCountry":"US"')}:row)
 await assert.rejects(run({fetchImpl,maxJobs:1}),/country conflict/)
})

test('a different employer in native job detail cannot inherit the listing company',async()=>{
 const fetchImpl=replay(nativeDetails,row=>row.url.endsWith('-4457850766')?{...row,body:row.body.replace('"name":"RenewBuy","sameAs"','"name":"Unrelated","sameAs"')}:row)
 await assert.rejects(run({fetchImpl,maxJobs:1}),/employer\/title conflict/)
})

test('native application account redirect must retain the same exact role identity',async()=>{
 const fetchImpl=replay(nativeDetails,row=>row.url.endsWith('-4457850766')?{...row,body:row.body.replaceAll(encodeURIComponent(row.url),encodeURIComponent('https://in.linkedin.com/jobs/view/unrelated-999'))}:row)
 await assert.rejects(run({fetchImpl,maxJobs:1}),/application role conflict|native job identity changed/)
})

test('structured secondary country eligibility cannot contradict India',async()=>{
 const fetchImpl=replay(nativeDetails,row=>row.url.endsWith('-4457850766')?{...row,body:row.body.replace('"employmentType":"FULL_TIME"','"applicantLocationRequirements":{"@type":"Country","name":"United States"},"employmentType":"FULL_TIME"')}:row)
 await assert.rejects(run({fetchImpl,maxJobs:1}),/secondary country restriction conflict/)
})


import { document } from '../../scraper-support/shared/rmkNativePairHtml.js'
test('a verified role without published description remains a nullable description fact',async()=>{
 const fetchImpl=replay(nativeDetails,row=>{
  if(!row.url.endsWith('-4457850766'))return row
  const doc=document(row.body), node=doc.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json').find(n=>JSON.parse(n.raw)['@type']==='JobPosting')
  const schema=JSON.parse(node.raw);delete schema.description
  let body=row.body.replace(node.raw,JSON.stringify(schema))
  for(const description of doc.nodes(n=>doc.hasClass(n,'show-more-less-html__markup')))body=body.replace(doc.outer(description),'')
  return {...row,body}
 })
 const jobs=await run({fetchImpl,maxJobs:1,now:()=> '2026-10-23T06:20:00.000Z'})
 assert.equal(jobs.length,1)
 assert.equal(jobs[0].jobDescription,null)
})

test('content-visibility hidden native identity cannot establish a public role',async()=>{
 const fetchImpl=replay(nativeDetails,row=>row.url.endsWith('-4457850766')?{...row,body:'<section style="content-visibility:hidden">'+row.body+'</section>'}:row)
 await assert.rejects(run({fetchImpl,maxJobs:1}),/canonical|title|identity/)
})

test('a hidden description is nullable and never resurrected from structured markup',async()=>{
 const fetchImpl=replay(nativeDetails,row=>row.url.endsWith('-4457850766')?{...row,body:row.body.replace('class="show-more-less-html__markup','style="content-visibility:hidden" class="show-more-less-html__markup')}:row)
 const jobs=await run({fetchImpl,maxJobs:1})
 assert.equal(jobs.length,1)
 assert.equal(jobs[0].jobDescription,null)
})

test('default native profile failures carry typed unknown inventory evidence',async()=>{
 const fetchImpl=replay(nativeDetails,row=>row.url===nativeCompany.url?{...row,status:503,body:'Service unavailable'}:row)
 await assert.rejects(run({fetchImpl}),error=>error.code==='RENEWBUY_COVERAGE_GAP'&&error.inventoryEvidence?.status==='coverage-gap'&&error.inventoryEvidence.reportedTotal===null&&error.lifecycleCleanupAllowed===false)
})

test('native structured region cannot contradict an explicit India workplace',async()=>{
 const fetchImpl=replay(nativeDetails,row=>row.url.endsWith('-4457850766')?{...row,body:row.body.replace('"addressRegion":null','"addressRegion":"California"')}:row)
 await assert.rejects(run({fetchImpl,maxJobs:1}),/state conflict/)
})

test('a heading-only native description remains null and partial without rejecting its role',async()=>{
 const fetchImpl=replay(nativeDetails,row=>{
  if(!row.url.endsWith('-4457850766'))return row
  const doc=document(row.body), node=doc.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json').find(n=>JSON.parse(n.raw)['@type']==='JobPosting')
  const schema=JSON.parse(node.raw);schema.description='<strong>Responsibilities</strong>'
  let body=row.body.replace(node.raw,JSON.stringify(schema))
  for(const description of doc.nodes(n=>doc.hasClass(n,'show-more-less-html__markup')))body=body.replace(doc.inner(description),'<strong>Responsibilities</strong>')
  return {...row,body}
 })
 const jobs=await run({fetchImpl,maxJobs:1})
 assert.equal(jobs.length,1)
 assert.equal(jobs[0].jobDescription,null)
 assert.equal(jobs[0].sourceDetailComplete,false)
 assert.equal(jobs[0].sourceDetailStatus,'description-unavailable')
 assert.equal(jobs[0].sourceScopeComplete,false)
 assert.equal(jobs[0].lifecycleCleanupAllowed,false)
})
