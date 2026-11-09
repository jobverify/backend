import test from'node:test'
import assert from'node:assert/strict'
import fs from'node:fs'
import{gunzipSync}from'node:zlib'
import{fileURLToPath}from'node:url'
import{runWorkdayScraper,WORKDAY_ADDITIONAL_WORKSITE_PROOF,validateWorkdayAdditionalWorksiteProof}from'../myworkday/engine.js'
import{currentWorkdayBoardReceipt}from'../myworkday/countryInventoryProof.js'
import{readInventoryEvidence}from'../utils/inventoryEvidence.js'
import{readTemenosOfficePage,reconcileTemenosOffices,buildTemenosWorksiteProof,TEMENOS_BOARD,TEMENOS_CAREERS,TEMENOS_JOBS}from'../../scraper/temenos.workday/worksites.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../scraper/temenos.workday/test-data/worksites-native-20261103.json.gz',import.meta.url))))
const options={source:'temenos',baseUrl:TEMENOS_BOARD,jobsApiUrl:TEMENOS_JOBS,officialCareersUrl:TEMENOS_CAREERS,countryProof:true}
const proof=()=>{const p=reconcileTemenosOffices(fixture.responses.filter(r=>r.url.startsWith('https://www.temenos.com/offices/')).map(r=>readTemenosOfficePage(r.body,r.url))),row=fixture.responses.find(r=>r.url===TEMENOS_CAREERS),response={ok:true,status:200,url:TEMENOS_CAREERS,headers:new Headers({'content-type':'text/html'})},receipt=currentWorkdayBoardReceipt({officialCareersUrl:TEMENOS_CAREERS,boardUrl:TEMENOS_BOARD,response,html:row.body}),clock=Date.now(),closing=structuredClone(p);receipt.fetchedAt=new Date(clock-3).toISOString();p.pages.forEach(page=>{page.fetchedAt=new Date(clock-2).toISOString()});closing.pages.forEach(page=>{page.fetchedAt=new Date(clock-1).toISOString()});return buildTemenosWorksiteProof(p,closing,receipt)}
test('opt-in source proof binds exact country-labelled workplaces while default engine has no new evidence',()=>{
 assert.equal(validateWorkdayAdditionalWorksiteProof(null,options),null)
 const p=validateWorkdayAdditionalWorksiteProof(proof(),options);assert.equal(p.byLabel.get('dubai').country.alpha2Code,'AE');assert.equal(p.byLabel.get('dubai').worksiteIds.length,2);assert.equal(p.byLabel.get('mexico city').country.alpha2Code,'MX');assert.equal(p.byLabel.get('johannesburg').scope,'foreign')
})
test('source, board, corporate identity, incomplete pages and data proof outside complete-board mode fail closed',()=>{
 for(const change of[p=>{p.source='another'},p=>{p.jobsApiUrl=p.jobsApiUrl.replace('temenos/','other/')},p=>{p.corporateReceipt.anchorUrl='https://other.wd1.myworkdayjobs.com/Other'},p=>{p.corporateReceipt.board='https://other.wd1.myworkdayjobs.com/Other'},p=>{p.snapshots[0].pages.pop()},p=>{p.snapshots[0].records.pop()}]){const p=proof();change(p);assert.throws(()=>validateWorkdayAdditionalWorksiteProof(p,options),/worksite.*proof|proof.*worksite/i)}
 assert.throws(()=>validateWorkdayAdditionalWorksiteProof(proof(),{...options,countryProof:false}),/worksite.*proof|proof.*worksite/i)
})
test('ambiguous same-name countries and changed current worksite countries do not qualify their label',()=>{
 const ambiguous=proof();for(const snapshot of ambiguous.snapshots){const r=snapshot.records.find(r=>r.id===166363);r.country={descriptor:'India',alpha2Code:'IN'};r.publisherCountryText='India';r.addressLines[r.addressLines.length-1]='India'}assert.equal(validateWorkdayAdditionalWorksiteProof(ambiguous,options).byLabel.has('dubai'),false)
 const changed=proof();for(const r of changed.snapshots[1].records.filter(r=>r.label==='Dubai')){r.country={descriptor:'India',alpha2Code:'IN'};r.publisherCountryText='India';r.addressLines[r.addressLines.length-1]='India'}assert.equal(validateWorkdayAdditionalWorksiteProof(changed,options).byLabel.has('dubai'),false)
})
test('unqualified remote and explicit country-bearing labels cannot be filled by an office proof',()=>{
 for(const label of['Remote','Global','Unknown','Dubai, India']){const p=proof();for(const s of p.snapshots)for(const r of s.records.filter(r=>r.label==='Dubai'))r.label=label;const data=validateWorkdayAdditionalWorksiteProof(p,options);assert.equal(data.byLabel.has(label.toLowerCase()),false)}
})
test('validated proof values do not follow later mutation of caller data',()=>{
 const p=proof(),verified=validateWorkdayAdditionalWorksiteProof(p,options);p.snapshots[0].records.find(r=>r.label==='Dubai').country.alpha2Code='IN';assert.equal(verified.byLabel.get('dubai').country.alpha2Code,'AE')
})
test('the opt-in proof accepts data only and never executes an accessor or resolver',()=>{
 const p=proof();let reads=0;Object.defineProperty(p,'source',{get(){reads++;return'temenos'},enumerable:true});assert.throws(()=>validateWorkdayAdditionalWorksiteProof(p,options),/worksite.*proof|proof.*worksite/i);assert.equal(reads,0)
 const resolver=proof();resolver.resolveCountry=()=>({alpha2Code:'IN'});assert.throws(()=>validateWorkdayAdditionalWorksiteProof(resolver,options),/worksite.*proof|proof.*worksite/i)
})
test('normalized country must agree with the actual published last address line in both complete snapshots',()=>{
 const p=proof();for(const snapshot of p.snapshots)for(const row of snapshot.records.filter(r=>r.label==='Dubai'))row.country={descriptor:'India',alpha2Code:'IN'}
 assert.throws(()=>validateWorkdayAdditionalWorksiteProof(p,options),/worksite.*proof|proof.*worksite/i)
})
test('current worksite proof rejects stale and future receipts using a deterministic bounded attempt clock',()=>{
 const now=Date.parse('2026-11-03T12:00:05.000Z'),stamp=(p,start=now-5000)=>{
  p.attemptStartedAt=new Date(start).toISOString();p.attemptDeadlineAt=new Date(start+180000).toISOString();p.verifiedAt=new Date(start+3000).toISOString();p.corporateReceipt.fetchedAt=new Date(start+500).toISOString();p.snapshots.forEach((s,i)=>s.pages.forEach(page=>{page.fetchedAt=new Date(start+1000+i*1000).toISOString()}));return p
 }
 const valid=stamp(proof());assert.equal(validateWorkdayAdditionalWorksiteProof(valid,{...options,now}).byLabel.get('dubai').scope,'foreign')
 for(const change of[
  p=>stamp(p,Date.parse('2020-01-01T00:00:00.000Z')),
  p=>{p.verifiedAt=p.corporateReceipt.fetchedAt='2020-01-01T00:00:00.000Z';for(const s of p.snapshots)for(const page of s.pages)page.fetchedAt=p.verifiedAt},
  p=>{p.snapshots[1].pages[0].fetchedAt=new Date(now+1).toISOString()},
  p=>{p.corporateReceipt.fetchedAt=new Date(now+1).toISOString()},
  p=>{p.verifiedAt=new Date(now+1).toISOString()},
  p=>{p.attemptDeadlineAt=new Date(now-1).toISOString()},
  p=>{p.attemptDeadlineAt=new Date(now+3600000).toISOString()},
  p=>{p.snapshots[1].pages.forEach(page=>{page.fetchedAt=p.attemptStartedAt})},
  p=>{p.snapshots[1].pages[0].fetchedAt=p.attemptStartedAt},
 ]){const p=structuredClone(valid);change(p);assert.throws(()=>validateWorkdayAdditionalWorksiteProof(p,{...options,now}),/worksite.*proof|proof.*worksite/i)}
 assert.equal(validateWorkdayAdditionalWorksiteProof(null,{...options,now:NaN}),null)
})

