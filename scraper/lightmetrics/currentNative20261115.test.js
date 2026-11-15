import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261115.json.gz',import.meta.url))))
const currentGTM=gunzipSync(fs.readFileSync(new URL('./fixtures/current-gtm-program-20261115.js.gz',import.meta.url))).toString('utf8')
const grouped=new Map(),HOME='https://www.lightmetrics.co/',BOARD='https://www.lightmetrics.ai/company/careers',AI='https://www.lightmetrics.ai/career/software-engineer---ai'
for(const p of fixture.packets){if(!grouped.has(p.requestedURL))grouped.set(p.requestedURL,[]);grouped.get(p.requestedURL).push(p)}
function replay(change=()=>{},options={}){
 const calls=[],counts=new Map(),mutations=[]
 const fetchImpl=options.fetchImpl||(async(value,init)=>{
  const url=String(value),index=counts.get(url)||0;counts.set(url,index+1)
  let p=structuredClone(grouped.get(url)?.[index]);assert.ok(p,'request must have an actual current retained packet '+url+' #'+index)
  if(p.status>=300&&p.status<400&&init.redirect!=='manual'){
   assert.notEqual(init.redirect,'error','redirect-error transport rejects the actual redirect')
   const target=new URL(p.headers.location,url).href,targetIndex=counts.get(target)||0;counts.set(target,targetIndex+1)
   p=structuredClone(grouped.get(target)?.[targetIndex]);assert.ok(p,'actual redirect target packet '+target)
  }
  const original=Buffer.from(p.bodyBase64,'base64').toString('utf8');p.body=original;change(p,url,index)
  if(p.body!==original||p.status!==grouped.get(url)[index].status||p.url!==grouped.get(url)[index].url||JSON.stringify(p.headers)!==JSON.stringify(grouped.get(url)[index].headers))mutations.push({url,index})
  calls.push({url,index,init});const response=new Response(p.body,{status:p.status,headers:p.headers});Object.defineProperty(response,'url',{value:p.url});return response
 })
 return{calls,mutations,promise:run({fetchImpl,requestIntervalMs:0,now:()=>fixture.capturedAt,...options})}
}
test('registered current Lightmetrics preserves two full explicit India roles and all five current cards',async()=>{
 const reader=replay(),jobs=await reader.promise
 assert.equal(jobs.length,2)
 assert.deepEqual(jobs.map(j=>j.title),['Software Engineer – AI','Software Engineer - Android'])
 for(const job of jobs){assert.equal(job.company,'Lightmetrics');assert.equal(job.country,'India');assert.equal(job.sourceDetailComplete,true);assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false);assert.equal(job.postingDate,null);assert.equal(job.jobId,null);assert.equal(job.sourceRenderedApplicationQualified,false);assert.ok(job.jobDescription.includes('Requirements'));assert.ok(job.jobDescription.includes('Benefits'));assert.ok(job.jobDescription.includes('equal opportunity employer'));assert.ok(job.jobDescription.length>1800);assert.ok(job.nativeSourceRecord.originalOwnRoleHTML.includes(job.title))}
 assert.ok(jobs[0].jobDescription.includes('two days a week from office'));assert.ok(jobs[1].jobDescription.includes('3 days’ work from office'))
 assert.equal(jobs.nativeCollectionEvidence.nativeRows.length,5);assert.equal(jobs.nativeCollectionEvidence.holds.length,3)
 assert.equal(jobs.nativeCollectionEvidence.originalResponses.length,48);assert.equal(reader.calls.length,48)
 assert.ok(reader.calls.every(c=>c.init.method==='GET'&&c.init.redirect==='manual'&&c.init.credentials==='omit'))
 const evidence=readInventoryEvidence(jobs);assert.equal(evidence.listingComplete,false);assert.equal(evidence.reportedTotal,null);assert.equal(evidence.indiaFacetCount,null)
})
test('the second actual current whole GTM program preserves the same full native roles',async()=>{
 const reader=replay((p,url)=>{if(url==='https://www.googletagmanager.com/gtm.js?id=GTM-P2RRRFTF')p.body=currentGTM}),jobs=await reader.promise
 assert.equal(jobs.length,2);assert.equal(reader.mutations.length,2);assert.ok(jobs.every(j=>j.sourceDetailComplete===true&&j.lifecycleCleanupAllowed===false))
})
test('closing can use the independently observed second complete analytics program without changing native role proof',async()=>{
 const reader=replay((p,url,index)=>{if(url==='https://www.googletagmanager.com/gtm.js?id=GTM-P2RRRFTF'&&index===1)p.body=currentGTM}),jobs=await reader.promise
 assert.equal(jobs.length,2);assert.equal(reader.mutations.length,1);assert.ok(jobs.every(j=>j.sourceNativeClosingReconciled===true))
})
test('a newly added role-mutating instruction cannot inherit either reviewed whole program',async()=>{
 const reader=replay((p,url)=>{if(url==='https://www.googletagmanager.com/gtm.js?id=GTM-P2RRRFTF')p.body=currentGTM+'\nwindow.currentRoleClosed=true;'});
 await assert.rejects(reader.promise,error=>error.softFailure===true);assert.ok(reader.mutations.length)
})
for(const[name,mutate]of[
 ['country contradiction',p=>{p.body=p.body.replace('Bangalore, India','Bangalore, United States')}],
 ['omitted complete original requirement',p=>{p.body=p.body.replace('Prior experience','No experience')}],
 ['an extra original qualification',p=>{p.body=p.body.replace('Job Description','A mandatory extra licence. Job Description')}],
 ['a hidden full role',p=>{p.body=p.body.replace('<main ','<main hidden ')}],
 ['a closed current role',p=>{p.body=p.body.replace('Job Description','Applications are no longer accepted. Job Description')}],
 ['unavailable own native application',p=>{p.body=p.body.replace('id="Apply-for-this-Position"','id="No-Application"')}],
 ['an additional role-context program',p=>{p.body=p.body.replace('</head>','<script>window.currentRoleClosed=true</script></head>')}],
])test(name+' cannot reuse the original current native proof',async()=>{
 const reader=replay((p,url)=>{if(url===AI)mutate(p)})
 await assert.rejects(reader.promise,error=>error.softFailure===true&&error.lifecycleCleanupAllowed===false)
 assert.ok(reader.mutations.length,'mutation reached actual role packet')
})
for(const[name,change]of[
 ['closing-only full criteria',(p,url,index)=>{if(url===AI&&index===1)p.body=p.body.replace('Job Description','A mandatory closing-only condition. Job Description')}],
 ['closing-only native membership',(p,url,index)=>{if(url===BOARD&&index===1)p.body=p.body.replace('/career/software-engineer---ai','/career/closed-role')}],
 ['closing-only active stylesheet',(p,url,index)=>{if(url.endsWith('lightmetrics-ef.webflow.shared.92e1f49b8.min.css')&&index===1)p.body+='\nmain{display:none}'}],
 ['closing-only active client',(p,url,index)=>{if(url.endsWith('webflow.b049d1f4.3baead785c62a8be.js')&&index===1)p.body+='\nwindow.currentRoleClosed=true;'}],
 ['a changed corporate redirect',(p,url)=>{if(url===HOME)p.headers.location='https://another.example/'}],
 ['a native final URL mismatch',(p,url)=>{if(url===AI)p.url='https://www.lightmetrics.ai/'}],
 ['an unsupported native MIME',(p,url)=>{if(url===AI)p.headers['content-type']='text/plain'}],
])test(name+' withholds the source and keeps cleanup forbidden',async()=>{
 const reader=replay(change);await assert.rejects(reader.promise,error=>error.softFailure===true&&error.lifecycleCleanupAllowed===false);assert.ok(reader.mutations.length)
})
for(const reason of['independent-stop',Object.freeze({cancel:'stop'})])test('opaque caller cancellation '+typeof reason+' remains the exact reason',async()=>{
 const c=new AbortController(),reader=replay(undefined,{signal:c.signal,fetchImpl:()=>new Promise(()=>{})});setTimeout(()=>c.abort(reason),5)
 await assert.rejects(reader.promise,error=>error===reason)
})
test('uncooperative native fetch is bounded by the source deadline',async()=>{await assert.rejects(replay(undefined,{sourceDeadlineMs:20,fetchImpl:()=>new Promise(()=>{})}).promise,/deadline/)})
test('a public denial stops at its first original request',async()=>{
 let reads=0;await assert.rejects(replay(undefined,{fetchImpl:async value=>{reads++;const r=new Response('Denied',{status:403,headers:{'content-type':'text/html'}});Object.defineProperty(r,'url',{value:String(value)});return r}}).promise,error=>error.softFailure===true);assert.equal(reads,1)
})
test('oversized original streams are cancelled before document admission',async()=>{
 let cancelled=false;await assert.rejects(replay(undefined,{fetchImpl:async value=>{const r=new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(4000001))},cancel(){cancelled=true}}),{status:200,headers:{'content-type':'text/html'}});Object.defineProperty(r,'url',{value:String(value)});return r}}).promise,error=>error.softFailure===true);assert.equal(cancelled,true)
})
