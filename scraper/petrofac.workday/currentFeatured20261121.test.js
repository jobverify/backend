import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
globalThis.fetch=async()=>{throw Error('NETWORK FORBIDDEN: Petrofac current-original regressions')}
const historical=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261115.json.gz',import.meta.url))))
const current=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-board-redacted-20261121.json.gz',import.meta.url))))
const BOARD='https://petrofac.referrals.selectminds.com/',ROLE=BOARD+'jobs/hr-digital-associate-data-management-12272'
function ranges(html){const out=[],stack=[];for(const m of html.matchAll(/<\/?div\b[^>]*>/g)){if(m[0].startsWith('</')){const start=stack.pop();if(start?.row)out.push([start.offset,m.index+m[0].length])}else stack.push({offset:m.index,row:/\bid="job_list_\d+"/.test(m[0])})}return out.sort((a,b)=>a[0]-b[0])}
const currentHTML=Buffer.from(current.bodyBase64,'base64').toString(),currentRanges=ranges(currentHTML)
assert.equal(currentRanges.length,5)
const cohort=currentHTML.slice(currentRanges[0][0],currentRanges.at(-1)[1])
function mixedBoard(old){const spans=ranges(old);assert.equal(spans.length,4);return old.slice(0,spans[0][0])+cohort+old.slice(spans.at(-1)[1])}
function replay(change=()=>{},options={}){
 const counts=new Map(),calls=[]
 const fetchImpl=options.fetchImpl??(async(value,init)=>{const url=String(value),index=counts.get(url)??0;counts.set(url,index+1);calls.push({url,index,init});const rows=historical.packets.filter(p=>p.requestedURL===url),p=structuredClone(rows[index]??(rows.length===1?rows[0]:null));assert.ok(p,'Published historical detail/template must exist');p.body=Buffer.from(p.bodyBase64,'base64').toString();if(url===BOARD)p.body=mixedBoard(p.body);change(p,url,index);const response=new Response(p.body,{status:p.status,headers:p.headers});Object.defineProperty(response,'url',{value:p.url});return response})
 return{calls,promise:run({fetchImpl,requestIntervalMs:0,now:()=>historical.capturedAt,...options})}
}
test('actual five-row cohort flows as data with separately historical detail/template qualification',async()=>{
 const r=replay(),jobs=await r.promise
 assert.equal(jobs.length,2);assert.deepEqual(jobs.map(j=>j.jobId),['12272','12218'])
 assert.deepEqual(jobs.map(j=>j.postingDate),['2026-11-02','2026-09-02'])
 assert.equal(jobs.nativeCollectionEvidence.nativeRows.length,5);assert.equal(jobs.nativeCollectionEvidence.holds.length,3)
 assert.equal(jobs.nativeCollectionEvidence.currentFullClosingReconciled,true)
 assert.equal(r.calls.length,10);assert.ok(r.calls.every(c=>new URL(c.url).hostname.endsWith('petrofac.com')||new URL(c.url).hostname==='petrofac.referrals.selectminds.com'))
 assert.ok(jobs.every(j=>j.lifecycleCleanupAllowed===false&&j.sourceScopeComplete===false&&j.sourceRenderedApplicationQualified===false))
 assert.ok(jobs.every(j=>j.nativeSourceRecord.originalPublishedApplication.actionURL===null))
})
test('unrelated style and telemetry declarations do not qualify authored role facts',async()=>{
 const jobs=await replay(p=>{p.body=p.body.replace('</head>','<style>.unrelated{color:blue}</style><script>window.analyticsVersion=99</script></head>')}).promise
 assert.equal(jobs.length,2)
})
for(const[name,mutate,target]of[
 ['mismatched native card identifier',p=>{p.body=p.body.replace('job_list_12272','job_list_77777')},BOARD],
 ['foreign role country',p=>{p.body=p.body.replaceAll('Chennai, India','Chennai, United Kingdom')},ROLE],
 ['disabled native apply',p=>{p.body=p.body.replace('id="apply_btn"','id="apply_btn" disabled')},ROLE],
 ['changed complete qualification',p=>{p.body=p.body.replace('Minimum 3+ years','Minimum 9+ years')},ROLE],
 ['foreign native publisher',p=>{p.body=p.body.replace('client_name: "Petrofac"','client_name: "Other"')},BOARD]
])test(name+' remains held',async()=>{await assert.rejects(replay((p,u)=>{if(u===target)mutate(p)}).promise)})
test('closing membership and full criteria changes are not reconciled',async()=>{
 for(const target of[BOARD,ROLE])await assert.rejects(replay((p,u,i)=>{if(u===target&&i===1)p.body=target===BOARD?p.body.replace('job_list_12275','job_list_99999'):p.body.replace('Minimum 3+ years','Minimum 9+ years')}).promise)
})
for(const status of[403,429,302])test('metadata '+status+' never reads refused entity',async()=>{
 let readers=0,cancels=0
 const r=replay(undefined,{fetchImpl:async value=>({status,url:String(value),headers:new Headers({'content-type':'text/html'}),body:{getReader(){readers++;throw Error('body read forbidden')},cancel(){cancels++;return Promise.resolve()}}})})
 await assert.rejects(r.promise,e=>e.status===status||e.httpStatus===status)
 assert.equal(readers,0);assert.equal(cancels,1)
})
test('opaque caller abort during final evidence attachment retains exact reason',async()=>{
 const c=new AbortController(),reason=Object.freeze({caller:'final-evidence'}),original=Object.defineProperty
 Object.defineProperty=function(target,key,descriptor){const result=original(target,key,descriptor);if(key==='nativeCollectionEvidence'&&Array.isArray(target))c.abort(reason);return result}
 try{await assert.rejects(replay(undefined,{signal:c.signal}).promise,e=>e===reason)}finally{Object.defineProperty=original}
})

