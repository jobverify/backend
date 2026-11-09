import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {HOME,CAREERS,SEARCH,parseCargillRmkDetail} from './nativeContract.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/worksite-conflict-20261107.json.gz',import.meta.url))))
const packets=new Map(fixture.packets.map(packet=>{
 const raw=Buffer.from(packet.bodyBase64,'base64')
 assert.equal(createHash('sha256').update(raw).digest('hex'),packet.bodySHA256)
 return[packet.url,{...packet,body:new TextDecoder().decode(raw)}]
}))
const HOLD='CARGILL_SAME_COUNTRY_WORKSITE_DISAGREEMENT'
const escape=s=>s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;')
const listing=cohort=>({hasJobs:true,hasContent:false,filters:'<input checked data-facet-type="2" data-id="1269750" data-display="India" data-count="'+cohort.length+'">',
 results:'<section id="search-results" data-total-results="'+cohort.length+'" data-total-job-results="'+cohort.length+'" data-total-pages="1" data-current-page="1" data-records-per-page="15">'+cohort.map(({row})=>'<a data-job-id="'+row.publicJobId+'" href="'+escape(row.sourceUrl)+'"><h3>'+escape(row.title)+'</h3><span class="job-location">'+escape(row.nativeListingLocation)+'</span></a>').join('')+'</section>'})
