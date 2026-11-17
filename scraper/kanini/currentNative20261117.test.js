import assert from'node:assert/strict'
import test from'node:test'
import{readFileSync}from'node:fs'
import{gunzipSync}from'node:zlib'
import{run}from'./script.js'
import{readInventoryEvidence,sourceLifecycleCleanupForbidden}from'../../scraper-support/utils/inventoryEvidence.js'
import{readSourceObservationEvidence}from'../../scraper-support/utils/sourceObservationEvidence.js'
import{currentKaniniTransport}from'./currentTransport20261117.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-native-20261117.json.gz',import.meta.url))))
const body=p=>Buffer.from(p.bodyBase64,'base64').toString(),listing='https://kanini.com/careers/open-positions/',ajax='https://kanini.com/wp-admin/admin-ajax.php'
function replay(edit=(p,s)=>s){const reads=[],counts=new Map();return{reads,options:{requestIntervalMs:0,fetchText:async()=>body(fixture.responses.find(p=>p.url==='https://kanini.com/')),fetchImpl:async(url,init)=>{
 const p=fixture.responses.find(p=>p.url===String(url)&&(p.method??'GET')===init.method&&(p.requestBody??'')===(init.body??''));assert.ok(p,'Only actual current declared source and native search body '+url+' '+init.body)
 const key=String(url)+' '+(init.body??''),count=(counts.get(key)??0)+1;counts.set(key,count);reads.push({url:String(url),body:init.body??null});assert.equal(init.redirect,'manual');if(String(url)===ajax){assert.equal(init.method,'POST');assert.match(init.headers['Content-Type'],/application\/x-www-form-urlencoded/);assert.match(init.body,/^search=&location=&action=get_all_jobs&page=[1-3]&limit=12$/)}
 return Object.defineProperty(new Response(edit(p,body(p),count),{status:p.status,headers:p.headers}),'url',{value:p.url})
}}}}
test('KANINI current native search enumerates24 real observations and full11 India JDs rather than certifying the initial no-match template',async()=>{
 const{reads,options}=replay(),jobs=await run(options)
 assert.equal(reads.length,40);assert.equal(readInventoryEvidence(jobs).pagesFetched,40)
 assert.equal(readSourceObservationEvidence(jobs,'kanini').observedRecordCount,24);assert.equal(jobs.length,11)
 assert.ok(jobs.every(j=>j.country==='India'&&j.sourceScopeComplete===false&&j.lifecycleCleanupAllowed===false))
 assert.equal(jobs.nativeCollectionEvidence.nativeCountryUnknownRows,8);assert.equal(jobs.nativeCollectionEvidence.nativeExplicitForeignRows,5)
 assert.equal(jobs.nativeCollectionEvidence.nativeOpeningInventory.details.length,11);assert.equal(jobs.nativeCollectionEvidence.closingFullNativeInventoryMatch,true)
 assert.equal(jobs[0].nativeApplicationModel.info.company,'KANINI Software Solutions');assert.ok(jobs[0].nativeApplicationModel.webforms[0].sections.some(s=>s.fields?.some(f=>f.api_name==='Applied_Job_ID'&&f.required)))
 assert.match(jobs[0].jobDescription,/Required Skills & Experience/);assert.equal(jobs[0].applicationVisited,false);assert.equal(jobs[0].postingDate,null)
 assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal,null);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})
test('KANINI whole client authority and closing native HTML/application models reject material drift including held records',async()=>{
 for(const mode of['client','override','foreign','closing-passive','closing-questions','foreign-form-employer']){const{options}=replay((p,s,count)=>{
  if(p.url===listing&&mode==='client')return s.replace('&action=get_all_jobs&page=','&action=unreviewed_jobs&page=')
  if(p.url===listing&&mode==='override')return s.replace('</body>','<script>load_ajax_post=function(){return []}</script></body>')
  if(p.url===listing&&mode==='foreign')return s.replaceAll('https://kanini.com/wp-admin/admin-ajax.php','https://foreign.invalid/query')
  if(mode==='closing-passive'&&p.url===ajax&&p.requestBody.includes('page=1&')&&count===2)return s.replace('title="1.High"','title="unreviewed native priority"')
  if(mode==='closing-questions'&&p.url.includes('/recruit/v2/public/forms/')&&count===2){const v=JSON.parse(s);v.webforms[0].sections[0].fields[0].required=false;return JSON.stringify(v)}
  if(mode==='foreign-form-employer'&&p.url.includes('/recruit/v2/public/forms/')){const v=JSON.parse(s);v.info.company='Unrelated company';return JSON.stringify(v)}return s
 });await assert.rejects(run(options),error=>error.failureKind==='parser_or_contract_error',mode)}
})
test('KANINI a short nonempty native page still continues until the actual empty terminator and native counts remain data',async()=>{
 const marker='<div class="col-lg-3 col-md-6 padd-resp">',{reads,options}=replay((p,s)=>p.url===ajax&&p.requestBody.includes('page=1&')?s.slice(s.indexOf(marker,s.indexOf(marker)+marker.length)):s)
 const jobs=await run(options);assert.equal(jobs.length,11);assert.equal(readSourceObservationEvidence(jobs,'kanini').observedRecordCount,23)
 assert.equal(reads.filter(r=>r.body?.includes('page=3&')).length,2);assert.equal(jobs.nativeCollectionEvidence.nativeExplicitForeignRows,4)
})
test('KANINI missing native country remains unknown despite an Indian city list',async()=>{
 const{options}=replay((p,s)=>p.url===ajax&&p.requestBody.includes('page=1&')?s.replace('Bangalore, Chennai, Pune, Coimbatore | India','Bangalore, Chennai, Pune, Coimbatore | '):s)
 const jobs=await run(options);assert.equal(jobs.length,10);assert.equal(readSourceObservationEvidence(jobs,'kanini').observedRecordCount,24)
 assert.equal(jobs.nativeCollectionEvidence.nativeCountryUnknownRows,9);assert.ok(!jobs.some(j=>j.jobId==='2887000031418008'));assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})
