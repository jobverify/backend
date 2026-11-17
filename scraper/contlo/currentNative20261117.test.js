import assert from'node:assert/strict'
import test from'node:test'
import{readFileSync}from'node:fs'
import{gunzipSync}from'node:zlib'
import{run}from'./script.js'
import{readInventoryEvidence,sourceLifecycleCleanupForbidden}from'../../scraper-support/utils/inventoryEvidence.js'
import{readSourceObservationEvidence}from'../../scraper-support/utils/sourceObservationEvidence.js'
import{clientScriptDeclarations}from'../../scraper-support/utils/reviewedClientProgram.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-native-20261117.json.gz',import.meta.url))))
const oldToken='10bfc88c061c2a93c7ea9098',newToken='10bfc88c061c2a93c7ea9099'
function replay(edit=(p,s)=>s,{syntheticAdditionalRole=false}={}){const reads=[],counts=new Map(),body=p=>Buffer.from(p.bodyBase64,'base64').toString();return{reads,options:{requestIntervalMs:0,fetchText:async()=>body(fixture.responses[0]),fetchImpl:async(url,init)=>{const requested=String(url),lookup=syntheticAdditionalRole?requested.replace(newToken,oldToken):requested,p=fixture.responses.find(p=>p.url===lookup);assert.ok(p,'Only actual published URL or explicitly synthetic typed-role fixture '+url);assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');reads.push(requested);const count=(counts.get(url)??0)+1;counts.set(url,count);let s=edit(p,body(p),count);if(syntheticAdditionalRole&&requested!==lookup)s=s.replaceAll(oldToken,newToken);return Object.defineProperty(new Response(s,{status:p.status,headers:p.headers}),'url',{value:requested})}}}}
test('Contlo current own Outrely inventory returns full explicit India role and entire opening/closing models with scope holds',async()=>{
 const{reads,options}=replay(),jobs=await run(options);assert.equal(jobs.length,1);assert.equal(jobs[0].country,'India');assert.equal(jobs[0].jobId,'10bfc88c061c2a93c7ea9098');assert.match(jobs[0].jobDescription,/1 to 3 years/)
 assert.equal(readSourceObservationEvidence(jobs,'contlo').observedRecordCount,1);assert.equal(jobs.nativeCollectionEvidence.closingFullNativeModelsMatch,true);assert.equal(jobs[0].nativeApplicationModel.tag,'form');assert.equal(jobs[0].applicationVisited,false);assert.equal(sourceLifecycleCleanupForbidden(jobs),true);assert.equal(readInventoryEvidence(jobs).pagesFetched,reads.length)
})
test('Contlo native rows/counts are typed data while unproven country and zero qualified output keep original observations/cleanup holds',async()=>{
 const{options}=replay((p,s)=>p.url==='https://outrely.com/api/embed/contlo'?s.replace('Pune, Maharashtra, India','Pune, Maharashtra'):s),jobs=await run(options);assert.equal(jobs.length,0);assert.equal(readSourceObservationEvidence(jobs,'contlo').observedRecordCount,1);assert.equal(sourceLifecycleCleanupForbidden(jobs),true);assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal,null)
 const two=replay((p,s)=>{if(p.url!=='https://outrely.com/api/embed/contlo')return s;const v=JSON.parse(s);v.jobs.push({...v.jobs[0],url:v.jobs[0].url.replace(oldToken,newToken)});return JSON.stringify(v)},{syntheticAdditionalRole:true}),dynamic=await run(two.options)
 assert.equal(dynamic.length,2);assert.equal(readSourceObservationEvidence(dynamic,'contlo').observedRecordCount,2);assert.deepEqual(dynamic.map(j=>j.jobId),[oldToken,newToken])
})
test('Contlo source binding, whole closing payload and native side-panel context reject material changes',async()=>{
 for(const mode of['workspace','closing-passive','side-panel','boundary']){const{options}=replay((p,s,count)=>{
  if(p.url==='https://outrely.com/api/embed/contlo'){if(mode==='workspace')return s.replace('"organization":"Contlo"','"organization":"Unrelated employer"');if(mode==='closing-passive'){const v=JSON.parse(s);v.unknownPassiveContext=count;return JSON.stringify(v)}}
  if(p.url.includes('/apply/'+oldToken)){if(mode==='side-panel')return s.replace('<main ','<main ').replace('<h1 ','<p>Additional mandatory restriction outside the original criteria.</p><h1 ');if(mode==='boundary')return s.replace('1 to 3 years','1to 3 years')}return s
 });await assert.rejects(run(options),e=>e.failureKind==='parser_or_contract_error',mode)}
})
test('Contlo added nontext or hidden criteria remain held even when plain visible/schema text is unchanged',async()=>{
 for(const content of['<img src="requirements.png" alt="Extra mandatory requirement">','<iframe src="https://contlo.com/conditions"></iframe>','<span hidden>Hidden extra eligibility restriction</span>']){const{options}=replay((p,s)=>p.url.includes('/apply/'+oldToken)?s.replace('<div class="rich-text text-sm leading-relaxed text-sw-ink-2">','<div class="rich-text text-sm leading-relaxed text-sw-ink-2">'+content):s),jobs=await run(options)
  assert.equal(jobs.length,0);assert.equal(readSourceObservationEvidence(jobs,'contlo').observedRecordCount,1);assert.equal(jobs.nativeCollectionEvidence.failures.length,1);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 }
})
function changeFlight(html,transform){let result=html;for(const node of clientScriptDeclarations(html)){const raw=node.raw??'',prefix='self.__next_f.push(';if(!raw.startsWith(prefix))continue;const value=JSON.parse(raw.slice(prefix.length).replace(/\);?$/,''));if(value[0]===1&&typeof value[1]==='string'){const changed=transform(value[1]);result=result.replace(raw,'self.__next_f.push('+JSON.stringify([1,changed])+')')}}return result}
test('Contlo full active hydration binds role token/employer/criteria/form and retains import/resource/passive schema context',async()=>{
 for(const mode of['token','employer','criteria','question','resource','import']){let mutations=0;const{options}=replay((p,s)=>p.url.includes('/apply/'+oldToken)?changeFlight(s,frame=>{const changed=mode==='token'?frame.replace('"token":"'+oldToken+'"','"token":"'+newToken+'"'):mode==='employer'?frame.replace('"organization":"Contlo"','"organization":"Unrelated employer"'):mode==='criteria'?frame.replaceAll('1 to 3 years','7 to 8 years'):mode==='question'?frame.replace('"organization":"Contlo"','"organization":"Contlo","unreviewedMandatoryQuestion":"Extra requirement"'):mode==='resource'?frame.replace(':HL[',':HL["https://foreign.invalid/loader.js",'):frame.replace('I[1519,','I[1520,');if(changed!==frame)mutations++;return changed}):s)
  await assert.rejects(run(options),e=>e.failureKind==='parser_or_contract_error',mode);assert.ok(mutations>0,'Actual current literal carrier mutated: '+mode)
 }
})
test('Contlo additional structured native eligibility fields cannot be lost while visible old criteria remains unchanged',async()=>{
 const{options}=replay((p,s)=>{if(!p.url.includes('/apply/'+oldToken))return s;return s.replace('"directApply":true','"directApply":true,"qualifications":"Extra mandatory restriction outside old description"')});await assert.rejects(run(options),e=>e.failureKind==='parser_or_contract_error')
 const listing=replay((p,s)=>{if(p.url!=='https://outrely.com/api/embed/contlo')return s;const v=JSON.parse(s);v.jobs[0].qualifications='Extra mandatory native condition';return JSON.stringify(v)}),jobs=await run(listing.options);assert.equal(jobs.length,0);assert.equal(readSourceObservationEvidence(jobs,'contlo').observedRecordCount,1);assert.equal(jobs.nativeCollectionEvidence.failures[0].reason,'whole-native-row-has-unreviewed-field-context');assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})