const execute=async({cohort=[fixture.good,fixture.conflict],mutate=()=>{},options={}}={})=>{
 const calls=[]
 let audit,listings=0
 const source=createCatalogScraper(getScraperCatalog().find(p=>p.source==='cargill'))
 const jobs=await source.run({...options,now:fixture.capturedAt,onAudit:value=>{audit=value},fetchImpl:async(url,init)=>{
  let response
  if(url.startsWith(SEARCH+'/results?')){listings++;response={status:200,url,body:JSON.stringify(listing(cohort))}}
  else{const p=packets.get(url);assert.ok(p,'genuine retained endpoint only: '+url);response={status:p.status,url:p.finalURL,body:p.body};if(url===SEARCH)response.body=response.body.replaceAll('data-count="84"','data-count="'+cohort.length+'"')}
  mutate(response,url,{calls,listings})
  calls.push(url)
  return{status:response.status,url:response.url,text:async()=>response.body,headers:new Headers({'content-type':'text/html'})}
 }})
 return{jobs,audit,calls,inventory:readInventoryEvidence(jobs)}
}
test('genuine healthy role survives only the validated same-country worksite hold in a controlled2-role registered cohort',async()=>{
 assert.equal(fixture.controlledCohortTestsOnly,true)
 const{jobs,audit,inventory,calls}=await execute()
 assert.equal(jobs.length,1)
 assert.equal(jobs[0].jobId,'337305')
 assert.equal(jobs[0].jobDescription,fixture.good.expectedWholeCriteriaText)
 assert.equal(jobs[0].sourceDetailComplete,true)
 assert.equal(jobs[0].sourceScopeComplete,false)
 assert.equal(jobs[0].lifecycleCleanupAllowed,false)
 assert.equal(inventory.listingComplete,false)
 assert.equal(inventory.reportedTotal,null)
 assert.equal(audit.observedNativeRecords,2)
 assert.equal(audit.heldRoles.length,1)
 assert.equal(audit.heldRoles[0].requisitionId,'334768')
 assert.equal(audit.heldRoles[0].code,HOLD)
 assert.equal(audit.heldRoles[0].validatedModel.sourceDetailComplete,true)
 assert.ok(audit.heldRoles[0].publicResponse.body&&audit.heldRoles[0].nativeResponse.body)
 assert.equal(audit.rawOpeningRows.length,2)
 assert.deepEqual(audit.rawClosingRows,audit.rawOpeningRows)
 assert.equal(jobs.nativeCollectionEvidence,audit,'rich source audit survives registry decoration')
 assert.equal(readSourceObservationEvidence(jobs,'cargill').observedVacancyCount,2)
 assert.equal(calls.filter(url=>url.startsWith(SEARCH+'/results?')).length,2)
})
test('strict detail parsing still rejects the actual city disagreement with its precise typed guard',()=>{
 const p=packets.get(fixture.conflict.official.applicationURL)
 assert.throws(()=>parseCargillRmkDetail(p.body,p.finalURL,fixture.conflict.official,{now:fixture.capturedAt}),error=>error.code===HOLD)
})
test('all-held cohort rethrows the real worksite guard rather than a successful empty result',async()=>{
 await assert.rejects(execute({cohort:[fixture.conflict]}),error=>error.code===HOLD&&error.nativeCollectionEvidence.heldRoles.length===1
  &&error.nativeCollectionEvidence.rawClosingRows.length===1&&error.nativeCollectionEvidence.closingInventoryMatches)
})
const publicChange=(html,change)=>html.replace(/(<script\b[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/g,(all,open,raw,close)=>{const p=JSON.parse(raw);if(p['@type']!=='JobPosting')return all;change(p);return open+JSON.stringify(p)+close})
for(const[name,kind,change]of[
 ['missing country metadata','native',s=>s.replace(/<meta[^>]*itemprop="addressCountry"[^>]*>/g,'')],
 ['conflicting country metadata','native',s=>s.replace('content="IN"','content="MY"')],
 ['unmatched but valid native country','native',s=>s.replace('IN India, 413802','MY Malaysia, 41380').replace('content="IN"','content="MY"')],
 ['wrong requisition','native',s=>s.replaceAll('334768','999999')],
 ['wrong employer','native',s=>s.replaceAll('content="cargill"','content="unrelated"')],
 ['wrong native apply identity','native',s=>s.replaceAll('/talentcommunity/apply/1373698457/','/talentcommunity/apply/9999999999/')],
 ['invalid native calendar','native',s=>s.replace(/(itemprop="datePosted"[^>]*content=")[^"]+/,'$1Sun Nov 99 00:00:00 UTC 2026')],
 ['missing whole criteria','native',s=>s.replaceAll('itemprop="description"','itemprop="not-description"')],
 ['invalid public calendar','public',s=>publicChange(s,p=>{p.datePosted='2026-02-30'})],
 ['unknown public office country','public',s=>publicChange(s,p=>{p.jobLocation[0].address.addressCountry='Unknown'})],
])test('same-country hold cannot swallow '+name,async()=>{
 const url=kind==='native'?fixture.conflict.official.applicationURL:fixture.conflict.row.sourceUrl
 let changed=false
 await assert.rejects(execute({mutate:(r,address)=>{if(address===url){const before=r.body;r.body=change(before);changed=r.body!==before}}}),error=>error.code!==HOLD)
 assert.equal(changed,true,'mutation affects real captured response')
})
test('held-role transport, cancellation and closing listing changes remain fatal',async()=>{
 await assert.rejects(execute({mutate:(r,url)=>{if(url===fixture.conflict.official.applicationURL)r.status=503}}),error=>error.code!==HOLD)
 const controller=new AbortController(),reason=Error('caller cancelled held detail')
 await assert.rejects(execute({options:{signal:controller.signal},mutate:(r,url)=>{if(url===fixture.conflict.official.applicationURL)controller.abort(reason)}}),error=>error===reason)
 await assert.rejects(execute({mutate:(r,url,{listings})=>{if(url.startsWith(SEARCH+'/results?')&&listings===2)r.body=r.body.replaceAll(fixture.conflict.row.publicJobId,'999999999999')}}),/inventory drift/)
})
test('duplicate requisition across healthy and held roles remains fatal',async()=>{
 await assert.rejects(execute({mutate:(r,url,{calls})=>{
  if(url===fixture.conflict.row.sourceUrl)r.body=r.body.replaceAll('334768','337305')
  if(url===fixture.good.official.applicationURL&&calls.includes(url)){
   const native=packets.get(fixture.conflict.official.applicationURL)
   r.body=native.body.replaceAll('334768','337305');r.url=native.finalURL
  }
 }}),/cross-surface duplicate requisitions/)
})
