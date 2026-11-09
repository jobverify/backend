import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {SEARCH,parseCargillOfficialRole} from './nativeContract.js'
const load=name=>JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/'+name+'.json.gz',import.meta.url))))
const goodFixture=load('worksite-conflict-20261107'),fixture=load('incomplete-public-office-20261107'),role=fixture.role
const packets=new Map([...goodFixture.packets,...fixture.packets].map(p=>{
 const bytes=Buffer.from(p.bodyBase64,'base64');assert.equal(createHash('sha256').update(bytes).digest('hex'),p.rawBodySHA256??p.bodySHA256)
 return[p.requestURL??p.url,{...p,body:new TextDecoder().decode(bytes)}]
}))
const HOLD='CARGILL_SAME_COUNTRY_PUBLIC_OFFICE_INCOMPLETE'
const escape=s=>s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;')
const page=roles=>({hasJobs:true,hasContent:false,filters:'<input checked data-facet-type="2" data-id="1269750" data-display="India" data-count="'+roles.length+'">',results:'<section id="search-results" data-total-results="'+roles.length+'" data-total-job-results="'+roles.length+'" data-total-pages="1" data-current-page="1" data-records-per-page="15">'+roles.map(({row})=>'<a data-job-id="'+row.publicJobId+'" href="'+escape(row.sourceUrl)+'"><h3>'+escape(row.title)+'</h3><span class="job-location">'+escape(row.nativeListingLocation)+'</span></a>').join('')+'</section>'})
const publicChange=(html,change)=>html.replace(/(<script\b[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/g,(all,open,raw,close)=>{const p=JSON.parse(raw);if(p['@type']!=='JobPosting')return all;change(p);return open+JSON.stringify(p)+close})
const execute=async({roles=[goodFixture.good,role],mutate=()=>{}}={})=>{
 let audit,listings=0,publicReads=0,nativeReads=0
 const jobs=await createCatalogScraper(getScraperCatalog().find(p=>p.source==='cargill')).run({now:fixture.capturedAt,onAudit:value=>{audit=value},fetchImpl:async url=>{
  let response
  if(url.startsWith(SEARCH+'/results?')){listings++;response={status:200,url,body:JSON.stringify(page(roles))}}
  else{const p=packets.get(url);assert.ok(p,'retained genuine response only: '+url);response={status:p.status,url:p.finalURL,body:p.body};if(url===SEARCH)response.body=response.body.replaceAll('data-count="84"','data-count="'+roles.length+'"')}
  if(url===role.row.sourceUrl)publicReads++
  if(url===role.applicationURL)nativeReads++
  mutate(response,url,{publicReads,nativeReads,listings})
  return{status:response.status,url:response.url,text:async()=>response.body,headers:new Headers({'content-type':'text/html'})}
 }})
 return{jobs,audit,publicReads,nativeReads,listings}
}
test('genuine incomplete public office stays held after full native validation and both closing surfaces; healthy role survives',async()=>{
 const{jobs,audit,publicReads,nativeReads,listings}=await execute()
 assert.equal(jobs.length,1);assert.equal(jobs[0].jobId,'337305');assert.equal(jobs[0].jobDescription,goodFixture.good.expectedWholeCriteriaText)
 const held=audit.heldRoles[0]
 assert.equal(held.code,HOLD);assert.equal(held.requisitionId,'335558')
 assert.equal(held.officialModel.addresses[1].addressLocality,'')
 assert.equal(held.officialModel.incompletePublicOffices[0].index,1)
 assert.equal(held.validatedModel.sourceDetailComplete,true)
 assert.equal(held.validatedModel.validatedNativeOffices[0].country,'India')
 assert.ok(held.publicResponse.body&&held.nativeResponse.body&&held.publicClosingResponse.body&&held.nativeClosingResponse.body)
 assert.equal(publicReads,2);assert.equal(nativeReads,2);assert.equal(listings,2)
 assert.equal(jobs.nativeCollectionEvidence,audit)
 assert.equal(audit.incompletePublicOfficeRecords,1)
 assert.equal(audit.worksiteDisagreementRecords,0)
 assert.equal(readSourceObservationEvidence(jobs,'cargill').observedVacancyCount,2)
 assert.equal(jobs[0].lifecycleCleanupAllowed,false)
})
test('default public parser remains strict for genuine blank locality',()=>{
 assert.throws(()=>parseCargillOfficialRole(packets.get(role.row.sourceUrl).body,role.row,{now:fixture.capturedAt}),/Unknown native public role country or office/)
})
test('all incomplete-office candidates still fail with original typed hold after closing evidence',async()=>{
 await assert.rejects(execute({roles:[role]}),e=>e.code===HOLD&&e.nativeCollectionEvidence.heldRoles[0].publicClosingResponse.body&&e.nativeCollectionEvidence.closingInventoryMatches)
})
for(const[name,kind,change]of[
 ['unknown public country','public',s=>publicChange(s,p=>{p.jobLocation[1].address.addressCountry='Unknown'})],
 ['conflicting public country','public',s=>publicChange(s,p=>{p.jobLocation[1].address.addressCountry='Malaysia'})],
 ['missing public country','public',s=>publicChange(s,p=>{delete p.jobLocation[1].address.addressCountry})],
 ['untyped public place','public',s=>publicChange(s,p=>{delete p.jobLocation[1]['@type']})],
 ['wrong address type','public',s=>publicChange(s,p=>{p.jobLocation[1].address['@type']='Organization'})],
 ['extra address authority','public',s=>publicChange(s,p=>{p.jobLocation[1].address.countryCode='MY'})],
 ['extra place authority','public',s=>publicChange(s,p=>{p.jobLocation[1].addressCountry='Malaysia'})],
 ['extra role country authority','public',s=>publicChange(s,p=>{p.addressCountry='Malaysia'})],
 ['extra employer authority','public',s=>publicChange(s,p=>{p.hiringOrganization.legalName='Other'})],
 ['wrong identifier type','public',s=>publicChange(s,p=>{p.identifier['@type']='Organization'})],
 ['null locality','public',s=>publicChange(s,p=>{p.jobLocation[1].address.addressLocality=null})],
 ['absent locality','public',s=>publicChange(s,p=>{delete p.jobLocation[1].address.addressLocality})],
 ['blank region','public',s=>publicChange(s,p=>{p.jobLocation[1].address.addressRegion=''})],
 ['wrong public employer','public',s=>publicChange(s,p=>{p.hiringOrganization.name='Other'})],
 ['invalid public date','public',s=>publicChange(s,p=>{p.datePosted='2026-02-30'})],
 ['wrong native requisition','native',s=>s.replaceAll('335558','999999')],
 ['wrong native employer','native',s=>s.replaceAll('content="cargill"','content="other"')],
 ['missing native country','native',s=>s.replace(/<meta[^>]*itemprop="addressCountry"[^>]*>/g,'')],
 ['conflicting native country','native',s=>s.replace('content="IN"','content="MY"')],
 ['wrong native apply','native',s=>s.replaceAll('/talentcommunity/apply/1375926857/','/talentcommunity/apply/9999999999/')],
 ['invalid native date','native',s=>s.replace(/(itemprop="datePosted"[^>]*content=")[^"]+/,'$1Sun Nov 99 00:00:00 UTC 2026')],
 ['missing native criteria','native',s=>s.replaceAll('itemprop="description"','itemprop="missing-description"')],
])test('incomplete-public-office hold cannot swallow '+name,async()=>{
 let changed=false
 await assert.rejects(execute({mutate:(r,url)=>{if(url===(kind==='public'?role.row.sourceUrl:role.applicationURL)){const before=r.body;r.body=change(before);changed=r.body!==before}}}),e=>e.code!==HOLD)
 assert.ok(changed,'mutation affects genuine body')
})
test('closing public model and native criteria must remain identical; transport and listing drift remain fatal',async()=>{
 await assert.rejects(execute({mutate:(r,url,{publicReads})=>{if(url===role.row.sourceUrl&&publicReads===2)r.body=publicChange(r.body,p=>{p.jobLocation[1].address.addressLocality='Changed'})}}),e=>e.code!==HOLD)
 await assert.rejects(execute({mutate:(r,url,{nativeReads})=>{if(url===role.applicationURL&&nativeReads===2)r.body=r.body.replace('Job Purpose and Impact','Job Purpose and Responsibilities')}}),e=>e.code!==HOLD)
 await assert.rejects(execute({mutate:(r,url)=>{if(url===role.applicationURL)r.status=503}}),e=>e.code!==HOLD)
 await assert.rejects(execute({mutate:(r,url,{listings})=>{if(url.startsWith(SEARCH+'/results?')&&listings===2)r.body=r.body.replaceAll(role.row.publicJobId,'999999999999')}}),/inventory drift/)
})
