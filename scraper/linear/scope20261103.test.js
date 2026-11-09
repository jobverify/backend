import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import test from 'node:test'
import {createLinearScraper,CAREERS_PAGE_URL,NATIVE_API_URL} from './native.js'
import {readInventoryEvidence,isFreshCompleteInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {resolveZeroJobOutcome} from '../../scraper-support/runner.js'
const manifest=JSON.parse(fs.readFileSync(new URL('./test-data/manifest.json',import.meta.url)))
const entries=Object.fromEntries(Object.entries(manifest.captures).map(([name,r])=>[name,{...r,body:gunzipSync(fs.readFileSync(new URL('./test-data/'+r.file,import.meta.url)))}]))
const native=()=>JSON.parse(entries['native-api'].body)
async function exercise({change=()=>{},closingChange=()=>{},historical=false}={}){
 const payload=native();change(payload);const calls=[],counts=new Map(),clock=new Date().toISOString()
 const result=await createLinearScraper().collect({transport:async url=>{
  calls.push(url);const visit=(counts.get(url)||0)+1;counts.set(url,visit)
  const packet=Object.values(entries).find(r=>r.url===url);assert.ok(packet,'Unexpected Linear source URL '+url)
  const body=url===NATIVE_API_URL?structuredClone(payload):null;if(body&&visit===2)closingChange(body)
  return{url,status:200,headers:{'content-type':packet.contentType},body:body?Buffer.from(JSON.stringify(body)):packet.body,bodyComplete:true,requestedAt:historical?packet.requestedAt:clock,completedAt:historical?packet.completedAt:clock}
 }})
 return{result,calls,payload}
}
test('Linear qualifies the reconciled configured31-role board while broader company totals and cleanup remain unknown',async()=>{
 const {result:r,payload,calls}=await exercise(),e=readInventoryEvidence(r.jobs)
 assert.equal(r.configuredBoardComplete,true);assert.equal(r.sourceScopeComplete,false);assert.equal(r.sourceCompanyWideScopeComplete,false);assert.equal(r.lifecycleCleanupAllowed,false);assert.equal(r.companyGlobalTotal,null);assert.equal(r.companyIndiaTotal,null)
 assert.equal(e.status,'complete-inventory');assert.equal(e.listingComplete,true);assert.equal(e.reportedTotal,31);assert.equal(e.indiaFacetCount,0);assert.equal(r.jobs.length,0)
 assert.equal(isFreshCompleteInventoryEvidence(e),true);assert.equal(resolveZeroJobOutcome({provider:{}},r.jobs,[]),'fetched-zero')
 assert.deepEqual(r.nativeRoles,payload.jobs);assert.ok(r.nativeRoles.every(row=>row.descriptionHtml&&row.publishedAt&&row.isListed===true));assert.equal(calls.filter(u=>u===NATIVE_API_URL).length,2);assert.equal(calls.at(-1),NATIVE_API_URL)
})
test('Linear retains historical receipt clocks and cannot relabel an old replay as fresh authoritative zero',async()=>{
 const {result:r}=await exercise({historical:true}),e=readInventoryEvidence(r.jobs)
 assert.equal(r.configuredBoardComplete,true);assert.equal(e.verifiedAt,'2026-10-31T22:39:41.377Z');assert.equal(isFreshCompleteInventoryEvidence(e,{now:new Date('2026-11-03T12:00:00Z')}),false)
})
test('real unknown, remote, conflicting or newly published native geography keeps configured country inventory incomplete',async()=>{
 for(const change of[
  row=>{row.location='Bengaluru';row.address={};row.secondaryLocations=[]},
  row=>{row.location='Worldwide'},
  row=>{row.location='Bengaluru, India';row.address={postalAddress:{addressCountry:'US'}}},
  row=>{row.country='India'},
  row=>{row.address={postalAddress:{addressCountry:'US',countryCode:'IN'}}},
  row=>{row.location='A different published worksite';row.address={postalAddress:{addressCountry:'US'}}},
 ]){const{result:r}=await exercise({change:p=>change(p.jobs[0])});assert.equal(r.configuredBoardComplete,false);assert.equal(r.inventoryEvidence.listingComplete,false);assert.equal(r.inventoryEvidence.reportedTotal,null);assert.equal(r.inventoryEvidence.indiaFacetCount,null);assert.equal(r.nativeRoles.length,31)}
})
test('missing public criteria, malformed original dates and unreviewed public fields cannot qualify configured completion',async()=>{
 for(const change of[
  row=>{row.descriptionHtml=''},row=>{row.publishedAt='unknown'},row=>{row.requiredProfessionalLicense={required:true}},
 ]){const{result:r}=await exercise({change:p=>change(p.jobs[0])});assert.equal(r.configuredBoardComplete,false);assert.equal(r.inventoryEvidence.listingComplete,false);assert.equal(r.inventoryEvidence.indiaFacetCount,null);assert.equal(r.nativeRoles.length,31);assert.ok(r.failures.some(f=>f.stage==='native-row'))}
})
test('native unlisted status cannot replace a current role still advertised by the corporate renderer',async()=>{
 await assert.rejects(exercise({change:p=>{p.jobs[0].isListed=false}}),/role identities.*reconcile/)
})
test('closing native description changes retain original observations and prevent authoritative configured zero',async()=>{
 const{result:r}=await exercise({closingChange:p=>{p.jobs[0].descriptionHtml+='<p>New public mandatory criterion.</p>'}})
 assert.equal(r.configuredBoardComplete,false);assert.equal(r.closingInventoryStable,false);assert.equal(r.inventoryEvidence.reportedTotal,null);assert.equal(r.nativeRoles.length,31);assert.ok(r.failures.some(f=>f.stage==='closing-inventory'))
})
test('Linear caller cancellation bounds an injected transport that ignores the signal',async()=>{
 const c=new AbortController(),reason={stop:'Linear source reader'},timer=setTimeout(()=>c.abort(reason),10)
 try{await assert.rejects(createLinearScraper().collect({signal:c.signal,transport:()=>new Promise(()=>{})}),e=>e===reason)}finally{clearTimeout(timer)}
})
test('fresh original current31-role native and corporate response bytes retain the complete configured board proof',async()=>{
 const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/configured-board-20261103.json.gz',import.meta.url)))),counts=new Map()
 for(const row of fixture.responses)assert.equal(createHash('sha256').update(row.body).digest('hex'),row.sha256)
 const r=await createLinearScraper().collect({transport:async url=>{const n=counts.get(url)||0;counts.set(url,n+1);const row=fixture.responses.filter(r=>r.url===url)[n];assert.ok(row,'Uncaptured current Linear read '+url);return{url:row.finalUrl,status:row.status,headers:{'content-type':row.contentType},body:Buffer.from(row.body),bodyComplete:true,requestedAt:row.requestedAt,completedAt:row.completedAt}}})
 assert.equal(r.configuredBoardComplete,true);assert.equal(r.nativeRoles.length,31);assert.equal(r.jobs.length,0);assert.equal(r.inventoryEvidence.reportedTotal,31);assert.equal(r.inventoryEvidence.indiaFacetCount,0);assert.equal(r.corporateNativeLocationMismatches.length,0);assert.equal(r.failures.length,0)
 assert.deepEqual(r.originalNativePayload,JSON.parse(fixture.responses.find(row=>row.url===NATIVE_API_URL).body));assert.equal(r.companyGlobalTotal,null);assert.equal(r.companyIndiaTotal,null);assert.equal(r.lifecycleCleanupAllowed,false)
})