test('nontext full criteria cannot silently inherit a text-only qualification',async()=>{
 let changed=false
 const r=replay((p,u)=>{if(u===ROLE){p.body=p.body.replace(/(<div[^>]*class="[^"]*job_description[^"]*"[^>]*>)/,'$1<img src="https://www.petrofac.com/current-requirements.png">');changed=p.body.includes('current-requirements.png')}})
 await assert.rejects(r.promise);assert.equal(changed,true)
})

test('a later detail hold preserves all acquired current featured observations',async()=>{
 await assert.rejects(replay((p,u)=>{if(u===ROLE)p.body=p.body.replace('Minimum 3+ years','Minimum 9+ years')}).promise,e=>e.nativeEvidence?.nativeRows?.length===5&&e.nativeEvidence.currentFullClosingReconciled===false)
})

test('conflicting explicit card and detail dates remain held',async()=>{
 await assert.rejects(replay((p,u)=>{if(u===BOARD)p.body=p.body.replace('Nov 02, 2026','Nov 03, 2026')}).promise)
})
test('country comes from the native location field rather than another card text mention',async()=>{
 await assert.rejects(replay((p,u)=>{if(u===BOARD){p.body=p.body.replaceAll('Chennai, India','London, United Kingdom');p.body=p.body.replaceAll('class="jlr_description">','class="jlr_description">Chennai, India ')}}).promise)
})

test('new supplemental native qualification carrier remains held',async()=>{
 await assert.rejects(replay((p,u)=>{if(u===ROLE)p.body=p.body.replace('</body>','<data itemprop="qualifications" value="A cryptography doctorate is mandatory"></data></body>')}).promise)
})

test('declared disabled or unknown native ARIA availability never qualifies Apply',async()=>{
 for(const value of ['TRUE',' true ','unknown'])await assert.rejects(replay((p,u)=>{if(u===ROLE)p.body=p.body.replace('id="apply_btn"','id="apply_btn" aria-disabled="'+value+'"')}).promise)
})
test('explicit false ARIA availability retains the native role',async()=>{
 const jobs=await replay((p,u)=>{if(u===ROLE)p.body=p.body.replace('id="apply_btn"','id="apply_btn" aria-disabled="false"')}).promise
 assert.equal(jobs.length,2)
})

test('valid JSONLD MIME parameters cannot conceal a new native eligibility condition',async()=>{
 await assert.rejects(replay((p,u)=>{if(u===ROLE)p.body=p.body.replace('</body>','<script type="application/ld+json; charset=UTF-8">{"@type":"JobPosting","applicantLocationRequirements":{"@type":"Country","name":"United States"}}</script></body>')}).promise)
})
test('supplemental applicant location eligibility outside main criteria remains held',async()=>{
 await assert.rejects(replay((p,u)=>{if(u===ROLE)p.body=p.body.replace('</body>','<data itemprop="applicantLocationRequirements" value="United States"></data></body>')}).promise)
})
