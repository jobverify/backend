import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {SEARCH,parseCargillRmkDetail} from './nativeContract.js'
const load=name=>JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/'+name+'.json.gz',import.meta.url))))
const worksite=load('worksite-conflict-20261107'),first=load('native-withdrawn-20261107'),fixture=load('native-withdrawn-second-20261107'),closed=fixture.closed
const packets=new Map([...worksite.packets,...first.packets,...fixture.packets].map(p=>{
 const bytes=Buffer.from(p.bodyBase64,'base64');assert.equal(createHash('sha256').update(bytes).digest('hex'),p.rawBodySHA256??p.bodySHA256)
 return[p.requestURL??p.url,{...p,body:new TextDecoder().decode(bytes)}]
}))
const CLOSED='CARGILL_NATIVE_WITHDRAWN_ROLE',escape=s=>s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;')
const page=roles=>({hasJobs:true,hasContent:false,filters:'<input checked data-facet-type="2" data-id="1269750" data-display="India" data-count="'+roles.length+'">',results:'<section id="search-results" data-total-results="'+roles.length+'" data-total-job-results="'+roles.length+'" data-total-pages="1" data-current-page="1" data-records-per-page="15">'+roles.map(({row})=>'<a data-job-id="'+row.publicJobId+'" href="'+escape(row.sourceUrl)+'"><h3>'+escape(row.title)+'</h3><span class="job-location">'+escape(row.nativeListingLocation)+'</span></a>').join('')+'</section>'})
const execute=async({roles=[worksite.good,first.closed,closed],mutate=()=>{}}={})=>{
 let audit,reads=0,listings=0
 const jobs=await createCatalogScraper(getScraperCatalog().find(p=>p.source==='cargill')).run({now:fixture.capturedAt,onAudit:value=>{audit=value},fetchImpl:async url=>{
  let r
  if(url.startsWith(SEARCH+'/results?')){listings++;r={status:200,url,body:JSON.stringify(page(roles))}}
  else{
   let p=packets.get(url)
   if(url===closed.official.applicationURL&&reads++>0)p=packets.get(fixture.packets[2].requestURL)
   assert.ok(p,'genuine captured endpoint: '+url);r={status:p.status,url:p.finalURL,body:p.body}
   if(url===SEARCH)r.body=r.body.replaceAll('data-count="84"','data-count="'+roles.length+'"')
  }
  mutate(r,url,{reads,listings})
  return{status:r.status,url:r.url,text:async()=>r.body,headers:new Headers({'content-type':'text/html'})}
 }})
 return{jobs,audit,reads,listings}
}
test('second exact same-role genuine filled profile retains both independent native closing proofs and healthy full criteria',async()=>{
 const{jobs,audit,reads,listings}=await execute()
 assert.equal(jobs.length,1);assert.equal(jobs[0].jobId,'337305');assert.equal(jobs[0].jobDescription,worksite.good.expectedWholeCriteriaText)
 assert.deepEqual(audit.heldRoles.map(h=>h.requisitionId),['329403','335262'])
 assert.ok(audit.heldRoles.every(h=>h.code===CLOSED&&h.withdrawalProof.nativeStatus==='filled'&&h.nativeClosingResponse.body))
 assert.equal(audit.heldRoles[1].withdrawalProof.companyJobCode,'335262-en_US')
 assert.equal(audit.heldRoles[1].withdrawalProof.nativeRmkPublicId,'1374457657')
 assert.equal(audit.nativeWithdrawnRecords,2);assert.equal(audit.worksiteDisagreementRecords,0)
 assert.equal(readSourceObservationEvidence(jobs,'cargill').observedRecordCount,3)
 assert.equal(readSourceObservationEvidence(jobs,'cargill').observedVacancyCount,1)
 assert.equal(reads,2);assert.equal(listings,2);assert.equal(jobs[0].lifecycleCleanupAllowed,false)
})
test('second withdrawal profile has a precise typed guard and all-held cohort still fails after closing',async()=>{
 const p=packets.get(closed.official.applicationURL)
 assert.throws(()=>parseCargillRmkDetail(p.body,p.finalURL,closed.official,{now:fixture.capturedAt}),e=>e.code===CLOSED&&e.withdrawalProof.requisitionId==='335262')
 await assert.rejects(execute({roles:[closed]}),e=>e.code===CLOSED&&!!e.nativeCollectionEvidence.heldRoles[0].nativeClosingResponse.body)
})
for(const[name,change]of[
 ['first profile job code',s=>s.replace('335262-en_US','329403-en_US')],
 ['wrong employer integration',s=>s.replace('urn:li:organization:2678','urn:li:organization:2679')],
 ['other role title',s=>s.replace('property="og:title" content="Sales Executive"','property="og:title" content="Process Specialist"')],
 ['first profile canonical',s=>s.replace('href="'+fixture.packets[1].finalURL+'"','href="'+first.packets[1].finalURL+'"')],
 ['hidden filled notice',s=>s.replace('<strong>Sorry, this position','<strong hidden>Sorry, this position')],
 ['negated filled notice',s=>s.replace('Sorry, this position has been filled.','This position has not been filled.')],
 ['active application',s=>s.replace('</body>','<a href="/talentcommunity/apply/1374457657/">Apply Now</a></body>')],
 ['different frame activator',s=>s.replace('self === top','self !== top')],
])test('second profile rejects '+name,async()=>{
 let changed=false
 await assert.rejects(execute({mutate:(r,url)=>{if(url===closed.official.applicationURL){const before=r.body;r.body=change(before);changed=r.body!==before}}}),e=>e.code!==CLOSED)
 assert.ok(changed,'mutation affects genuine body')
})
test('second profile status change at independent closing remains fatal',async()=>{
 await assert.rejects(execute({mutate:(r,url,{reads})=>{if(url===closed.official.applicationURL&&reads===2)r.body=r.body.replace('Sorry, this position has been filled.','Current vacancy details are unavailable.')}}),e=>e.code!==CLOSED)
})
