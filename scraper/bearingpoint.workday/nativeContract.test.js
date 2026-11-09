import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {nativeDate} from '../../scraper-support/shared/nativeJobPosting.js'
import {analyzePublishableJobs} from '../../scraper-support/utils/publishableJobMetrics.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/native-20261022.json.gz',import.meta.url))))
const board='https://bearingpointindia.teamtailor.com/jobs',firstID='8578508'
function mock(mutate=r=>r){const requests=[],index=new Map(),calls=new Map();for(const p of fixture.packets)index.set(p.url,[...(index.get(p.url)||[]),p]);return{requests,transport:async url=>{
 requests.push(url);const entries=index.get(url);assert.ok(entries,'Unexpected fixture request: '+url);const i=calls.get(url)||0;calls.set(url,i+1);const p=entries[Math.min(i,entries.length-1)];return mutate({...p,body:Buffer.from(p.rawBodyBase64,'base64')},requests)
}}}
const html=(r,fn)=>({...r,body:Buffer.from(fn(r.body.toString('utf8')))})
const schema=(r,fn)=>html(r,text=>text.replace(/(<script[^>]*type=["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script>)/gi,(_,open,raw,close)=>{const p=JSON.parse(raw);if(p['@type']==='JobPosting')fn(p);return open+JSON.stringify(p)+close}))
test('BearingPoint selected executable replaces sentinel with ten native roles and exact offset dates',async()=>{
 const m=mock(),jobs=await run({transport:m.transport});assert.equal(jobs.length,10)
 const n=jobs[0].nativeCollectionEvidence;assert.equal(n.observedListingCount,10);assert.equal(n.pagesFetched,1);assert.equal(n.candidateDetails,10);assert.equal(n.failures.length,0);assert.equal(n.listingPaginationComplete,true);assert.equal(n.closingInventoryMatches,true)
 assert.equal(m.requests.length,15);assert.ok(m.requests.every(u=>!u.includes('/applications/')&&!u.includes('/login')&&!u.includes('/connect')))
 assert.equal(readInventoryEvidence(jobs).reportedTotal,10);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 for(const j of jobs){assert.equal(j.source,'bearingpoint');assert.equal(j.company,'BearingPoint');assert.equal(j.country,'India');assert.equal(j.city,'Bengaluru');assert.equal(j.remoteStatus,'Hybrid');assert.equal(j.requisitionId,null);assert.equal(j.applyUrl,j.sourceUrl+'/applications/new');assert.equal(j.postingDate,j.nativeFacts.nativeJobPosting.datePosted);assert.equal(new Date(j.postingDate).toISOString(),j.nativeFacts.nativePostedDate.iso);assert.equal(j.nativeHiringOrganization.name,'BearingPoint India');assert.equal(j.sourceScopeComplete,false);assert.equal(j.lifecycleCleanupAllowed,false);assert.equal(j.sourceDescription,j.nativeVisibleDescriptionHTML)}
 const a=analyzePublishableJobs(jobs,{now:new Date('2026-10-22T23:10:00Z')});assert.equal(a.eligibleJobs.length,6);assert.equal(a.filterCounts.old,4)
})
test('truncation, unadvertised pagination, missing totals and duplicate links cannot become verified zero',async()=>{
 for(const variant of ['HTTP','truncated','pagination','total','duplicate','foreign']){
  const m=mock(r=>{if(r.url!==board)return r;if(variant==='HTTP')return{...r,status:503,body:Buffer.from('Unavailable')};return html(r,text=>{
   const d=document(text),c=d.nodes(n=>n.tag==='ul'&&n.attrs.id==='jobs_list_container')[0]
   if(variant==='truncated')return text.replace(d.outer(c.children.find(n=>typeof n!=='string'&&n.tag==='li')),'')
   if(variant==='pagination')return text.replace('<ul id="jobs_list_container"','<a rel="next" href="?page=2">Next</a><ul id="jobs_list_container"')
   if(variant==='total')return text.replace('10 jobs','Open roles')
   const a=d.nodes(n=>n.tag==='a',c)
   if(variant==='duplicate')return text.replace(a[1].attrs.href,a[0].attrs.href)
   return text.replace(a[0].attrs.href,'https://other.example.test/jobs/8578508-foreign')
  })})
  await assert.rejects(run({transport:m.transport}),/incomplete|forbidden/i,variant)
 }
})
test('missing descriptions, invalid dates and role upstream failures remain partial with cleanup prohibited',async()=>{
 for(const variant of ['description','date','future','HTTP','application','identity']){
  const m=mock(r=>{if(!r.url.includes('/jobs/'+firstID+'-'))return r;if(variant==='HTTP')return{...r,status:503,body:Buffer.from('Unavailable')}
   if(variant==='application')return html(r,t=>t.replaceAll('/jobs/'+firstID+'-ivalua-senior-analyst-consultant/applications/new','/jobs/9999999-foreign/applications/new'))
   return schema(r,p=>{if(variant==='description')p.description='';if(variant==='date')p.datePosted='2026-02-30T12:00:00+05:30';if(variant==='future')p.datePosted='2099-10-20T18:42:01+05:30';if(variant==='identity')p.identifier.value='9999999'})})
  const jobs=await run({transport:m.transport});assert.equal(jobs.length,9,variant);assert.ok(!jobs.some(j=>j.jobId===firstID));assert.equal(jobs[0].nativeCollectionEvidence.failures.length,1);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 }
})
test('explicit non-India and foreign employers are excluded without converting city labels into country evidence',async()=>{
 for(const variant of ['country','employer']){const m=mock(r=>r.url.includes('/jobs/'+firstID+'-')?schema(r,p=>{if(variant==='country')p.jobLocation[0].address.addressCountry='GB';else p.hiringOrganization.name='Other employer'}):r)
  const jobs=await run({transport:m.transport});assert.equal(jobs.length,9);assert.equal(jobs[0].nativeCollectionEvidence.exclusions.length,1);assert.equal(jobs[0].nativeCollectionEvidence.failures.length,0)
 }
})
test('closing changes and lost official identity remain evidence gaps',async()=>{
 const m=mock((r,requests)=>r.url===board&&requests.filter(u=>u===board).length===2?html(r,t=>t.replace('10 jobs','11 jobs')):r)
 const jobs=await run({transport:m.transport});assert.equal(jobs.length,10);assert.equal(jobs[0].nativeCollectionEvidence.closingInventoryMatches,false)
 const bad=mock(r=>r.url.includes('www.bearingpoint.com')&&r.status===200?html(r,t=>t.replaceAll('bearingpointindia.teamtailor.com','foreign.teamtailor.com')):r)
 await assert.rejects(run({transport:bad.transport}),/incomplete|forbidden/i)
})
test('zero listed roles remain unknown whole-employer inventory',async()=>{
 const m=mock(r=>r.url===board?html(r,text=>{const d=document(text),c=d.nodes(n=>n.tag==='ul'&&n.attrs.id==='jobs_list_container')[0];return text.replace(d.inner(c),'').replace('10 jobs','0 jobs')}):r)
 const jobs=await run({transport:m.transport});assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).reportedTotal,0);assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.notEqual(readInventoryEvidence(jobs).status,'verified-empty')
})
test('offset dates require the selected source parser; default UTC and calendar precision stay unchanged',async()=>{
 assert.throws(()=>nativeDate('2026-10-20T18:42:01+05:30'),/Unsupported/);assert.equal(nativeDate('2026-10-20').precision,'day');assert.equal(nativeDate('2026-10-20T13:12:01Z').iso,'2026-10-20T13:12:01.000Z')
 const {createSourceConfig,readOffsetDate}=await import('./parser.js'),{createFirstPartyHTMLScraper}=await import('../../scraper-support/shared/firstPartyHtmlJobs.js')
 const config=createSourceConfig();delete config.readNativeDate;const m=mock(),result=await createFirstPartyHTMLScraper(config).collect({transport:m.transport});assert.equal(result.jobs.length,0);assert.equal(result.failures.length,10);assert.ok(result.failures.every(f=>/date format/.test(f.message)))
 assert.equal(readOffsetDate('2026-10-20T18:42:01+05:30').iso,'2026-10-20T13:12:01.000Z');assert.equal(readOffsetDate('2026-10-20T01:00:00-05:30').iso,'2026-10-20T06:30:00.000Z')
 for(const value of ['2026-02-30T12:00:00+05:30','2026-10-20T25:00:00+05:30','2026-10-20T12:00:00+14:01','2026-10-20T12:00:00+05:99'])assert.throws(()=>readOffsetDate(value))
})
