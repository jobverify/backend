import fs from 'node:fs'
import assert from 'node:assert/strict'
import {test,before,after} from 'node:test'
import http from 'node:http'
import https from 'node:https'
import {createHash} from 'node:crypto'
import {gunzipSync} from 'node:zlib'
import {createWonksknowScraper} from './script.js'

// Owner regression adoption of root's exact seven actual-response controls.
// Independent review helpers are not executed by this entry.
const sha=b=>createHash('sha256').update(b).digest('hex'),hash=f=>sha(fs.readFileSync(f))
const fixture='scraper/wonksknow/fixtures/current-own-india-originals-20261121.json.gz'
assert.equal(hash(fixture),'8c6647905160258f924d2127cec1b503ad9dc9002169edc95fb3202bc844a807')
const packet=JSON.parse(gunzipSync(fs.readFileSync(fixture))),records=packet.responses
assert.equal(records.length,32);let originalBytes=0
for(const r of records){const b=Buffer.from(r.bodyBase64,'base64');assert.equal(b.length,r.bytes);assert.equal(sha(b),r.sha256);assert.equal(r.status,200);assert.equal(r.method,'GET');originalBytes+=b.length}
assert.equal(originalBytes,2493432)
const targetURL=packet.phases[0].roles[0].url,targetID=new URL(targetURL).searchParams.get('job_id')
let baseline,networkCalls=0
const saved={f:globalThis.fetch,hr:http.request,hg:http.get,sr:https.request,sg:https.get}
const blocked=()=>{networkCalls++;throw Error('Root independent Wonksknow review prohibits live network')}
async function collect(change=(_r,text)=>text){
 let cursor=0;const changed=[]
 const jobs=await createWonksknowScraper().run({now:packet.completedAt,requestIntervalMs:0,fetchImpl:async(url,init)=>{
  const index=cursor++,r=records[index];assert(r,'Exact retained32 Response allowlist exhausted');assert.equal(String(url),r.requestedUrl)
  assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')
  const original=Buffer.from(r.bodyBase64,'base64').toString('utf8'),text=change(r,original,index)
  if(text!==original)changed.push({index,url:r.requestedUrl,originalSHA256:r.sha256,controlledSHA256:sha(text),bytes:Buffer.byteLength(text)})
  return Object.defineProperties(new Response(text,{status:r.status,headers:r.headers}),{url:{value:r.url},redirected:{value:r.redirected}})
 }})
 assert.equal(cursor,32);return{jobs,audit:jobs.nativeCollectionEvidence,changed,cursor}
}
function descriptionMutation(prefix){return(r,html,index)=>{
 if(r.requestedUrl!==targetURL)return html
 const phase=index<records.length/2?'opening':'closing'
 const raw=baseline.jobs.find(j=>j.sourceUrl===targetURL).sourceNativeRoleModels.find(m=>m.phase===phase).originalModel.originalDescription.rawHTML
 assert.equal(typeof raw,'string');assert(raw.length>0);assert.equal(html.split(raw).length,2,'Unique original selected criteria fragment')
 return html.replace(raw,prefix(phase)+raw)
}}
const roleOf=o=>o.jobs.find(j=>j.sourceUrl===targetURL)
const assertHeld=o=>{assert(!roleOf(o),'Conflicting selected role was emitted');assert.equal(o.jobs.length,baseline.jobs.length-1,'Unrelated partials must survive');assert(o.audit.held.some(h=>h.id===targetID),'Selected role hold must be retained')}
const controls=[
 {label:'genuine32 baseline retains all14 India-channel partials and null native country/dates/legal/formal requisition',baseline:true,check:o=>{
  assert.equal(o.jobs.length,14);assert.equal(o.audit.held.length,0)
  for(const j of o.jobs){assert.equal(j.country,'India');for(const k of ['nativeCountry','nativePostedDate','nativeValidThrough','nativeLegalEmployer','requisitionId'])assert.equal(j[k],null);assert.equal(j.sourceCountryEvidence.inferredFromCity,false);assert.equal(j.sourceCountryEvidence.inferredFromCompanyAddress,false);assert.equal(j.sourceCountryEvidence.inferredFromEmployerName,false);assert.equal(j.sourceDetailComplete,false);assert.equal(j.sourceScopeComplete,false)}
 }},
 {label:'own role may mention a client without making that client the recruiting employer',prefix:()=>'<p>Wonksknow serves clients including Acme; this is a Wonksknow role.</p>',check:o=>{assert(roleOf(o));assert.equal(o.jobs.length,14);assert.equal(o.audit.held.length,0)}},
 {label:'explicit foreign is-hiring assertion cannot escape by a different recruitment verb',prefix:()=>'<p>Acme is hiring for this vacancy on its own payroll. Wonksknow provides recruiting tools.</p>',check:assertHeld},
 {label:'later explicit foreign recruiting assertion cannot escape after an own first assertion',prefix:()=>'<p>Wonksknow is looking for qualified candidates. Acme is looking for its own employee for this vacancy.</p>',check:assertHeld},
 {label:'earliest authored opening date and both changed criterion variants survive closing observation',prefix:phase=>phase==='opening'?'<p>Date Posted: 2026-11-02T00:00:00Z</p><p>Opening criterion alpha remains required.</p>':'<p>Date Posted: 2026-11-10T00:00:00Z</p><p>Closing criterion beta remains required.</p>',check:o=>{const j=roleOf(o);assert(j);assert.equal(j.postingDate,'2026-11-02T00:00:00.000Z');assert.match(j.sourceDescription,/Opening criterion alpha remains required/);assert.match(j.sourceDescription,/Closing criterion beta remains required/);assert.equal(j.sourceCriteriaObservationConflict,true);assert(j.sourceNativeDates.recognizedPostingFields.some(f=>f.raw==='2026-11-02T00:00:00Z'));assert(j.sourceNativeDates.recognizedPostingFields.some(f=>f.raw==='2026-11-10T00:00:00Z'))}},
 {label:'complete200 impossible authored posting calendar date holds only affected selected role',prefix:()=>'<p>Date Posted: 2026-02-30T00:00:00Z</p>',check:assertHeld},
 {label:'expiry authored only in closing selected criteria holds only affected role',prefix:phase=>phase==='closing'?'<p>Valid Through: 2026-11-20T00:00:00Z</p>':'<p>Opening application remains under observation.</p>',check:assertHeld},
]
before(()=>{globalThis.fetch=blocked;http.request=blocked;http.get=blocked;https.request=blocked;https.get=blocked})
after(()=>{globalThis.fetch=saved.f;http.request=saved.hr;http.get=saved.hg;https.request=saved.sr;https.get=saved.sg;assert.equal(networkCalls,0)})
for(const c of controls)test(c.label,{concurrency:false},async()=>{
 const outcome=await collect(c.baseline?undefined:descriptionMutation(c.prefix))
 if(c.baseline)baseline=outcome
 c.check(outcome)
})
