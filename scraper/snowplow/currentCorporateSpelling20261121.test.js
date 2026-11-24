import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
const original=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-data-20261121.json.gz',import.meta.url))))
const observed=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-corporate-spelling-20261121.json.gz',import.meta.url))))
const sha=value=>createHash('sha256').update(value).digest('hex')
const provider=getScraperCatalog().find(row=>row.source==='snowplow')
const oldCorporate=original.packets.corporate,newCorporate=observed.packet,oldFeed=JSON.parse(original.packets.feed.body)
const oldURL='https://signals.snowplow.io/use-cases/in-session-personalisation',newURL='https://signals.snowplow.io/use-cases/in-session-personalization'
async function exercise({opening='current',closing=opening,mutate=(packet)=>packet,signalOnly=false,signal=AbortSignal.timeout(15000),options={}}={}){
 const saved=globalThis.fetch,calls=[],unexpected=[];let jobs,error,audit,harnessFailure
 globalThis.fetch=async(target,init={})=>{
  try{
  const url=String(target),occurrence=calls.filter(row=>row.url===url).length+1
  calls.push({url,method:init.method??'GET'});assert.equal(init.method??'GET','GET');assert.equal(init.body,undefined)
  let packet=Object.values(original.packets).find(row=>row.requestUrl===url)
  if(!packet){unexpected.push(url);return Object.defineProperty(new Response('<html><title>Unknown offline route</title></html>',{status:404,headers:{'content-type':'text/html'}}),'url',{value:url})}
  assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')
  if(url===oldCorporate.requestUrl)packet=(occurrence===1?opening:closing)==='prior'?oldCorporate:newCorporate
  packet=mutate(structuredClone(packet),calls.length)
  return Object.defineProperty(new Response(packet.body,{status:packet.status,headers:packet.headers}),'url',{value:packet.url})
  }catch(caught){harnessFailure=caught;throw caught}
 }
 try{jobs=await createCatalogScraper(provider).run(signalOnly?{signal}:{signal,requestIntervalMs:0,sourceTimeoutMs:20000,onAudit:value=>{audit=value},...options})}catch(caught){error=caught}finally{globalThis.fetch=saved}
 if(harnessFailure)throw harnessFailure
 return{jobs,error,audit,calls,unexpected}
}
function qualifiedData(result,corporate){
 assert.equal(result.error,undefined);assert.deepEqual(result.unexpected,[]);assert.deepEqual(result.calls.map(row=>row.url),original.sequence.map(id=>original.packets[id].requestUrl));assert.equal(result.jobs.length,0)
 const data=result.jobs.nativeCollectionEvidence;assert.equal(data.nativeDataOnly,true);assert.equal(data.nativeInventoryCount,14);assert.equal(data.nativeDataClosingReconciled,true);assert.equal(data.applicationCriteriaReviewed,false);assert.equal(data.sourceScopeComplete,false);assert.equal(data.lifecycleCleanupAllowed,false);assert.equal(data.companyGlobalTotal,null);assert.equal(data.companyIndiaTotal,null)
 assert.deepEqual(data.nativeDataObservations.map(row=>row.rawNativeRecord),oldFeed.jobAdDetails)
 assert(data.nativeDataObservations.every(row=>row.dataCriteriaReviewed&&row.nativeDataClosingReconciled&&!row.applicationCriteriaReviewed&&!row.sourceDetailComplete&&row.publishedAt===row.rawNativeRecord.publishedAt&&row.validThrough===row.rawNativeRecord.validThrough&&row.closingDate===row.rawNativeRecord.closingDate))
 assert(data.nativeDataObservations.find(row=>row.jobId==='1b29b2e2-8fa7-431f-948d-060d8ec1fe33').countryDisagreement)
 const inventory=readInventoryEvidence(result.jobs);assert.equal(inventory.listingComplete,false);assert.equal(inventory.reportedTotal,null);assert.equal(inventory.indiaFacetCount,null);assert.equal(sourceLifecycleCleanupForbidden(result.jobs),true)
 if(corporate===newCorporate)assert.equal(data.currentCorporateProfileSHA256,observed.originalBodySHA256)
}
function held(result,reads){
 assert.equal(result.jobs,undefined);assert(result.error);assert.equal(result.calls.length,reads,JSON.stringify(result.calls));assert.deepEqual(result.unexpected,[]);assert.equal(result.error.inventoryEvidence.reportedTotal,null);assert.equal(result.error.inventoryEvidence.indiaFacetCount,null);assert.equal(result.error.inventoryEvidence.listingComplete,false)
}
test('spelling fixture is the whole actual corporate original with exactly three authored marketing substitutions',()=>{
 assert.equal(sha(newCorporate.body),observed.originalBodySHA256);assert.equal(sha(oldCorporate.body),'b5e298f26c40fd87d0f547278b3731ab57e522e00bdd87f71860a96fe629d6f3');assert.equal(Buffer.byteLength(newCorporate.body),139573);assert.equal(oldCorporate.body.split(oldURL).length-1,3);assert.equal(newCorporate.body.split(newURL).length-1,3);assert.equal(oldCorporate.body.replaceAll(oldURL,newURL),newCorporate.body)
})
test('prior exact corporate profile still preserves original14 DATA records and all qualification holds',async t=>{t.mock.method(console,'warn',()=>{});qualifiedData(await exercise({opening:'prior'}),oldCorporate)})
test('actual signal-only registered default accepts exact current corporate spelling and retains all14 original records',async t=>{t.mock.method(console,'warn',()=>{});qualifiedData(await exercise({signalOnly:true}),newCorporate)})
for(const [opening,closing] of [['prior','current'],['current','prior']])test('mixed corporate profiles hold '+opening+' opening and '+closing+' closing after8reads',async t=>{
 t.mock.method(console,'warn',()=>{});const r=await exercise({opening,closing});held(r,8);assert.equal(r.error.nativeEvidence.nativeInventoryCount,14);assert.equal(r.error.nativeEvidence.nativeDataClosingReconciled,false);assert.deepEqual(r.error.nativeEvidence.rawOpeningFeed,oldFeed)
})
const changes=[
 ['one-of-three reverted marketing anchors',body=>body.replace(newURL,oldURL)],
 ['fourth marketing anchor',body=>body.replace('</body>','<a href="'+newURL+'">Other marketing anchor</a></body>')],
 ['native role identity',body=>body.replace('bed846f2-3702-4117-b35d-c77c3177897e','bed846f2-3702-4117-b35d-c77c3177897f')],
 ['company identity',body=>body.replace('<title>','<title>Other publisher ')],
 ['inline programme',body=>body.replace('function filter() {','function filter() { throw Error("unreviewed");')],
 ['inline CSS',body=>body.replace('<style>','<style>.unreviewed{display:none}')],
]
for(const [name,change] of changes)test('unknown '+name+' is rejected after the first corporate response',async t=>{
 t.mock.method(console,'warn',()=>{});const r=await exercise({mutate:(packet,ordinal)=>{if(ordinal===1){const changed=change(packet.body);assert.notEqual(changed,packet.body);packet.body=changed}return packet}});held(r,1)
})
test('full changed closing native mandatory criteria cannot use the current corporate profile as bypass',async t=>{
 t.mock.method(console,'warn',()=>{});const r=await exercise({mutate:(packet,ordinal)=>{if(ordinal===14){const feed=JSON.parse(packet.body);feed.jobAdDetails[0].description+='<p>Mandatory additional clearance.</p>';packet.body=JSON.stringify(feed)}return packet}});held(r,14);assert.equal(r.error.nativeEvidence.nativeInventoryCount,14);assert.equal(r.error.nativeEvidence.nativeDataClosingReconciled,false);assert.deepEqual(r.error.nativeEvidence.rawOpeningFeed,oldFeed)
})
test('a caller cannot admit an unknown corporate body through optional profile settings',async t=>{
 t.mock.method(console,'warn',()=>{});const body=newCorporate.body+'\n';const r=await exercise({mutate:(packet,ordinal)=>ordinal===1?{...packet,body}:packet,options:{additionalCorporateProfiles:[{...newCorporate,bodySHA256:sha(body)}],reviewedData:{requests:[{...newCorporate,bodySHA256:sha(body)}]}}});held(r,1)
})
test('current spelling cannot evade the fourteen-observation page budget',async t=>{t.mock.method(console,'warn',()=>{});const r=await exercise({options:{maxPages:13}});held(r,1);assert.match(r.error.message,/fourteen observations/i)})
for(const [name,reason] of [['null',null],['frozen',Object.freeze({caller:'snow-spelling'})],['Error',Error('snow spelling caller')]])test('current spelling preserves preaborted '+name+' caller identity without reads',async t=>{
 t.mock.method(console,'warn',()=>{});const control=new AbortController();control.abort(reason);const r=await exercise({signal:control.signal});assert.strictEqual(r.error,reason);assert.equal(r.calls.length,0);assert.equal(r.jobs,undefined)
})
