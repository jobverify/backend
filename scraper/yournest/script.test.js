import assert from 'node:assert/strict'
import test from 'node:test'
import {run,createYourNestScraper} from './script.js'
const gap=e=>e.code==='YOURNEST_COVERAGE_GAP'&&e.inventoryEvidence.reportedTotal===null&&e.lifecycleCleanupAllowed===false
const response=(body,url='https://yournest.in/')=>{const r=new Response(body);Object.defineProperty(r,'url',{value:url});return r}
test('unverified inventory is a typed gap instead of static emptiness',async()=>{await assert.rejects(run({fetchImpl:async()=>response('<h1>YourNest</h1>')}),gap)})
test('factory accepts injected transport failures',async()=>{await assert.rejects(createYourNestScraper({fetchImpl:async()=>{throw Error('offline')}}).run(),gap)})
test('caller abort keeps exact reason',async()=>{const c=new AbortController(),reason={caller:true};c.abort(reason);await assert.rejects(run({signal:c.signal}),e=>e===reason)})
test('aggregate timeout covers stalled bodies and cancels reader',async()=>{let cancelled=false;const r=new Response(new ReadableStream({pull(){return new Promise(()=>{})},cancel(){cancelled=true}}));Object.defineProperty(r,'url',{value:'https://yournest.in/'});await assert.rejects(run({timeoutMs:20,fetchImpl:async()=>r}),gap);assert.equal(cancelled,true)})
test('body must be a bounded stream; no text fallback',async()=>{let called=false,cancelled=false;await assert.rejects(run({fetchImpl:async()=>({url:'https://yournest.in/',status:200,body:{cancel(){cancelled=true}},text(){called=true}})}),gap);assert.equal(called,false);assert.equal(cancelled,true)})
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const fixtureRows=()=>['official-pages','pyjama-pages','api-pages','detail-pages','application-pages'].flatMap(name=>JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/'+name+'.json.gz',import.meta.url)))))
const replay=(rows,options={})=>run({now:new Date('2026-10-23T00:00:00Z'),...options,fetchImpl:async url=>{const row=rows.find(r=>r.url===url);assert.ok(row,'captured request '+url);return response(row.body,row.finalUrl)}})
test('actual native inventory retains original dates, excludes expired own roles and generic pool',async()=>{
 const rows=fixtureRows(),result=await run({now:new Date('2026-10-23T00:00:00Z'),fetchImpl:async url=>{const row=rows.find(r=>r.url===url);assert.ok(row,'captured request '+url);return response(row.body,row.finalUrl)}})
 assert.equal(result.length,0)
 assert.equal(readInventoryEvidence(result)?.status,'coverage-gap')
 assert.equal(readInventoryEvidence(result)?.reportedTotal,null)
 const candidates=result.nativeCollectionEvidence.nativeCandidates
 assert.equal(candidates.length,3)
 assert.equal(candidates.find(r=>r.id===376083).nativePostedDate.raw,'2026-07-07T12:41:03.836418+05:30')
 assert.equal(candidates.find(r=>r.id===374870).nativeValidThrough.raw,'2026-09-01T14:50:27.461782+05:30')
 assert.equal(candidates.find(r=>r.id===376083).exclusionReason,'native-expired')
 assert.equal(candidates.find(r=>r.id===43774).exclusionReason,'generic-talent-pool')
})
test('retained fixture manifest verifies every gzip and uncompressed SHA',()=>{
 const manifest=JSON.parse(readFileSync(new URL('./fixtures/capture-manifest.json',import.meta.url)))
 for(const entry of manifest.files){const compressed=readFileSync(new URL('./fixtures/'+entry.file,import.meta.url));assert.equal(createHash('sha256').update(compressed).digest('hex'),entry.sha256);assert.equal(createHash('sha256').update(gunzipSync(compressed)).digest('hex'),entry.uncompressedSHA256)}
})
test('native country conflicts, publication refreshes and new expiry metadata demand review',async()=>{
 for(const change of [d=>{d.country='United States'},d=>{d.created_at='2026-10-22T12:41:03.836418+05:30'},d=>{d.expiry_date='2027-01-01'}]){
  const rows=fixtureRows(),row=rows.find(r=>r.url.includes('/376083/')),detail=JSON.parse(row.body);change(detail);row.body=JSON.stringify(detail)
  await assert.rejects(replay(rows),gap)
 }
})
test('additional nested or hidden JobPosting carriers cannot bypass native schema review',async()=>{
 const extra={ '@context':'https://schema.org','@graph':[{'@type':'JobPosting',datePosted:'2020-01-01',validThrough:'2020-02-01',jobLocation:{address:{addressCountry:'US'}}}] }
 for(const carrier of [
  '<script type="application/ld+json">'+JSON.stringify(extra)+'</script>',
  '<div hidden><script type="application/ld+json">'+JSON.stringify(extra)+'</script></div>',
 ]){
  const rows=fixtureRows(),row=rows.find(r=>r.url.endsWith('/associate-sr-associate-foundation'))
  row.body=row.body.replace('</body>',carrier+'</body>')
  await assert.rejects(replay(rows),gap)
 }
 const rows=fixtureRows(),row=rows.find(r=>r.url.endsWith('/associate-sr-associate-foundation'))
 row.body=row.body.replace(/(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/,(all,start,json,end)=>{const schema=JSON.parse(json);schema.hiringOrganization.extra={datePosted:'2020-01-01',country:'US'};return start+JSON.stringify(schema)+end})
 await assert.rejects(replay(rows),gap)
})
test('portfolio employer substitutions and unreviewed roles cannot enter own jobs',async()=>{
 const rows=fixtureRows(),row=rows.find(r=>r.url.includes('/376083/')),detail=JSON.parse(row.body);detail.email_domain='portfolio.example';row.body=JSON.stringify(detail)
 await assert.rejects(replay(rows),gap)
 const other=fixtureRows(),listing=other.find(r=>r.url.includes('&page=1')),page=JSON.parse(listing.body);page.results[0].id=999;listing.body=JSON.stringify(page)
 await assert.rejects(replay(other),gap)
})
test('enabled Apply cannot override explicit expiry or unresolved tenant',async()=>{
 const result=await replay(fixtureRows())
 assert.ok(result.nativeCollectionEvidence.nativeCandidates.every(r=>r.activeApplyVerified===false))
 assert.ok(result.nativeCollectionEvidence.nativeCandidates.every(r=>r.nativeApplicationURL.includes('company_uuid=undefined')))
 assert.equal(result.nativeCollectionEvidence.nativeCandidates.filter(r=>r.exclusionReason==='native-expired').length,2)
})
test('synthetic pre-expiry verified tenant application preserves missing-JD eligibility',async()=>{
 const rows=fixtureRows(),api=rows.find(r=>r.url.includes('/376083/')),detail=JSON.parse(api.body)
 detail.description=null;api.body=JSON.stringify(detail)
 for(const row of rows.filter(r=>r.url.startsWith('https://jobs.pyjamahr.com/yournest-venture-capital/'))){
  row.body=row.body.replaceAll('company_uuid=undefined','company_uuid=987EE7EF32')
  if(row.url.endsWith('associate-sr-associate-foundation')){
   row.body=row.body.replace(/(<script id="__NEXT_DATA__"[^>]*>)([\s\S]*?)(<\/script>)/,(all,start,json,end)=>{const data=JSON.parse(json);data.props.pageProps.jobDetails.description=null;return start+JSON.stringify(data)+end})
   row.body=row.body.replace(/(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/,(all,start,json,end)=>{const data=JSON.parse(json);data.description=null;return start+JSON.stringify(data)+end})
  }
 }
 const result=await replay(rows,{now:new Date('2026-07-08T00:00:00Z')})
 assert.equal(result.length,2)
 const job=result.find(r=>r.jobId==='376083')
 assert.equal(job.jobDescription,null);assert.equal(job.sourceDetailStatus,'partial')
 assert.equal(job.postingDate,'2026-07-07T12:41:03.836418+05:30')
 assert.equal(job.country,'India');assert.equal(job.lifecycleCleanupAllowed,false)
 assert.equal(readInventoryEvidence(result).reportedTotal,null)
})
test('caller abort in a body preserves reason and cancels',async()=>{
 const c=new AbortController(),reason={during:true};let started,cancelled=false
 const ready=new Promise(resolve=>{started=resolve}),r=new Response(new ReadableStream({pull(){started();return new Promise(()=>{})},cancel(){cancelled=true}}));Object.defineProperty(r,'url',{value:'https://yournest.in/'})
 const pending=run({signal:c.signal,fetchImpl:async()=>r});await ready;c.abort(reason);await assert.rejects(pending,e=>e===reason);assert.equal(cancelled,true)
})
test('oversized stream and rejected unread HTTP body fail closed',async()=>{
 await assert.rejects(run({fetchImpl:async()=>response('x'.repeat(4000001))}),gap)
 let cancelled=false
 await assert.rejects(run({fetchImpl:async()=>({url:'https://yournest.in/',status:503,body:{cancel(){cancelled=true}}})}),gap)
 assert.equal(cancelled,true)
})

