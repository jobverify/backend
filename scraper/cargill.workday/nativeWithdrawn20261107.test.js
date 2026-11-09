import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {SEARCH,parseCargillRmkDetail} from './nativeContract.js'
const load=name=>JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/'+name+'.json.gz',import.meta.url))))
const worksite=load('worksite-conflict-20261107'),withdrawn=load('native-withdrawn-20261107'),closed=withdrawn.closed
const packets=new Map([...worksite.packets,...withdrawn.packets].map(p=>{
 const raw=Buffer.from(p.bodyBase64,'base64')
 assert.equal(createHash('sha256').update(raw).digest('hex'),p.bodySHA256??p.rawBodySHA256)
 return[p.url??p.requestURL,{...p,body:new TextDecoder().decode(raw)}]
}))
const CLOSED='CARGILL_NATIVE_WITHDRAWN_ROLE'
const escape=s=>s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;')
const page=roles=>({hasJobs:true,hasContent:false,filters:'<input checked data-facet-type="2" data-id="1269750" data-display="India" data-count="'+roles.length+'">',results:'<section id="search-results" data-total-results="'+roles.length+'" data-total-job-results="'+roles.length+'" data-total-pages="1" data-current-page="1" data-records-per-page="15">'+roles.map(({row})=>'<a data-job-id="'+row.publicJobId+'" href="'+escape(row.sourceUrl)+'"><h3>'+escape(row.title)+'</h3><span class="job-location">'+escape(row.nativeListingLocation)+'</span></a>').join('')+'</section>'})
const execute=async({roles=[worksite.good,closed],mutate=()=>{}}={})=>{
 let audit,listings=0,closedReads=0
 const jobs=await createCatalogScraper(getScraperCatalog().find(p=>p.source==='cargill')).run({now:withdrawn.capturedAt,onAudit:value=>{audit=value},fetchImpl:async(url)=>{
  let response
  if(url.startsWith(SEARCH+'/results?')){listings++;response={status:200,url,body:JSON.stringify(page(roles))}}
  else{
   let packet=packets.get(url)
   if(url===closed.official.applicationURL&&closedReads++>0)packet=packets.get(withdrawn.packets[2].requestURL)
   assert.ok(packet,'genuine original response only: '+url)
   response={status:packet.status,url:packet.finalURL,body:packet.body}
   if(url===SEARCH)response.body=response.body.replaceAll('data-count="84"','data-count="'+roles.length+'"')
  }
  mutate(response,url,{listings,closedReads})
  return{status:response.status,url:response.url,text:async()=>response.body,headers:new Headers({'content-type':'text/html'})}
 }})
 return{jobs,audit,closedReads,listings}
}
test('genuine filled native role remains unpublished while healthy role and exact closing tombstone proof survive registered reader',async()=>{
 const{jobs,audit,closedReads,listings}=await execute()
 assert.equal(jobs.length,1)
 assert.equal(jobs[0].jobId,'337305')
 assert.equal(jobs[0].jobDescription,worksite.good.expectedWholeCriteriaText)
 assert.equal(audit.heldRoles.length,1)
 const hold=audit.heldRoles[0]
 assert.equal(hold.requisitionId,'329403')
 assert.equal(hold.code,CLOSED)
 assert.equal(hold.withdrawalProof.nativeRmkPublicId,'1364932157')
 assert.ok(hold.publicResponse.body&&hold.nativeResponse.body&&hold.nativeClosingResponse.body)
 assert.equal(hold.withdrawalProof.nativeStatus,'filled')
 assert.equal(hold.withdrawalProof.countryQualified,false)
 assert.equal(hold.withdrawalProof.criteriaQualified,false)
 assert.equal(closedReads,2)
 assert.equal(listings,2)
 assert.equal(audit.closingInventoryMatches,true)
 assert.equal(jobs.nativeCollectionEvidence,audit)
 const observed=readSourceObservationEvidence(jobs,'cargill')
 assert.equal(observed.recordKind,'mixed')
 assert.equal(observed.observedRecordCount,2)
 assert.equal(observed.observedVacancyCount,1)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(observed.companyIndiaTotal,null)
})
test('worksite conflict and native withdrawal remain separate holds with honest mixed observations',async()=>{
 const{jobs,audit}=await execute({roles:[worksite.good,worksite.conflict,closed]})
 assert.equal(jobs.length,1)
 assert.deepEqual(new Set(audit.heldRoles.map(h=>h.code)),new Set([CLOSED,'CARGILL_SAME_COUNTRY_WORKSITE_DISAGREEMENT']))
 assert.equal(audit.observedRecordCount,3)
 assert.equal(audit.observedVacancyCount,2)
})
test('strict detail parser emits only the precisely bound genuine withdrawal guard',()=>{
 const p=packets.get(closed.official.applicationURL)
 assert.throws(()=>parseCargillRmkDetail(p.body,p.finalURL,closed.official,{now:withdrawn.capturedAt}),error=>error.code===CLOSED)
})
test('all-withdrawn cohort rethrows its real guard after native and listing closing checks',async()=>{
 await assert.rejects(execute({roles:[closed]}),error=>error.code===CLOSED&&error.nativeCollectionEvidence.rawClosingRows.length===1
  &&!!error.nativeCollectionEvidence.heldRoles[0].nativeClosingResponse.body)
})
for(const[name,change]of[
 ['wrong native job code',s=>s.replace('329403-en_US','329404-en_US')],
 ['wrong native employer integration',s=>s.replace('urn:li:organization:2678','urn:li:organization:2679')],
 ['wrong title',s=>s.replace('property="og:title" content="Process Specialist"','property="og:title" content="Unrelated role"')],
 ['wrong canonical',s=>s.replace(/(rel="canonical" href=")[^"]+/, '$1https://jobs.cargill.com/job/Other/9999999999/')],
 ['ambiguous canonical',s=>s.replace('</head>','<link rel="canonical" href="'+withdrawn.packets[1].finalURL+'"></head>')],
 ['hidden notice',s=>s.replace('<strong>Sorry, this position','<strong hidden>Sorry, this position')],
 ['negated notice',s=>s.replace('Sorry, this position has been filled.','This position has not been filled.')],
 ['missing notice',s=>s.replace('Sorry, this position has been filled.','The vacancy status is unavailable.')],
 ['extra author CSS hiding',s=>s.replace('</head>','<style>.jobDisplayShell{display:none!important}</style></head>')],
 ['unreviewed anti-clickjack activator',s=>s.replace('self === top','self !== top')],
 ['active application',s=>s.replace('</body>','<a href="/talentcommunity/apply/1364932157/">Apply Now</a></body>')],
 ['competing active job metadata',s=>s.replace('</body>','<span itemprop="title">Process Specialist</span></body>')],
 ['invalid native calendar assertion',s=>s.replace('</head>','<meta itemprop="datePosted" content="2099-99-99"></head>')],
])test('withdrawal hold rejects '+name,async()=>{
 let changed=false
 await assert.rejects(execute({mutate:(r,url)=>{if(url===closed.official.applicationURL){const before=r.body;r.body=change(before);changed=r.body!==before}}}),error=>error.code!==CLOSED)
 assert.equal(changed,true,'mutation changes genuine tombstone')
})
test('closing withdrawal status or full advertised listing drift remains fatal',async()=>{
 await assert.rejects(execute({mutate:(r,url,{closedReads})=>{if(url===closed.official.applicationURL&&closedReads===2)r.body=r.body.replace('Sorry, this position has been filled.','This position is available.')}}),error=>error.code!==CLOSED)
 await assert.rejects(execute({mutate:(r,url,{listings})=>{if(url.startsWith(SEARCH+'/results?')&&listings===2)r.body=r.body.replaceAll(closed.row.publicJobId,'999999999999')}}),/inventory drift/)
})
