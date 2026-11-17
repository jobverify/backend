import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {sourceLifecycleCleanupForbidden,readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-native-20261117.json.gz',import.meta.url))))
const replay=(edit=(p,s)=>s)=>{
 const counts=new Map(),reads=[]
 return {reads,options:{now:()=>fixture.now,requestIntervalMs:0,
  // Historical decoded-text injection reproduces the old current-page failure;
  // the new native route must use only fetchImpl and original HTTP metadata.
  fetchText:async()=>Buffer.from(fixture.responses.find(p=>p.requestedURL==='https://www.quadeye.com/jobs').bodyBase64,'base64').toString(),
  fetchImpl:async(input,init)=>{
   const url=String(input),p=fixture.responses.find(p=>p.requestedURL===url)
   assert.ok(p,'Only original currently declared reads '+url);assert.equal(init.method,'GET');assert.equal(init.redirect,'manual')
   const count=(counts.get(url)||0)+1;counts.set(url,count);reads.push(url)
   const body=edit(p,Buffer.from(p.bodyBase64,'base64').toString(),count)
   return Object.defineProperty(new Response(body,{status:p.status,headers:p.headers}),'url',{value:p.url})
  }}}
}
test('Quadeye current first-party proxy retains25 typed records and full native schema/application while holding dates/geography',async()=>{
 const {options}=replay(),jobs=await run(options)
 assert.equal(jobs.length,1);assert.equal(jobs[0].jobId,'199893000000864279');assert.equal(jobs[0].country,'India')
 assert.match(jobs[0].nativeRawTitle,/Cypto/);assert.match(jobs[0].title,/Crypto/)
 assert.equal(jobs[0].nativeDisplayTitleModel.input,jobs[0].nativeRawTitle)
 assert.equal(jobs[0].nativeDisplayTitleModel.output,jobs[0].title)
 assert.equal(jobs[0].nativeDisplayTitleModel.programSHA256,'7fad4975e62431e6ff473ae4474b2f768b8115c8a782b8e485d345e8b7c1799e')
 assert.match(jobs[0].jobDescription,/Requirements|Qualifications/i);assert.ok(jobs[0].nativeFacts.nativeJobPosting.description)
 assert.equal(jobs[0].nativeApplicationModel.fields.length,10);assert.equal(jobs[0].nativeApplicationModel.submissionPerformed,false)
 assert.equal(jobs[0].nativeRoleClosingReconciled,true)
 assert.equal(readSourceObservationEvidence(jobs,'quadeye').observedRecordCount,25)
 assert.equal(jobs.nativeCollectionEvidence.exclusions.filter(r=>r.reason==='native-expired').length,1)
 assert.equal(jobs.nativeCollectionEvidence.exclusions.length,1)
 assert.equal(jobs.nativeCollectionEvidence.failures.filter(r=>/criteria mismatch/.test(r.reason)).length,3)
 assert.equal(jobs.nativeCollectionEvidence.nativeListingDispositions.length,17)
 assert.equal(jobs.nativeCollectionEvidence.failures.filter(r=>r.reason==='native-expiry-precedes-posting').length,3)
 assert.equal(jobs.nativeCollectionEvidence.nativeCountryDispositions.unknownOrMixed,12)
 assert.equal(jobs.nativeCollectionEvidence.closingFullNativeInventoryMatch,true)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('Quadeye rejects unreviewed programs, injected inline executable, and current-profile mixing',async()=>{
 for(const mode of ['program','inline','mixed-import']){
  const {options}=replay((p,s)=>{
   if(mode==='program'&&p.requestedURL.includes('/3obtsu'))return s+';window.changed=true'
   if(mode==='inline'&&p.requestedURL==='https://www.quadeye.com/jobs')return s.replace('</body>','<script>window.override=true</script></body>')
   if(mode==='mixed-import'&&p.requestedURL==='https://www.quadeye.com/jobs')return s.replaceAll('0xu7x-kwcf_ve.js','40vnpj-77_vg-.js')
   return s
  })
  await assert.rejects(run(options),/current|profile|program|declaration|Flight/i,mode)
 }
})
test('Quadeye full unselected inventory drift and lost public native schema criteria never certify closing',async()=>{
 for(const mode of ['unselected-closing','schema-country','schema-criteria','schema-word-boundary']){
  const {options}=replay((p,s,count)=>{
   if(mode==='unselected-closing'&&p.requestedURL.endsWith('/job-openings')&&count===2){let v=JSON.parse(s);v.data.at(-1).UnknownAuthoredRequirement='changed';return JSON.stringify(v)}
   if(p.requestedURL.includes('/jobs/199893000000864279/')){
    if(mode==='schema-country')return s.replaceAll('"addressCountry":"IN"','"addressCountry":"US"')
    if(mode==='schema-criteria')return s.replace('Requirements','Unreviewed changed requirements')
    if(mode==='schema-word-boundary')return s.replace('Requirements','Require ments')
   }return s
  })
  if(mode==='unselected-closing')await assert.rejects(run(options),/closing.*model/i)
  else {const jobs=await run(options);assert.equal(jobs.length,0);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)}
 }
})
test('Quadeye nullable internal user expansion cannot hide detail criteria, unknown DTO fields, or closing changes',async()=>{
 for(const mode of ['user-shape','detail-criteria','closing-detail']){
  const {options}=replay((p,s,count)=>{
   if(p.requestedURL.endsWith('/job-openings/199893000000864279')){
    const value=JSON.parse(s)
    if(mode==='user-shape')value.data.Sub_Users[0].Required_Skills='injected'
    if(mode==='detail-criteria')value.data.Required_Skills+=';extra authored requirement'
    if(mode==='closing-detail'&&count===2)value.data.Sub_Users[0].name+='changed'
    return JSON.stringify(value)
   }return s
  })
  await assert.rejects(run(options),/native.*model|closing/i,mode)
 }
})
test('Quadeye current acquisition preserves opaque caller abort and stops on observed challenge',async()=>{
 const caller=new AbortController();caller.abort(null);let reads=0
 await assert.rejects(run({signal:caller.signal,fetchImpl:async()=>{reads++}}),error=>error===null)
 assert.equal(reads,0)
 const challenge=Object.defineProperty(new Response(null,{status:202,headers:{'x-amzn-waf-action':'challenge'}}),'url',{value:'https://www.quadeye.com/jobs'})
 await assert.rejects(run({requestIntervalMs:0,fetchImpl:async()=>{reads++;return challenge}}),error=>error.httpStatus===202&&error.abortRetries===true)
 assert.equal(reads,1)
 const opaque=Object.freeze({owner:'quadeye-caller'}),inflight=new AbortController();let canceled=0
 const hanging=Object.defineProperty(new Response(new ReadableStream({start(){setTimeout(()=>inflight.abort(opaque),5)},cancel(){canceled++;return new Promise(()=>{})}}),{headers:{'content-type':'text/html'}}),'url',{value:'https://www.quadeye.com/jobs'})
 const start=Date.now()
 await assert.rejects(run({signal:inflight.signal,requestIntervalMs:0,fetchImpl:async()=>hanging}),error=>error===opaque)
 assert.ok(Date.now()-start<500,'Frozen caller reason wins over a hanging body cancellation')
 await new Promise(resolve=>setTimeout(resolve,20))
 assert.equal(canceled,1)
})