async function exercise(t,{change=()=>{},withProof=true}={}){
 const responses=structuredClone(fixture.responses),calls=[];change(responses)
 const fetchMock=t.mock.method(globalThis,'fetch',async(input,init={})=>{
  const url=String(input),method=init.method||'GET',offset=init.body?JSON.parse(init.body).offset:null
  calls.push({url,method,offset})
  const row=responses.find(r=>r.url===url&&(r.method||'GET')===method&&(method!=='POST'||r.requestBody.offset===offset))
  assert.ok(row,'Unexpected Workday request '+method+' '+url)
  const response=new Response(row.body,{status:row.status,headers:{'content-type':row.contentType}});Object.defineProperty(response,'url',{value:url});return response
 })
 try{return{jobs:await runWorkdayScraper({source:'temenos',company:'Temenos',baseUrl:TEMENOS_BOARD,scraperDir:fileURLToPath(new URL('../../scraper/temenos.workday/',import.meta.url)),requestTimeoutMs:1000,retryBaseDelayMs:0,requestScheduler:{acquire:async()=>()=>{},recordRateLimit:()=>{}},...(withProof?{sourceWorksiteCountryProof:proof()}:{})}),calls}}
 finally{fetchMock.mock.restore()}
}
test('actual22-role Workday pipeline fills only three exact additional worksites and retains its required native scope details',async t=>{
 const {jobs,calls}=await exercise(t)
 assert.deepEqual(jobs,[]);assert.equal(readInventoryEvidence(jobs).reportedTotal,22);assert.equal(readInventoryEvidence(jobs).indiaFacetCount,0);assert.equal(readInventoryEvidence(jobs).listingComplete,true)
 const evidence=jobs[WORKDAY_ADDITIONAL_WORKSITE_PROOF];assert.equal(evidence.roles.length,16)
 const used=evidence.roles.flatMap(r=>r.additionalWorksiteCountryBindings);assert.deepEqual(used.map(r=>r.label).sort(),['Dubai','Johannesburg','Mexico City'])
 const london=evidence.roles.find(r=>r.requisitionId==='JR2344');assert.equal(london.nativePayload.jobPostingInfo.country.descriptor,'United Kingdom');assert.deepEqual(london.nativePayload.jobPostingInfo.additionalLocations,['Dubai']);assert.ok(london.nativePayload.jobPostingInfo.jobDescription)
 assert.equal(calls.filter(c=>c.method==='POST').length,4)
})
test('unchanged default Workday pipeline continues to reject these unsupported additional cities',async t=>{
 await assert.rejects(exercise(t,{withProof:false}),e=>e.code==='WORKDAY_NATIVE_LOCATIONS_UNRESOLVED')
})
test('source office evidence cannot override a conflicting typed native country or fill a primary/remote country',async t=>{
 const detail=rows=>rows.find(r=>r.url.includes('/wday/cxs/')&&r.url.endsWith('CPQ-Transformation-Manager_JR2345'))
 for(const mutation of[
  p=>{p.jobPostingInfo.location='Dubai';p.jobPostingInfo.country={descriptor:'United States',alpha2Code:'US'};p.jobPostingInfo.jobRequisitionLocation={descriptor:'Dubai',country:{descriptor:'United States',alpha2Code:'US'}}},
  p=>{p.jobPostingInfo.location='Dubai';delete p.jobPostingInfo.country;delete p.jobPostingInfo.jobRequisitionLocation},
  p=>{p.jobPostingInfo.additionalLocations=['Remote']},
 ])await assert.rejects(exercise(t,{change:rows=>{const r=detail(rows),p=JSON.parse(r.body);mutation(p);r.body=JSON.stringify(p)}}))
})
test('opt-in country data cannot authorize a changed current corporate tenant handoff',async t=>{
 await assert.rejects(exercise(t,{change:rows=>{rows.find(r=>r.url===TEMENOS_CAREERS).body='<html><a href="https://other.wd1.myworkdayjobs.com/Other">Careers</a></html>'}}),/corporate|Workday|scope/i)
})
