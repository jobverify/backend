import fs from'node:fs'
import{gunzipSync}from'node:zlib'
import assert from'node:assert/strict'
import test from'node:test'
import{createCatalogScraper,getScraperCatalog}from'../scraper-support/providers/index.js'
import{projectNativeWorkdayClocks}from'./helpers/nativeWorkdayClockProjection.js'
import{readInventoryEvidence}from'../scraper-support/utils/inventoryEvidence.js'
const frozen=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/capitalOne/source-native-005.json.gz',import.meta.url))))
const stable=value=>{const j=structuredClone(value);delete j.scrapedAt;delete j.sourceOfficialBinding.verifiedAt;return j}
// Current safety metadata is additive; the original12 native records stay exact.
// Country reconciliation covers this captured board subset, not whole-company scope.
const expectedPartialContract=value=>({...stable(value),sourceScopeComplete:false,lifecycleCleanupAllowed:false,
  sourceBoardInventories:value.sourceBoardInventories.map(board=>({...board,countryScopeComplete:true,unresolvedCountryRoles:[],reconciliation:null}))})
async function replay(t,change=()=>{}){
  const packets=structuredClone(frozen.packets);change(packets);let used=0
  t.mock.method(globalThis,'fetch',async(url,init={})=>{
    const p=packets.find(p=>!p.used&&p.url===String(url)&&p.method===(init.method||'GET')&&p.requestBody===(init.body??null))
    assert.ok(p,'No external or repeated request is permitted: '+url);p.used=true;used++
    const response=new Response(p.body,{status:p.status,headers:{'content-type':p.url.includes('/wday/cxs/')?'application/json':'text/html'}})
    Object.defineProperty(response,'url',{value:p.finalURL});return response
  })
  const provider=getScraperCatalog().find(p=>p.source==='capitalone')
  const jobs=await createCatalogScraper(provider).run({now:frozen.trial.jobs[0].scrapedAt,
    requestScheduler:{acquire:async()=>()=>{},recordRateLimit:()=>{},minIntervalMs:0},retryBaseDelayMs:0})
  return{jobs,used}
}
test('all31 captured responses retain12 native jobs, original dates and unknown legal employers under partial coverage',async t=>{
  const{jobs,used}=await replay(t);assert.equal(used,31);assert.deepEqual(projectNativeWorkdayClocks(jobs,frozen.trial.jobs,frozen.packets,stable,{listingLabel:true}),frozen.trial.jobs.map(expectedPartialContract))
  assert.ok(jobs.every(j=>j.nativeEmployer===null&&j.sourceDetailComplete&&j.sourceListingComplete===false))
  const inventory=readInventoryEvidence(jobs);assert.equal(inventory.status,'coverage-gap');assert.equal(inventory.listingComplete,false)
  assert.equal(inventory.reportedTotal,null);assert.equal(inventory.indiaFacetCount,null)
})
const lastDetail=(packets,change)=>{const p=packets.at(-1),body=JSON.parse(p.body);change(body);p.body=JSON.stringify(body)}
for(const[name,change]of[
  ['uppercase detail ERROR',p=>lastDetail(p,d=>{d.ERROR='failure'})],
  ['detail Status500',p=>lastDetail(p,d=>{d.Status=500})],
  ['nested metadata error',p=>lastDetail(p,d=>{d.meta={ERROR:'failure'}})],
  ['final listing uppercase error',p=>{const q=p.filter(x=>x.method==='POST').at(-1),d=JSON.parse(q.body);d.ERROR='failure';q.body=JSON.stringify(d)}],
  ['final listing requisition identity drift',p=>{const q=p.filter(x=>x.method==='POST').at(-1),d=JSON.parse(q.body);d.jobPostings[0].bulletFields=['R9999999'];q.body=JSON.stringify(d)}],
  ['foreign secondary location added after extraction',p=>lastDetail(p,d=>{d.jobPostingInfo.additionalLocations=['New York, United States']})],
  ['changed India secondary location missing from the mapped job',p=>lastDetail(p,d=>{d.jobPostingInfo.additionalLocations=['Delhi, India']})],
  ['hidden-only description in both native detail responses',p=>{for(const q of p.filter(x=>x.method==='GET'&&x.url.includes('/wday/cxs/'))){const d=JSON.parse(q.body);d.jobPostingInfo.jobDescription='<div hidden>'+d.jobPostingInfo.jobDescription+'</div>';q.body=JSON.stringify(d)}}],
  ['Apply now placeholder in both native detail responses',p=>{for(const q of p.filter(x=>x.method==='GET'&&x.url.includes('/wday/cxs/'))){const d=JSON.parse(q.body);d.jobPostingInfo.jobDescription='<p>Apply now</p>';q.body=JSON.stringify(d)}}],
])test(name+' cannot certify complete native content or geography',async t=>{await assert.rejects(replay(t,change))})