test('KANINI nontext or hidden native requirements cannot disappear into an apparently complete text JD',async()=>{
 for(const content of['<img src="required-criteria.png" alt="Additional mandatory requirements">','<iframe src="https://kanini.com/requirements"></iframe>','<span hidden>Extra mandatory restriction</span>','<div style="height:0;overflow:hidden">Extra mandatory restriction</div>']){
  const{options}=replay((p,s)=>p.url==='https://kanini.com/jobs?job_id=2887000031418008'?s.replace('<span id="spandesc">','<span id="spandesc">'+content):s)
  const jobs=await run(options);assert.equal(jobs.length,10);assert.equal(readSourceObservationEvidence(jobs,'kanini').observedRecordCount,24)
  assert.ok(jobs.nativeCollectionEvidence.failures.some(f=>f.id==='2887000031418008'&&f.reason==='native-criteria-format-unqualified'));assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 }
})
test('KANINI added native side-panel requirements cannot be silently omitted from a qualified job',async()=>{
 const{options}=replay((p,s)=>p.url==='https://kanini.com/jobs?job_id=2887000031418008'?s.replace('<div class="jd-para">','<div class="jd-para"><p>Additional mandatory eligibility restriction outside the old criteria container.</p>'):s)
 await assert.rejects(run(options),error=>error.failureKind==='parser_or_contract_error')
})
test('KANINI retains opaque caller ownership through pacing and cleanup, and never retries a native access challenge',async()=>{
 const pre=new AbortController();pre.abort(null);let reads=0;await assert.rejects(run({signal:pre.signal,fetchImpl:async()=>{reads++}}),reason=>reason===null);assert.equal(reads,0)
 for(const mode of['pace','cleanup']){const caller=new AbortController(),reason=Object.freeze({owner:'kanini-'+mode}),url='https://kanini.com/'
  const io=currentKaniniTransport({signal:caller.signal,requestIntervalMs:mode==='pace'?1000:0,timeoutMs:mode==='cleanup'?10:180000,allowedRequest:(u,m)=>u===url&&m==='GET',fetchImpl:async()=>{reads++;return Object.defineProperty(new Response(mode==='pace'?'native':new ReadableStream({pull:()=>new Promise(()=>{}),cancel:()=>new Promise(()=>{})}),{headers:{'content-type':'text/html'}}),'url',{value:url})}})
  let timer;try{if(mode==='pace')await io.read(url);timer=setTimeout(()=>caller.abort(reason),40);await assert.rejects(io.read(url),error=>error===reason)}finally{clearTimeout(timer);io.close()}
 }
 assert.equal(reads,2)
 await assert.rejects(run({requestIntervalMs:0,fetchImpl:async u=>{reads++;return Object.defineProperty(new Response(null,{status:202,headers:{'x-amzn-waf-action':'challenge'}}),'url',{value:String(u)})}}),error=>error.httpStatus===202&&error.failureKind==='blocked_or_access_denied')
 assert.equal(reads,3)
})
test('KANINI pacing preserves the exact owning TimeoutError and the local source deadline without another fetch',async()=>{
 for(const mode of['owning-timeout','local-source']){const deadline=mode==='owning-timeout'?AbortSignal.timeout(40):undefined,url='https://kanini.com/';let reads=0
  const io=currentKaniniTransport({signal:deadline,requestIntervalMs:1000,timeoutMs:mode==='local-source'?40:180000,allowedRequest:(u,m)=>u===url&&m==='GET',fetchImpl:async()=>{reads++;return Object.defineProperty(new Response('native',{headers:{'content-type':'text/html'}}),'url',{value:url})}})
  try{await io.read(url);await assert.rejects(io.read(url),error=>mode==='owning-timeout'?error===deadline.reason&&error.name==='TimeoutError':error.name==='Error'&&error.message==='KANINI current source deadline exceeded');assert.equal(reads,1)}finally{io.close()}
 }
})
